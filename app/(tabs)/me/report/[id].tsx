import { File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Stack } from 'expo-router/stack';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, DateField, Icon, Screen, TextField } from '@/components';
import { getDb, labReportRepository } from '@/db';
import type { LabReport } from '@/db/repositories/labReportRepository';
import FilePreview from 'file-preview';

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

  /**
   * Copia temporanea in cache (il file vive solo nel DB cifrato), poi anteprima o condivisione;
   * la copia viene eliminata alla chiusura.
   */
  const withTempFile = async (
    action: (uri: string, mimeType: string, uti?: string) => Promise<void>,
  ) => {
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
      await action(tmp.uri, f.mimeType, type?.uti);
    } finally {
      try {
        tmp.delete();
      } catch {
        // già eliminato
      }
    }
  };

  const share = () =>
    withTempFile((uri, mimeType, UTI) => Sharing.shareAsync(uri, { mimeType, UTI }));

  /** Anteprima nell'app (QuickLook su iOS); senza il modulo nativo, menu di condivisione. */
  const open = () =>
    FilePreview
      ? withTempFile((uri) => FilePreview!.preview(uri, report.title)).catch(() => share())
      : share();

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
      <Stack.Screen
        options={{
          title: report.title,
          headerLargeTitle: false,
          // Aperto direttamente (es. da una condivisione) senza "Io" sotto: si torna comunque alla Cartella.
          headerLeft: router.canGoBack()
            ? undefined
            : () => (
                <Pressable
                  onPress={() =>
                    router.replace({ pathname: '/me', params: { section: 'records' } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('tabs.me')}
                  hitSlop={10}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  <Icon name="chevronLeft" color={colors.primary} />
                  <AppText tone="primary">{t('tabs.me')}</AppText>
                </Pressable>
              ),
        }}
      />
      <Screen>
        <Pressable
          onPress={() => void open()}
          accessibilityRole="button"
          accessibilityLabel={t('records.open')}
        >
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
        </Pressable>
        <Button label={t('records.open')} onPress={() => void open()} />
        <Button label={t('records.share')} variant="secondary" onPress={() => void share()} />

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
