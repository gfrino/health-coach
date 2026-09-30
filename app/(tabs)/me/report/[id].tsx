import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, DateField, Icon, Screen, TextField } from '@/components';
import { getDb, labReportRepository } from '@/db';
import type { LabReport } from '@/db/repositories/labReportRepository';
import { bytesToBase64 } from '@/lib/base64';
import { fileTypeOf } from '@/records/fileMeta';
import { useTheme } from '@/theme';

export default function ReportScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<LabReport | null>(null);
  const [title, setTitle] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const db = await getDb();
      const r = await labReportRepository.getReport(db, id);
      if (!active || !r) return;
      setReport(r);
      setTitle(r.title);
      if (r.mimeType?.startsWith('image/')) {
        const file = await labReportRepository.getReportFile(db, id);
        if (active && file) setPreview(`data:${file.mimeType};base64,${bytesToBase64(file.data)}`);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (!report) return null;

  const save = async (patch: { title?: string; reportDate?: string | null }) => {
    const db = await getDb();
    await labReportRepository.updateReport(db, id, patch);
  };

  /** Apre il file originale: copia temporanea in cache, condivisione/anteprima di sistema, poi eliminata. */
  const open = async () => {
    const db = await getDb();
    const f = await labReportRepository.getReportFile(db, id);
    if (!f) return;
    const type = fileTypeOf(f.mimeType);
    const ext =
      f.fileName?.split('.').pop()?.toLowerCase() ||
      type?.ext[0] ||
      f.mimeType.split('/')[1] ||
      'bin';
    const tmp = new File(
      Paths.cache,
      `${report.title.replace(/[^\w\- ]+/g, '').slice(0, 40) || 'referto'}.${ext}`,
    );
    try {
      if (tmp.exists) tmp.delete();
      tmp.create();
      tmp.write(f.data);
      await Sharing.shareAsync(tmp.uri, {
        mimeType: f.mimeType,
        UTI: type?.uti,
      });
    } finally {
      try {
        tmp.delete();
      } catch {
        // già eliminato
      }
    }
  };

  const remove = () =>
    Alert.alert(t('records.deleteTitle'), t('records.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await labReportRepository.deleteReport(db, id);
          router.back();
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: report.title, headerLargeTitle: false }} />
      <Screen>
        {preview ? (
          <Image
            source={{ uri: preview }}
            accessibilityLabel={report.title}
            resizeMode="contain"
            style={{
              width: '100%',
              height: 360,
              borderRadius: radius.lg,
              backgroundColor: colors.surfaceAlt,
            }}
          />
        ) : (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon
                name={report.mimeType === 'application/pdf' ? 'pdf' : 'document'}
                color={colors.primary}
                size={28}
              />
              <AppText style={{ flex: 1 }} numberOfLines={2}>
                {report.fileName ?? report.title}
              </AppText>
            </View>
          </Card>
        )}
        <Button label={t('records.open')} variant="secondary" onPress={open} />

        <TextField
          label={t('records.title')}
          value={title}
          onChangeText={setTitle}
          onEndEditing={() => title.trim() && save({ title })}
        />
        <DateField
          label={t('records.date')}
          value={report.reportDate}
          onChange={(reportDate) => save({ reportDate })}
        />

        <Card tone="soft">
          <AppText variant="headline">{t('records.extractionTitle')}</AppText>
          <AppText variant="callout">{t('records.extractionBody')}</AppText>
        </Card>

        <AppText variant="caption" tone="textMuted">
          {t('records.encryptedNote')}
        </AppText>
        <Button label={t('records.delete')} variant="ghost" onPress={remove} />
      </Screen>
    </>
  );
}
