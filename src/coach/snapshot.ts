import { healthQueries, type Db } from '@/db';
import { DAY_MS } from '@/lib/dates';

import { trendOf } from '@/lib/time';

import type { MetricSummary } from './context';

/** Metriche principali riassunte nel contesto (medie 7/30 giorni + trend). */
const SNAPSHOT_TYPES: { type: string; label: string }[] = [
  { type: 'steps', label: 'Steps per day' },
  { type: 'activeEnergy', label: 'Active energy per day' },
  { type: 'restingHeartRate', label: 'Resting heart rate' },
  { type: 'hrv', label: 'Heart rate variability' },
  { type: 'weight', label: 'Weight' },
  { type: 'oxygenSaturation', label: 'Oxygen saturation' },
];

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function buildMetricsSnapshot(db: Db, now: Date): Promise<MetricSummary[]> {
  const to = now.getTime();
  const out: MetricSummary[] = [];
  for (const { type, label } of SNAPSHOT_TYPES) {
    const { unit, days } = await healthQueries.dailyMetric(db, type, to - 30 * DAY_MS, to);
    if (!days.length) continue;
    const cutoff = to - 7 * DAY_MS;
    const last7 = days
      .filter((d) => new Date(`${d.day}T00:00:00`).getTime() >= cutoff)
      .map((d) => d.value);
    const a7 = avg(last7);
    const a30 = avg(days.map((d) => d.value));
    out.push({
      label,
      unit: unit ?? '',
      avg7: a7,
      avg30: a30,
      last: days.at(-1)?.value ?? null,
      trend: trendOf(a7, a30),
    });
  }
  return out;
}
