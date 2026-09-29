import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, EmptyState, Icon } from '@/components';
import { getDb, labReportRepository } from '@/db';
import type { LabReport } from '@/db/repositories/labReportRepository';
import {
  importFiles,
  pickDocument,
  pickFromCamera,
  pickFromLibrary,
  type IncomingFile,
} from '@/records/importReport';
import { useTheme } from '@/theme';

/** Scelta della fonte e import: usata dal "+" nell'header e dal pulsante dello stato vuoto. */
export function useAddReport(onAdded: (ids: string[]) => void) {
  const { t } = useTranslation();
  const run = async (pick: () => Promise<IncomingFile[]>) => {
    try {
      const files = await pick();
      if (!files.length) return;
      const ids = await importFiles(files, t('records.defaultTitle'));
      onAdded(ids);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      Alert.alert(
        t('records.importFailed'),
        code === 'file_too_large'
          ? t('records.tooLarge')
          : code === 'unsupported_type'
            ? t('records.unsupported')
            : code === 'permission_denied'
              ? t('records.cameraDenied')
              : t('errors.generic'),
      );
    }
  };
  return () =>
    Alert.alert(t('records.addTitle'), t('records.addBody'), [
      { text: t('records.fromCamera'), onPress: () => void run(pickFromCamera) },
      { text: t('records.fromPhotos'), onPress: () => void run(pickFromLibrary) },
      { text: t('records.fromFiles'), onPress: () => void run(pickDocument) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
}

export function RecordsSection({ reloadKey }: { reloadKey: number }) {
  const { t, i18n } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const [reports, setReports] = useState<LabReport[] | null>(null);

  const load = useCallback(async () => {
    const db = await getDb();
    setReports(await labReportRepository.listReports(db));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  // Ricarica anche quando la schermata padre segnala un nuovo import (es. dal "+" nell'header).
  useEffect(() => {
    let active = true;
    getDb()
      .then((db) => labReportRepository.listReports(db))
      .then((list) => active && setReports(list));
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const add = useAddReport((ids) => {
    void load();
    if (ids.length === 1)
      router.push({ pathname: '/me/report/[id]', params: { id: ids[0] as string } });
  });

  if (!reports) return null;
  if (!reports.length) {
    return (
      <View style={{ gap: spacing.lg }}>
        <EmptyState icon="records" title={t('records.emptyTitle')} body={t('records.emptyBody')} />
        <Button label={t('records.addFirst')} onPress={add} />
        <AppText variant="caption" tone="textMuted" align="center">
          {t('records.shareHint')}
        </AppText>
      </View>
    );
  }

  const fmt = (r: LabReport) =>
    r.reportDate
      ? new Date(`${r.reportDate}T00:00:00`).toLocaleDateString(i18n.language, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

  return (
    <View style={{ gap: spacing.sm }}>
      {reports.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => router.push({ pathname: '/me/report/[id]', params: { id: r.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${r.title}, ${fmt(r)}`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.lg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          })}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.md,
              backgroundColor: colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              name={r.mimeType === 'application/pdf' ? 'pdf' : 'photo'}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="headline" numberOfLines={1}>
              {r.title}
            </AppText>
            <AppText variant="caption" tone="textMuted">
              {fmt(r)}
            </AppText>
          </View>
          <Icon name="chevronRight" size={16} color={colors.textMuted} />
        </Pressable>
      ))}
      <AppText variant="caption" tone="textMuted">
        {t('records.shareHint')}
      </AppText>
    </View>
  );
}
