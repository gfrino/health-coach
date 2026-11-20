import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { LayoutAnimation, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card } from '@/components';
import {
  EXTRA_MEASURES,
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
/** Misure "storiche" della scheda; le altre sono il resto di Apple Salute, mostrate sotto. */
const BASE = new Set<string>(EXTRA_MEASURES);
/** Righe del resto di Apple Salute visibili prima di "Mostra tutte". */
const FIRST = 6;
/** Unità come si leggono sul telefono. */
const UNIT_SHOWN: Record<string, string> = {
  mcg: 'µg',
  dBASPL: 'dB',
  'kcal/hr·kg': 'MET',
};

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
  const [all, setAll] = useState(false);

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

  // Resto di Apple Salute: unità convertite per la lettura (m/s → km/h, m → km, °C/°F…).
  const otherValue = (m: ExtraMeasure): string => {
    const v = m.daily ? (m.avg7 ?? m.latest) : m.latest;
    const u = m.unit;
    if (m.type.startsWith('symptom'))
      return t(
        `today.other.severity.${Math.round(Math.min(3, Math.max(0, v)))}` as 'today.other.severity.0',
      );
    if (u === 'm/s') return `${num(v * 3.6, locale, 1)} km/h`;
    if (u === 'm' && v >= 1000) return `${num(v / 1000, locale, 2)} km`;
    if (u === 'degC') return formatTemperature(v, units, locale);
    if (u === 'appleEffortScore') return `${num(v, locale, 1)}/10`;
    if (u === 'valence') return `${v > 0 ? '+' : ''}${num(v, locale, 2)}`;
    if (u === 'count' || u === 'level')
      return num(v, locale, v >= 10 || Number.isInteger(v) ? 0 : 1);
    return `${num(v, locale, v >= 100 ? 0 : 1)} ${UNIT_SHOWN[u] ?? u}`;
  };
  const otherRows = data.extras
    .filter((m) => !BASE.has(m.type))
    .map((m) => ({
      label: t(`today.other.health.${m.type}` as 'today.other.health.exerciseTime'),
      value: otherValue(m),
      note: m.daily ? t('today.other.perDay7') : date(m.latestDay),
    }));

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
    ...data.extras
      .filter((m) => BASE.has(m.type))
      .map((m) => ({
        label: t(`today.other.${m.type as (typeof EXTRA_MEASURES)[number]}`),
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
    ...otherRows.slice(0, all ? otherRows.length : FIRST),
  ];
  const toggleAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAll(!all);
  };

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
      {otherRows.length > FIRST ? (
        <Pressable
          onPress={toggleAll}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => ({
            minHeight: 40,
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <AppText variant="callout" tone="primary" style={{ fontWeight: '600' }}>
            {all ? t('today.other.less') : t('today.other.more', { count: otherRows.length })}
          </AppText>
        </Pressable>
      ) : null}
    </Card>
  );
}
