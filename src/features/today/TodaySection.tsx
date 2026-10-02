import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Button, EmptyState, MetricCard, ProgressBar, Sparkline } from '@/components';
import { getDb } from '@/db';
import { formatDistance, formatDuration, formatWeight, num } from '@/lib/units';
import { loadDemoData, syncHealthData, useSyncStore } from '@/sources/syncService';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';

import { loadToday, type TodayData } from './loadToday';

/**
 * Dati di esempio: in sviluppo, oppure nelle build locali per gli screenshot dello store
 * (EXPO_PUBLIC_SCREENSHOTS=1 al momento della build). Mai nelle build per lo store.
 */
const SHOW_DEMO_DATA = __DEV__ || process.env.EXPO_PUBLIC_SCREENSHOTS === '1';

export function TodaySection() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const locale = i18n.language;
  const units = useSettingsStore((s) => s.settings.units);
  const connected = useSettingsStore((s) => s.settings.healthSourceConnectedAt !== null);
  const { syncing, manual, progress, lastSyncAt } = useSyncStore();
  const [data, setData] = useState<TodayData | null>(null);

  const reload = useCallback(() => {
    let active = true;
    getDb()
      .then((db) => loadToday(db))
      .then((d) => active && setData(d));
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(reload);
  // Ricarica a fine sincronizzazione.
  useEffect(reload, [lastSyncAt, syncing, reload]);

  const source = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

  if (!data) return null;

  if (!data.hasData) {
    return (
      <View style={{ gap: spacing.lg }}>
        {syncing ? (
          <View style={{ gap: spacing.sm }}>
            <AppText>{t('today.syncing', { source })}</AppText>
            <ProgressBar
              value={progress ? progress.done / progress.total : 0.05}
              label={t('today.syncing', { source })}
            />
          </View>
        ) : (
          <EmptyState
            icon="today"
            title={t('today.emptyTitle')}
            body={connected ? t('today.connectedNoData', { source }) : t('today.emptyBody')}
            action={
              connected
                ? {
                    label: t('today.syncNow'),
                    onPress: () => void syncHealthData({ force: true, manual: true }),
                  }
                : {
                    label: t('sources.connect', { source }),
                    onPress: () => router.push('/integrations'),
                  }
            }
          />
        )}
        {SHOW_DEMO_DATA ? (
          <Button
            label={t('today.loadDemo')}
            variant="ghost"
            onPress={async () => {
              await loadDemoData();
              reload();
            }}
          />
        ) : null}
      </View>
    );
  }

  const s = data.series;
  const avgText = (v: number | null, format: (n: number) => string) =>
    v != null ? t('today.avg7', { value: format(v) }) : null;
  const spark = (values: (number | null)[], title: string) => (
    <Sparkline values={values} accessibilityLabel={t('today.chartLabel', { title })} />
  );

  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <AppText variant="caption" tone="textMuted" style={{ flex: 1 }}>
          {syncing
            ? t('today.syncing', { source })
            : lastSyncAt
              ? t('today.lastSync', {
                  time: new Date(lastSyncAt).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })
              : ''}
        </AppText>
      </View>
      {syncing && manual && progress ? (
        <ProgressBar
          value={progress.done / progress.total}
          label={t('today.syncing', { source })}
        />
      ) : null}

      <MetricCard
        icon="steps"
        title={t('today.steps')}
        value={data.steps != null ? num(data.steps, locale) : null}
        subtitle={[
          data.distance != null ? formatDistance(data.distance, units, locale) : null,
          avgText(s.steps.avg, (v) => num(v, locale)),
        ]
          .filter(Boolean)
          .join(' · ')}
        emptyText={t('today.noData')}
        chart={spark(s.steps.values, t('today.steps'))}
      />

      <MetricCard
        icon="sleep"
        title={t('today.sleep')}
        value={data.sleep ? formatDuration(data.sleep.asleepMin) : null}
        subtitle={
          data.sleep && (data.sleep.deepMin || data.sleep.remMin)
            ? t('today.sleepStages', {
                deep: formatDuration(data.sleep.deepMin),
                rem: formatDuration(data.sleep.remMin),
                light: formatDuration(data.sleep.lightMin),
              })
            : avgText(s.sleep.avg, (v) => formatDuration(v * 60))
        }
        emptyText={t('today.noData')}
        chart={spark(s.sleep.values, t('today.sleep'))}
      />

      <MetricCard
        icon="flame"
        title={t('today.activeEnergy')}
        value={data.activeEnergy != null ? `${num(data.activeEnergy, locale)} kcal` : null}
        subtitle={[
          data.floors != null ? t('today.floors', { count: Math.round(data.floors) }) : null,
          avgText(s.activeEnergy.avg, (v) => `${num(v, locale)} kcal`),
        ]
          .filter(Boolean)
          .join(' · ')}
        emptyText={t('today.noData')}
        chart={spark(s.activeEnergy.values, t('today.activeEnergy'))}
      />

      <MetricCard
        icon="heart"
        title={t('today.restingHeartRate')}
        value={data.restingHeartRate ? `${num(data.restingHeartRate.value, locale)} bpm` : null}
        subtitle={avgText(s.restingHeartRate.avg, (v) => `${num(v, locale)} bpm`)}
        emptyText={t('today.noData')}
        chart={spark(s.restingHeartRate.values, t('today.restingHeartRate'))}
      />

      <MetricCard
        icon="waveform"
        title={t('today.hrv')}
        value={data.hrv ? `${num(data.hrv.value, locale)} ms` : null}
        subtitle={avgText(s.hrv.avg, (v) => `${num(v, locale)} ms`)}
        emptyText={t('today.noData')}
        chart={spark(s.hrv.values, t('today.hrv'))}
      />

      <MetricCard
        icon="scale"
        title={t('today.weight')}
        value={data.weight ? formatWeight(data.weight.value, units, locale) : null}
        subtitle={
          data.weight?.delta30 != null
            ? t('today.delta30', {
                value: `${data.weight.delta30 > 0 ? '+' : ''}${formatWeight(data.weight.delta30, units, locale)}`,
              })
            : null
        }
        emptyText={t('today.noData')}
      />

      {data.oxygenSaturation || data.bloodPressure ? (
        <MetricCard
          icon="lungs"
          title={t('today.vitals')}
          value={
            [
              data.bloodPressure
                ? `${num(data.bloodPressure.systolic, locale)}/${num(data.bloodPressure.diastolic, locale)} mmHg`
                : null,
              data.oxygenSaturation ? `SpO₂ ${num(data.oxygenSaturation.value, locale)}%` : null,
            ]
              .filter(Boolean)
              .join('  ·  ') || null
          }
          emptyText={t('today.noData')}
        />
      ) : null}

      <MetricCard
        icon="workout"
        title={t('today.workoutsWeek')}
        value={
          data.workouts.length ? t('today.workoutsCount', { count: data.workouts.length }) : null
        }
        subtitle={
          data.workouts.length
            ? formatDuration(data.workouts.reduce((a, w) => a + (w.durationMin ?? 0), 0))
            : null
        }
        emptyText={t('today.noWorkouts')}
      >
        {data.workouts.slice(0, 4).map((w) => (
          <AppText key={`${w.startAt}`} variant="caption" tone="textMuted">
            {new Date(w.startAt).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })} ·{' '}
            {t(`today.activity.${w.activityType}` as 'today.activity.other', {
              defaultValue: w.activityType,
            })}
            {w.durationMin ? ` · ${formatDuration(w.durationMin)}` : ''}
            {w.distanceKm ? ` · ${formatDistance(w.distanceKm * 1000, units, locale)}` : ''}
          </AppText>
        ))}
      </MetricCard>
    </View>
  );
}
