import { DAY_MS } from '@/lib/dates';

import {
  METRIC_UNITS,
  SleepStage,
  type MetricType,
  type NormalizedBatch,
  type NormalizedMetric,
} from '../model';

/**
 * Dati di esempio realistici per sviluppo e simulatore (Salute è vuota nel simulatore).
 * Deterministici (stesso seed = stessi dati) e marcati con la sorgente "demo", eliminabile in un colpo.
 */
export const SOURCE_DEMO = 'demo';

function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function generateDemoData(days = 90, now = Date.now(), seed = 42): NormalizedBatch {
  const rnd = prng(seed);
  const between = (a: number, b: number) => a + (b - a) * rnd();
  const batch: NormalizedBatch = { metrics: [], workouts: [], sleep: [] };
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const metric = (
    type: MetricType,
    value: number,
    at: number,
    id: string,
    endAt = at,
  ): NormalizedMetric => ({
    type,
    value: Math.round(value * 10) / 10,
    unit: METRIC_UNITS[type],
    startAt: at,
    endAt,
    source: SOURCE_DEMO,
    sourceId: id,
  });

  let weight = 78.4;
  for (let i = days - 1; i >= 0; i--) {
    const day = today.getTime() - i * DAY_MS;
    const isToday = i === 0;
    const hourNow = new Date(now).getHours() + new Date(now).getMinutes() / 60;
    const dayFraction = isToday ? Math.min(1, hourNow / 21) : 1;
    const weekend = [0, 6].includes(new Date(day).getDay());
    const key = new Date(day).toISOString().slice(0, 10);

    const steps = between(weekend ? 4500 : 6500, weekend ? 12000 : 11000) * dayFraction;
    batch.metrics.push(metric('steps', Math.round(steps), day, `steps:${key}`, day + DAY_MS - 1));
    batch.metrics.push(metric('distance', steps * 0.75, day, `distance:${key}`, day + DAY_MS - 1));
    batch.metrics.push(
      metric(
        'activeEnergy',
        steps * 0.045 + between(80, 200) * dayFraction,
        day,
        `active:${key}`,
        day + DAY_MS - 1,
      ),
    );
    batch.metrics.push(
      metric(
        'floors',
        Math.round(between(3, 18) * dayFraction),
        day,
        `floors:${key}`,
        day + DAY_MS - 1,
      ),
    );

    // Sonno della notte precedente: andata a letto 22:30–00:30, 5h30–8h15.
    const bed = day - between(0.5, 2.5) * 3600000;
    const asleepH = between(5.5, 8.25) - (i % 9 === 3 ? 1.2 : 0);
    const wake = bed + (asleepH + between(0.2, 0.5)) * 3600000;
    const stages = [] as { stage: SleepStage; startAt: number; endAt: number }[];
    let t = bed + between(8, 25) * 60000;
    while (t < wake - 20 * 60000) {
      const cycleEnd = Math.min(wake, t + between(80, 105) * 60000);
      const parts: [SleepStage, number][] = [
        [SleepStage.Light, 0.5],
        [SleepStage.Deep, t - bed < 3 * 3600000 ? 0.25 : 0.1],
        [SleepStage.REM, 0.22],
        [SleepStage.Awake, 0.03],
      ];
      let p = t;
      for (const [stage, frac] of parts) {
        const e = Math.min(cycleEnd, p + (cycleEnd - t) * frac);
        stages.push({ stage, startAt: p, endAt: e });
        p = e;
      }
      t = cycleEnd;
    }
    const asleepMs = stages
      .filter((s) => s.stage !== SleepStage.Awake)
      .reduce((a, s) => a + s.endAt - s.startAt, 0);
    batch.sleep.push({
      startAt: bed,
      endAt: wake,
      inBedS: Math.round((wake - bed) / 1000),
      asleepS: Math.round(asleepMs / 1000),
      stages,
      source: SOURCE_DEMO,
      sourceId: `sleep:${key}`,
    });

    batch.metrics.push(
      metric(
        'restingHeartRate',
        between(57, 64) + (asleepH < 6 ? 3 : 0),
        day + 8 * 3600000,
        `rhr:${key}`,
      ),
    );
    batch.metrics.push(
      metric('hrv', between(38, 62) - (asleepH < 6 ? 8 : 0), day + 7 * 3600000, `hrv:${key}`),
    );
    batch.metrics.push(
      metric('oxygenSaturation', between(95.5, 99), day + 4 * 3600000, `spo2:${key}`),
    );
    batch.metrics.push(
      metric('respiratoryRate', between(13, 16), day + 4 * 3600000, `resp:${key}`),
    );
    for (let h = 8; h <= 20; h += 4) {
      if (isToday && h > hourNow) break;
      batch.metrics.push(metric('heartRate', between(64, 96), day + h * 3600000, `hr:${key}:${h}`));
    }
    if (i % 3 === 0) {
      weight += between(-0.35, 0.25);
      batch.metrics.push(metric('weight', weight, day + 7.5 * 3600000, `weight:${key}`));
    }
    if (i % 7 === 2) {
      batch.metrics.push(
        metric('bloodPressureSystolic', between(118, 134), day + 9 * 3600000, `bps:${key}`),
      );
      batch.metrics.push(
        metric('bloodPressureDiastolic', between(74, 86), day + 9 * 3600000, `bpd:${key}`),
      );
    }
    batch.metrics.push(
      metric('water', between(1200, 2400) * dayFraction, day, `water:${key}`, day + DAY_MS - 1),
    );

    if (!isToday && [1, 3, 6].includes(new Date(day).getDay())) {
      const start = day + (weekend ? 10 : 18.5) * 3600000;
      const running = new Date(day).getDay() !== 3;
      const minutes = between(30, 60);
      batch.workouts.push({
        activityType: running ? 'running' : 'strength',
        startAt: start,
        endAt: start + minutes * 60000,
        durationS: Math.round(minutes * 60),
        energyKcal: Math.round(minutes * (running ? 10.5 : 6.5)),
        distanceM: running ? Math.round(minutes * 170) : null,
        source: SOURCE_DEMO,
        sourceId: `workout:${key}`,
      });
    }
    if (rnd() < 0.35)
      batch.metrics.push(
        metric('mindfulness', Math.round(between(5, 15)), day + 21 * 3600000, `mind:${key}`),
      );
  }
  batch.metrics.push(metric('vo2max', 42.3, today.getTime() - 5 * DAY_MS, 'vo2max'));
  batch.metrics.push(metric('height', 178, today.getTime() - 60 * DAY_MS, 'height'));
  return batch;
}
