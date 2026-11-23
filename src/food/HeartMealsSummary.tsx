import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, Card, Icon } from '@/components';
import { foodRepository, getDb, healthQueries } from '@/db';
import { useTheme } from '@/theme';

import {
  analyzeHeartMeals,
  groupMeals,
  heartMealsCsv,
  MIN,
  MIN_MEALS_FOR_CORRELATION,
  WINDOW,
  type Correlation,
  type HeartMealAnalysis,
} from './heartResponse';

/** Analisi sugli ultimi 30 giorni: oltre, la frequenza cardiaca non è conservata in dettaglio. */
const DAYS = 30;

async function loadData() {
  const db = await getDb();
  const to = Date.now();
  const from = to - DAYS * 24 * 60 * MIN;
  const [entries, hr, hrv] = await Promise.all([
    foodRepository.listBetween(db, from, to),
    healthQueries.metricSamples(db, 'heartRate', from + WINDOW.hrvBefore[0] * MIN, to),
    healthQueries.metricSamples(db, 'hrv', from + WINDOW.hrvBefore[0] * MIN, to),
  ]);
  return { entries, hr, hrv };
}

/** "Pasti e battito": cosa succede al cuore dopo mangiato, e se dipende da cosa si mangia. */
export function HeartMealsSummary() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const [a, setA] = useState<HeartMealAnalysis | null>(null);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadData().then(({ entries, hr, hrv }) => {
        if (active) setA(analyzeHeartMeals(entries, hr, hrv));
      });
      return () => {
        active = false;
      };
    }, []),
  );

  // Nessun pasto o nessun dato sul battito: la card non serve.
  if (!a || !a.responses.length) return null;

  const num = (n: number) =>
    n.toLocaleString(i18n.language, { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const line = (c: Correlation) => {
    const nutrient = t(`food.heart.nutrients.${c.nutrient}`);
    if (c.confidence === 'clear')
      return t(`food.heart.corr.${c.target}.${(c.r ?? 0) > 0 ? 'up' : 'down'}`, {
        nutrient,
        r: num(c.r ?? 0),
      });
    return t('food.heart.corr.unclear', { nutrient, r: num(c.r ?? 0) });
  };
  const hrCorr = a.correlations.filter((c) => c.target === 'hr');
  const hrvCorr = a.correlations.filter(
    (c) => c.target === 'hrv' && c.confidence !== 'insufficient',
  );
  const enough = hrCorr.some((c) => c.confidence !== 'insufficient');

  const exportCsv = async () => {
    setExporting(true);
    const { entries, hr, hrv } = await loadData();
    const file = new File(Paths.cache, 'alba-pasti-battito.csv');
    try {
      if (file.exists) file.delete();
      file.create();
      file.write(heartMealsCsv(groupMeals(entries), hr, hrv));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
    } finally {
      try {
        file.delete();
      } catch {
        // già eliminato
      }
      setExporting(false);
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Icon name="waveform" color={colors.primary} />
        <AppText variant="headline" style={{ flex: 1 }}>
          {t('food.heart.summaryTitle')}
        </AppText>
      </View>
      {a.used === 0 ? (
        <AppText variant="callout" tone="textMuted">
          {t('food.heart.summaryNoData')}
        </AppText>
      ) : (
        <>
          <AppText variant="callout">
            {t('food.heart.summaryAvg', { count: a.used, delta: num(a.avgHrDelta ?? 0) })}
          </AppText>
          {a.avgHrvDelta != null ? (
            <AppText variant="callout">
              {t('food.heart.summaryHrv', { delta: num(a.avgHrvDelta) })}
            </AppText>
          ) : null}
          {enough ? (
            [...hrCorr.filter((c) => c.confidence !== 'insufficient'), ...hrvCorr].map((c) => (
              <AppText key={`${c.target}-${c.nutrient}`} variant="callout">
                {`• ${line(c)}`}
              </AppText>
            ))
          ) : (
            <AppText variant="callout" tone="textMuted">
              {t('food.heart.needMore', { min: MIN_MEALS_FOR_CORRELATION, count: a.used })}
            </AppText>
          )}
        </>
      )}
      <AppText variant="caption" tone="textMuted">
        {t('food.heart.summaryNote')}
      </AppText>
      <Button
        label={t('food.heart.export')}
        variant="secondary"
        onPress={() => void exportCsv()}
        loading={exporting}
        disabled={exporting}
      />
    </Card>
  );
}
