import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card } from '@/components';
import {
  loadCycle,
  loadExtraMeasures,
  type CycleInfo,
  type ExtraMeasure,
} from '@/coach/extraMeasures';
import { getDb, healthQueries } from '@/db';
import { DAY_MS } from '@/lib/dates';
import { formatGlucose, formatTemperature, formatWeight, num } from '@/lib/units';
import { useSyncStore } from '@/sources/syncService';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

/** Già mostrate in altre schede (passi, calorie): qui non si ripetono. */
const HIDDEN = new Set(['distance', 'floors']);

interface Data {
  extras: ExtraMeasure[];
  glucose: { value: number; day: string } | null;
  cycle: CycleInfo | null;
}

/** "Altre misure": i dati di Apple Salute / Health Connect senza una scheda propria, se presenti. */
export function OtherMeasures() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const locale = i18n.language;
  const units = useSettingsStore((s) => s.settings.units);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const [data, setData] = useState<Data | null>(null);

  const reload = useCallback(() => {
    let active = true;
    (async () => {
      const db = await getDb();
      const now = new Date();
      const [extras, cycle, g] = await Promise.all([
        loadExtraMeasures(db, now),
        loadCycle(db, now),
        healthQueries.dailyMetric(
          db,
          'bloodGlucose',
          now.getTime() - 30 * DAY_MS,
          now.getTime() + 1,
        ),
      ]);
      const last = g.days.at(-1);
      if (active)
        setData({
          extras: extras.filter((e) => !HIDDEN.has(e.type)),
          cycle,
          glucose: last ? { value: last.value, day: last.day } : null,
        });
    })();
    return () => {
      active = false;
    };
  }, []);
  useFocusEffect(reload);
  useEffect(reload, [lastSyncAt, reload]);

  if (!data || (!data.extras.length && !data.glucose && !data.cycle)) return null;

  const date = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const value = (m: ExtraMeasure): string => {
    const v = m.daily ? (m.avg7 ?? m.latest) : m.latest;
    switch (m.type) {
      case 'leanMass':
        return formatWeight(v, units, locale);
      case 'bodyTemperature':
        return formatTemperature(v, units, locale);
      case 'bodyFat':
        return `${num(v, locale, 1)}%`;
      case 'bmi':
        return num(v, locale, 1);
      case 'heartRate':
      case 'respiratoryRate':
      case 'restingEnergy':
      case 'protein':
      case 'carbs':
      case 'fat':
      case 'water':
      case 'caffeine':
      case 'mindfulness':
      case 'vo2max':
        return `${num(v, locale, m.type === 'vo2max' ? 1 : 0)} ${t(`today.other.units.${m.type}`)}`;
      default:
        return num(v, locale, 1);
    }
  };

  const rows: { label: string; value: string; note: string }[] = [
    ...(data.glucose
      ? [
          {
            label: t('today.other.bloodGlucose'),
            value: formatGlucose(data.glucose.value, units, locale),
            note: date(data.glucose.day),
          },
        ]
      : []),
    ...data.extras.map((m) => ({
      label: t(`today.other.${m.type}`),
      value: value(m),
      note: m.daily ? t('today.other.perDay7') : date(m.latestDay),
    })),
    ...(data.cycle
      ? [
          {
            label: t('today.other.cycle'),
            value: date(data.cycle.lastStart),
            note: data.cycle.avgLength
              ? t('today.other.cycleAvg', { days: data.cycle.avgLength })
              : t('today.other.cycleLast'),
          },
        ]
      : []),
  ];

  return (
    <Card>
      <AppText variant="headline">{t('today.other.title')}</AppText>
      {rows.map((r, i) => (
        <View
          key={r.label}
          accessible
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: spacing.sm,
            paddingVertical: spacing.xs,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: colors.border,
          }}
        >
          <AppText variant="body" style={{ flex: 1 }}>
            {r.label}
          </AppText>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              {r.value}
            </AppText>
            <AppText variant="caption" tone="textMuted">
              {r.note}
            </AppText>
          </View>
        </View>
      ))}
    </Card>
  );
}
