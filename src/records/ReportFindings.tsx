import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card } from '@/components';
import { getDb, labReportRepository } from '@/db';
import type { LabReport, LabResult } from '@/db/repositories/labReportRepository';
import { haptic } from '@/lib/haptics';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { extractReport, useExtractionStore } from './labExtraction';

interface Row {
  result: LabResult;
  previous: LabResult | null;
}

const fmt = (r: LabResult) => `${r.value ?? r.valueText ?? ''}${r.unit ? ` ${r.unit}` : ''}`;

/** Cosa ha letto il coach nel referto: riassunto e valori, con quelli fuori intervallo evidenziati. */
export function ReportFindings({ reportId }: { reportId: string }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const running = useExtractionStore((s) => !!s.running[reportId]);
  const failure = useExtractionStore((s) => s.failures[reportId]);
  const progress = useExtractionStore((s) => s.progress[reportId] ?? 0);
  const version = useExtractionStore((s) => s.version);
  const [report, setReport] = useState<LabReport | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const db = await getDb();
      const r = await labReportRepository.getReport(db, reportId);
      const results = await labReportRepository.listResults(db, reportId);
      const withPrev = await Promise.all(
        results.map(async (result) => ({
          result,
          previous:
            (await labReportRepository.previousResults(db, result.name, result.measuredAt, 1))[0] ??
            null,
        })),
      );
      if (!active) return;
      setReport(r);
      setRows(withPrev);
    })();
    return () => {
      active = false;
    };
  }, [reportId, version]);

  if (!report) return null;
  const hasAI = !!settings.ai.provider && !!settings.ai.model;
  const read = () => {
    haptic.tap();
    void extractReport(settings, reportId);
  };

  // "pending" senza una lettura in corso = lettura interrotta (app chiusa, richiesta bloccata):
  // niente rotella infinita, si propone di riprovare.
  if (running) {
    return (
      <Card tone="soft">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="callout" style={{ flex: 1 }}>
            {t('records.extractionReading', { name: settings.coach.name })}
            {progress ? ` ${t('records.extractionProgress', { count: progress })}` : ''}
          </AppText>
        </View>
      </Card>
    );
  }

  if (
    report.extractionStatus === 'none' ||
    report.extractionStatus === 'failed' ||
    report.extractionStatus === 'pending'
  ) {
    const failed = report.extractionStatus !== 'none';
    const reason = !failure
      ? null
      : failure.code === 'timeout' || failure.code === 'unparseable' || failure.code === 'unreadable'
        ? t(`records.extractionError.${failure.code}`)
        : t(`ai.errors.${failure.code}` as 'ai.errors.unknown');
    return (
      <Card tone={failed ? 'warning' : 'soft'}>
        <AppText variant="headline">{t('records.extractionTitle')}</AppText>
        <AppText variant="callout">
          {!hasAI
            ? t('records.extractionNoAI')
            : failed
              ? (reason ?? t('records.extractionFailed'))
              : t('records.extractionNone', { name: settings.coach.name })}
        </AppText>
        {failed && failure?.detail ? (
          <AppText variant="caption" tone="textMuted" selectable>
            {t('records.extractionErrorDetail', { detail: failure.detail })}
          </AppText>
        ) : null}
        {hasAI ? (
          <Button
            label={failed ? t('common.retry') : t('records.extractionRead')}
            variant="secondary"
            onPress={read}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card tone="soft">
        <AppText variant="headline">{t('records.extractionTitle')}</AppText>
        {report.summary ? <AppText variant="body">{report.summary}</AppText> : null}
      </Card>

      <Card>
        <AppText variant="headline">{t('records.extractionValues')}</AppText>
        {rows.length ? (
          rows.map(({ result, previous }, i) => {
            const flag = labReportRepository.outOfRange(result);
            const range =
              result.refText ??
              (result.refLow != null || result.refHigh != null
                ? `${result.refLow ?? '…'}–${result.refHigh ?? '…'}`
                : null);
            return (
              <View
                key={result.id}
                accessible
                style={{
                  paddingVertical: spacing.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  gap: 2,
                }}
              >
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'baseline' }}>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {result.name}
                  </AppText>
                  <AppText
                    variant="body"
                    tone={flag ? 'danger' : 'text'}
                    style={{ fontWeight: '600' }}
                  >
                    {fmt(result)}
                    {flag ? ` ${flag === 'high' ? '↑' : '↓'}` : ''}
                  </AppText>
                </View>
                {range || flag ? (
                  <AppText variant="caption" tone={flag ? 'danger' : 'textMuted'}>
                    {[
                      flag ? t(`records.extraction_${flag}`) : null,
                      range ? t('records.extractionRange', { range }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                ) : null}
                {previous ? (
                  <AppText variant="caption" tone="textMuted">
                    {t('records.extractionPrevious', {
                      value: fmt(previous),
                      date: previous.measuredAt,
                    })}
                  </AppText>
                ) : null}
              </View>
            );
          })
        ) : (
          <AppText variant="callout" tone="textMuted">
            {t('records.extractionNoValues')}
          </AppText>
        )}
      </Card>
      <AppText variant="caption" tone="textMuted">
        {t('records.extractionNote')}
      </AppText>
      {hasAI ? (
        <Button label={t('records.extractionAgain')} variant="ghost" onPress={read} />
      ) : null}
    </View>
  );
}
