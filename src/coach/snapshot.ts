import { healthDataRepository, healthQueries, type Db } from '@/db';
import { DAY_MS } from '@/lib/dates';
import { trendOf } from '@/lib/time';

import type { MetricSummary } from './context';

/** Metriche principali riassunte nel contesto (medie 7/30 giorni + trend). Solo aggregati. */
const SNAPSHOT_TYPES: { type: string; label: string }[] = [
  { type: 'steps', label: 'Steps per day' },
  { type: 'activeEnergy', label: 'Active energy per day' },
  { type: 'restingHeartRate', label: 'Resting heart rate' },
  { type: 'hrv', label: 'Heart rate variability (HRV)' },
  { type: 'weight', label: 'Weight' },
  { type: 'oxygenSaturation', label: 'Oxygen saturation' },
  { type: 'bloodPressureSystolic', label: 'Blood pressure systolic' },
  { type: 'bloodPressureDiastolic', label: 'Blood pressure diastolic' },
  { type: 'bloodGlucose', label: 'Blood glucose' },
  { type: 'dietaryEnergy', label: 'Calories eaten per day' },
];

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export interface HealthSnapshot {
  metrics: MetricSummary[];
  anomalies: string[];
}

export async function buildHealthSnapshot(db: Db, now: Date): Promise<HealthSnapshot> {
  const to = now.getTime() + 1;
  const from30 = to - 30 * DAY_MS;
  const cutoff7 = to - 7 * DAY_MS;
  const metrics: MetricSummary[] = [];
  const anomalies: string[] = [];

  for (const { type, label } of SNAPSHOT_TYPES) {
    const { unit, days } = await healthQueries.dailyMetric(db, type, from30, to);
    if (!days.length) continue;
    const last7 = days
      .filter((d) => new Date(`${d.day}T00:00:00`).getTime() >= cutoff7)
      .map((d) => d.value);
    const a7 = avg(last7);
    const a30 = avg(days.map((d) => d.value));
    metrics.push({
      label,
      unit: unit ?? '',
      avg7: r1(a7),
      avg30: r1(a30),
      last: days.at(-1)?.value ?? null,
      trend: trendOf(a7, a30),
    });

    // HRV in calo / frequenza a riposo in salita negli ultimi 5 giorni.
    const last5 = days.slice(-5).map((d) => d.value);
    if (last5.length === 5) {
      const falling = last5.every((v, i) => i === 0 || v <= (last5[i - 1] ?? v));
      const rising = last5.every((v, i) => i === 0 || v >= (last5[i - 1] ?? v));
      if (type === 'hrv' && falling && (last5[0] ?? 0) > (last5[4] ?? 0))
        anomalies.push('HRV has decreased for 5 consecutive days');
      if (type === 'restingHeartRate' && rising && (last5[4] ?? 0) - (last5[0] ?? 0) >= 4) {
        anomalies.push('Resting heart rate has risen for 5 consecutive days');
      }
    }
  }

  const nights = await healthDataRepository.nightsBetween(db, from30, to);
  if (nights.length) {
    const hours = nights.map((n) => n.asleepMin / 60);
    const recent = nights.filter((n) => n.endAt >= cutoff7);
    const h7 = avg(recent.map((n) => n.asleepMin / 60));
    const h30 = avg(hours);
    metrics.push({
      label: 'Sleep per night',
      unit: 'hours',
      avg7: r1(h7),
      avg30: r1(h30),
      last: r1(hours.at(-1) ?? null),
      trend: trendOf(h7, h30),
    });
    const short = recent.filter((n) => n.asleepMin < 360).length;
    if (short >= 3)
      anomalies.push(`${short} of the last ${recent.length} nights had less than 6 hours of sleep`);
  }

  const workouts = await healthDataRepository.workoutsBetween(db, cutoff7, to, 100);
  const workouts30 = await healthDataRepository.workoutsBetween(db, from30, to, 500);
  if (workouts30.length) {
    metrics.push({
      label: 'Workouts per week',
      unit: 'sessions',
      avg7: workouts.length,
      avg30: r1((workouts30.length / 30) * 7),
      last: null,
      trend: trendOf(workouts.length, (workouts30.length / 30) * 7),
    });
  }

  return { metrics, anomalies };
}
