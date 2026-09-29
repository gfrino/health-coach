import { healthDataRepository, healthQueries, type Db } from '@/db';
import type { NightSummary, WorkoutRow } from '@/db/repositories/healthDataRepository';
import { DAY_MS, localIsoDate } from '@/lib/dates';
import { SleepStage } from '@/sources/model';
import { stageMinutes } from '@/sources/sleep';

export interface Series {
  /** Valori degli ultimi 7 giorni (null = nessun dato), dal più vecchio a oggi. */
  values: (number | null)[];
  avg: number | null;
}

export interface TodayData {
  hasData: boolean;
  steps: number | null;
  activeEnergy: number | null;
  distance: number | null;
  floors: number | null;
  sleep:
    (NightSummary & { deepMin: number; remMin: number; lightMin: number; awakeMin: number }) | null;
  restingHeartRate: { value: number; at: number } | null;
  hrv: { value: number; at: number } | null;
  weight: { value: number; at: number; delta30: number | null } | null;
  oxygenSaturation: { value: number; at: number } | null;
  bloodPressure: { systolic: number; diastolic: number; at: number } | null;
  workouts: WorkoutRow[];
  series: {
    steps: Series;
    sleep: Series;
    restingHeartRate: Series;
    hrv: Series;
    activeEnergy: Series;
  };
}

function lastDays(n: number, now: Date): string[] {
  return Array.from({ length: n }, (_, i) =>
    localIsoDate(new Date(now.getTime() - (n - 1 - i) * DAY_MS)),
  );
}

function toSeries(days: string[], rows: { day: string; value: number }[]): Series {
  const map = new Map(rows.map((r) => [r.day, r.value]));
  const values = days.map((d) => map.get(d) ?? null);
  const present = values.filter((v): v is number => v !== null);
  return {
    values,
    avg: present.length ? present.reduce((a, b) => a + b, 0) / present.length : null,
  };
}

export async function loadToday(db: Db, now = new Date()): Promise<TodayData> {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const t0 = startToday.getTime();
  const end = now.getTime() + 1;
  const from7 = t0 - 6 * DAY_MS;
  const days = lastDays(7, now);
  const today = localIsoDate(now);

  const [
    steps7,
    energy7,
    distance7,
    floors7,
    rhr7,
    hrv7,
    nights,
    workouts,
    rhr,
    hrv,
    weight,
    spo2,
    sys,
    dia,
    hasData,
  ] = await Promise.all([
    healthQueries.dailyMetric(db, 'steps', from7, end),
    healthQueries.dailyMetric(db, 'activeEnergy', from7, end),
    healthQueries.dailyMetric(db, 'distance', t0, end),
    healthQueries.dailyMetric(db, 'floors', t0, end),
    healthQueries.dailyMetric(db, 'restingHeartRate', from7, end),
    healthQueries.dailyMetric(db, 'hrv', from7, end),
    healthDataRepository.nightsBetween(db, from7, end),
    healthDataRepository.workoutsBetween(db, t0 - 6 * DAY_MS, end, 10),
    healthDataRepository.latestMetric(db, 'restingHeartRate'),
    healthDataRepository.latestMetric(db, 'hrv'),
    healthDataRepository.latestMetric(db, 'weight'),
    healthDataRepository.latestMetric(db, 'oxygenSaturation'),
    healthDataRepository.latestMetric(db, 'bloodPressureSystolic'),
    healthDataRepository.latestMetric(db, 'bloodPressureDiastolic'),
    healthDataRepository.hasAnyHealthData(db),
  ]);

  const todayValue = (s: { days: { day: string; value: number }[] }) =>
    s.days.find((d) => d.day === today)?.value ?? null;

  let weightInfo: TodayData['weight'] = null;
  if (weight) {
    const old = await healthQueries.dailyMetric(
      db,
      'weight',
      weight.at - 35 * DAY_MS,
      weight.at - 25 * DAY_MS,
    );
    const ref = old.days.at(0)?.value;
    weightInfo = {
      ...weight,
      delta30: ref != null ? Math.round((weight.value - ref) * 10) / 10 : null,
    };
  }

  const lastNight = nights.filter((n) => n.day === today || n.day === days[5]).at(-1) ?? null;
  const mins = lastNight ? stageMinutes(lastNight.stages) : {};

  return {
    hasData,
    steps: todayValue(steps7),
    activeEnergy: todayValue(energy7),
    distance: todayValue(distance7),
    floors: todayValue(floors7),
    sleep: lastNight
      ? {
          ...lastNight,
          deepMin: mins[SleepStage.Deep] ?? 0,
          remMin: mins[SleepStage.REM] ?? 0,
          lightMin: mins[SleepStage.Light] ?? 0,
          awakeMin: mins[SleepStage.Awake] ?? 0,
        }
      : null,
    restingHeartRate: rhr,
    hrv,
    weight: weightInfo,
    oxygenSaturation: spo2,
    bloodPressure:
      sys && dia && Math.abs(sys.at - dia.at) < 60000
        ? { systolic: sys.value, diastolic: dia.value, at: sys.at }
        : null,
    workouts,
    series: {
      steps: toSeries(days, steps7.days),
      activeEnergy: toSeries(days, energy7.days),
      restingHeartRate: toSeries(days, rhr7.days),
      hrv: toSeries(days, hrv7.days),
      sleep: toSeries(
        days,
        nights.map((n) => ({ day: n.day, value: n.asleepMin / 60 })),
      ),
    },
  };
}
