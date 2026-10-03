import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, ChipGroup, EmptyState, Icon } from '@/components';
import { getDb, labReportRepository } from '@/db';
import type { LabReport } from '@/db/repositories/labReportRepository';
import {
  importFiles,
  pickDocument,
  pickFromCamera,
  pickFromLibrary,
  type IncomingFile,
} from '@/records/importReport';
import { useSettingsStore } from '@/store/settingsStore';
import { extractUnreadReports, useExtractionStore } from '@/records/labExtraction';
import { fileTypeOf, type FileKind } from '@/records/fileMeta';
import { useTheme } from '@/theme';

const kindOf = (mime: string | null): FileKind => fileTypeOf(mime)?.kind ?? 'document';

function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024 * 1024)
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(locale)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}

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
  const [filter, setFilter] = useState<'all' | FileKind>('all');

  const load = useCallback(async () => {
    const db = await getDb();
    setReports(await labReportRepository.listReports(db));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      // Referti mai letti dal coach: lettura in background (valori e riassunto).
      void extractUnreadReports(useSettingsStore.getState().settings);
    }, [load]),
  );
  // Fine di una lettura: si aggiorna l'elenco (data del referto).
  const extractionVersion = useExtractionStore((s) => s.version);
  useEffect(() => {
    if (!extractionVersion) return;
    let active = true;
    getDb()
      .then((db) => labReportRepository.listReports(db))
      .then((list) => active && setReports(list));
    return () => {
      active = false;
    };
  }, [extractionVersion]);
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

  const date = (r: LabReport) =>
    r.reportDate
      ? new Date(`${r.reportDate}T00:00:00`).toLocaleDateString(i18n.language, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
  const kindLabel = (r: LabReport) => t(`records.kinds.${kindOf(r.mimeType)}`);
  // Riga secondaria come in un archivio di file: tipo · dimensione · data.
  const fmt = (r: LabReport) =>
    [kindLabel(r), r.sizeBytes ? formatBytes(r.sizeBytes, i18n.language) : null, date(r)]
      .filter(Boolean)
      .join(' · ');
  const kinds = [...new Set(reports.map((r) => kindOf(r.mimeType)))];
  const visible = filter === 'all' ? reports : reports.filter((r) => kindOf(r.mimeType) === filter);

  return (
    <View style={{ gap: spacing.sm }}>
      {reports.length >= 4 && kinds.length > 1 ? (
        <ChipGroup
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all' as const, label: t('records.kinds.all', { count: reports.length }) },
            ...kinds.map((k) => ({ value: k, label: t(`records.kinds.${k}`) })),
          ]}
        />
      ) : null}
      {visible.map((r) => (
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
              name={
                r.mimeType === 'application/pdf'
                  ? 'pdf'
                  : r.mimeType?.startsWith('image/')
                    ? 'photo'
                    : 'document'
              }
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
