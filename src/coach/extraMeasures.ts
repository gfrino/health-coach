import { healthQueries, type Db } from '@/db';
import { DAY_MS, localIsoDate } from '@/lib/dates';
import { CUMULATIVE_METRICS, METRIC_UNITS } from '@/sources/model';

import { EXTRA_MEASURES, type CycleInfo, type ExtraMeasure } from './extraMeasuresText';

/**
 * Misure di Apple Salute / Health Connect che non hanno una scheda propria in "Oggi" né un posto
 * nel riassunto principale del coach. Solo aggregati (ultimo valore, medie), solo se presenti.
 */
export {
  EXTRA_MEASURES,
  type CycleInfo,
  type ExtraMeasure,
  type ExtraMeasureType,
} from './extraMeasuresText';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export async function loadExtraMeasures(db: Db, now: Date): Promise<ExtraMeasure[]> {
  const to = now.getTime() + 1;
  const from30 = to - 30 * DAY_MS;
  const cut7 = localIsoDate(new Date(to - 7 * DAY_MS));
  const out: ExtraMeasure[] = [];
  for (const type of EXTRA_MEASURES) {
    const { unit, days } = await healthQueries.dailyMetric(db, type, from30, to);
    const last = days.at(-1);
    if (!last) continue;
    out.push({
      type,
      unit: unit ?? METRIC_UNITS[type],
      daily: CUMULATIVE_METRICS.has(type),
      latest: last.value,
      latestDay: last.day,
      avg7: r1(avg(days.filter((d) => d.day > cut7).map((d) => d.value))),
      avg30: r1(avg(days.map((d) => d.value))),
    });
  }
  return out;
}

/** Inizi delle mestruazioni negli ultimi ~6 mesi: un giorno con flusso dopo almeno 3 giorni senza. */
export async function loadCycle(db: Db, now: Date): Promise<CycleInfo | null> {
  const to = now.getTime() + 1;
  const { days } = await healthQueries.dailyMetric(db, 'menstrualFlow', to - 190 * DAY_MS, to);
  const flow = days.filter((d) => d.value > 0).map((d) => d.day);
  const starts: string[] = [];
  for (const day of flow) {
    const prev = starts.at(-1) ?? null;
    const lastFlow = flow[flow.indexOf(day) - 1] ?? null;
    const gap = lastFlow
      ? (new Date(`${day}T12:00:00`).getTime() - new Date(`${lastFlow}T12:00:00`).getTime()) /
        DAY_MS
      : Infinity;
    if (!prev || gap > 3) starts.push(day);
  }
  const lastStart = starts.at(-1);
  if (!lastStart) return null;
  const lengths = starts
    .slice(1)
    .map(
      (s, i) =>
        (new Date(`${s}T12:00:00`).getTime() - new Date(`${starts[i]}T12:00:00`).getTime()) /
        DAY_MS,
    )
    .filter((n) => n >= 15 && n <= 60);
  const a = avg(lengths);
  return { lastStart, avgLength: a == null ? null : Math.round(a) };
}
