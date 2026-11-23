import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Icon } from '@/components';
import { foodRepository, getDb, healthQueries } from '@/db';
import { useTheme } from '@/theme';

import {
  groupMeals,
  mealResponse,
  MIN,
  WINDOW,
  type MealResponse,
  type Sample,
} from './heartResponse';

/** Oltre 30 giorni la frequenza cardiaca è conservata solo come media del giorno. */
const RAW_HR_DAYS = 30;

interface Loaded {
  /** Pasto più vecchio di 30 giorni: il battito non c'è più in dettaglio. */
  old: boolean;
  hr: Sample[];
  response: MealResponse | null;
}

/** Battito intorno a un pasto: grafico da 1 ora prima a 2 ore e mezza dopo, prima/dopo e HRV. */
export function HeartMealCard({ eatenAt }: { eatenAt: number }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const db = await getDb();
      const from = eatenAt + Math.min(WINDOW.chart[0], WINDOW.hrvBefore[0]) * MIN;
      const to = eatenAt + Math.max(WINDOW.chart[1], WINDOW.hrvAfter[1]) * MIN;
      const [hr, hrv, entries] = await Promise.all([
        healthQueries.metricSamples(db, 'heartRate', from, to),
        healthQueries.metricSamples(db, 'hrv', from, to),
        foodRepository.listBetween(db, eatenAt - 150 * MIN, eatenAt + 150 * MIN),
      ]);
      const events = groupMeals(entries);
      // Il pasto di questa voce: quello che inizia più vicino al suo orario.
      const event = events.length
        ? events.reduce((a, b) => (Math.abs(b.at - eatenAt) < Math.abs(a.at - eatenAt) ? b : a))
        : null;
      const response = event
        ? mealResponse(
            event,
            hr,
            hrv,
            events.map((e) => e.at),
          )
        : null;
      const old = Date.now() - eatenAt > RAW_HR_DAYS * 24 * 60 * MIN;
      if (active) setData({ hr, response, old });
    })();
    return () => {
      active = false;
    };
  }, [eatenAt]);

  if (!data) return null;
  const r = data.response;
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
        <Icon name="heart" color={colors.primary} />
        <AppText variant="headline">{t('food.heart.title')}</AppText>
      </View>
      {!r || r.hrBefore == null || r.hrAfter == null ? (
        <AppText variant="callout" tone="textMuted">
          {data.old ? t('food.heart.tooOld') : t('food.heart.noData')}
        </AppText>
      ) : (
        <>
          <HeartTimeline samples={data.hr} at={r.event.at} />
          <AppText variant="callout">
            {t('food.heart.beforeAfter', {
              before: Math.round(r.hrBefore),
              after: Math.round(r.hrAfter),
              delta: signed(Math.round(r.hrDelta ?? 0)),
            })}
            {r.hrPeak != null ? ` · ${t('food.heart.peak', { value: Math.round(r.hrPeak) })}` : ''}
          </AppText>
          {r.hrvBefore != null && r.hrvAfter != null ? (
            <AppText variant="callout">
              {t('food.heart.hrv', {
                before: Math.round(r.hrvBefore),
                after: Math.round(r.hrvAfter),
                delta: signed(Math.round(r.hrvDelta ?? 0)),
              })}
            </AppText>
          ) : null}
          {r.skip === 'otherMealNear' || r.skip === 'activity' ? (
            <AppText variant="caption" tone="textMuted">
              {t(`food.heart.skip.${r.skip}`)}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="textMuted">
            {t('food.heart.note')}
          </AppText>
        </>
      )}
    </Card>
  );
}

/** Linea del battito con il momento del pasto e le due finestre confrontate. */
function HeartTimeline({ samples, at }: { samples: Sample[]; at: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 150;
  const pad = { l: 34, r: 8, t: 10, b: 22 };
  const [x0, x1] = WINDOW.chart;
  const pts = samples
    .map((s) => ({ m: (s.at - at) / MIN, v: s.value }))
    .filter((p) => p.m >= x0 && p.m <= x1);
  const values = pts.map((p) => p.v);
  const lo = Math.floor((Math.min(...values) - 5) / 5) * 5;
  const hi = Math.ceil((Math.max(...values) + 5) / 5) * 5;
  const w = Math.max(0, width - pad.l - pad.r);
  const h = height - pad.t - pad.b;
  const x = (m: number) => pad.l + ((m - x0) / (x1 - x0)) * w;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * h;
  const band = (from: number, to: number) => (
    <Rect x={x(from)} y={pad.t} width={x(to) - x(from)} height={h} fill={colors.primarySoft} />
  );
  const label = `${t('food.heart.title')}: ${values.length} ${t('food.heart.samples')}, ${lo}–${hi} bpm`;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && pts.length > 0 ? (
        <Svg
          width={width}
          height={height}
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
        >
          {band(WINDOW.hrBefore[0], WINDOW.hrBefore[1])}
          {band(WINDOW.hrAfter[0], WINDOW.hrAfter[1])}
          {[lo, hi].map((v) => (
            <SvgText
              key={v}
              x={pad.l - 6}
              y={y(v) + 4}
              fontSize={11}
              fill={colors.textMuted}
              textAnchor="end"
            >
              {v}
            </SvgText>
          ))}
          {[-60, 0, 60, 120].map((m) => (
            <SvgText
              key={m}
              x={x(m)}
              y={height - 6}
              fontSize={11}
              fill={colors.textMuted}
              textAnchor="middle"
            >
              {m === 0 ? t('food.heart.meal') : `${m > 0 ? '+' : ''}${m / 60} h`}
            </SvgText>
          ))}
          <Line
            x1={x(0)}
            x2={x(0)}
            y1={pad.t}
            y2={pad.t + h}
            stroke={colors.textMuted}
            strokeDasharray="4 4"
          />
          <Polyline
            points={pts.map((p) => `${x(p.m)},${y(p.v)}`).join(' ')}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {pts.length < 40
            ? pts.map((p, i) => (
                <Circle key={i} cx={x(p.m)} cy={y(p.v)} r={2.5} fill={colors.primary} />
              ))
            : null}
        </Svg>
      ) : null}
    </View>
  );
}
