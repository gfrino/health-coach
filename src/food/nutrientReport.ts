import type { DailyFoodTotals } from '@/db/repositories/foodRepository';
import { localIsoDate } from '@/lib/dates';

import {
  BASE_NUTRIENTS,
  BASE_UNITS,
  nutrientReference,
  refStatus,
  type NutrientRef,
  type RefStatus,
} from './references';
import { trackerPromptName, type Tracker } from './trackers';

/**
 * Medie dei nutrienti nel diario rispetto ai valori di riferimento, su ieri e sugli ultimi 7, 30
 * e 365 giorni: il coach le usa per accorgersi di possibili carenze o eccessi. I numeri li calcola
 * l'app (mai il modello). Contano solo i giorni con un diario abbastanza completo, altrimenti un
 * giorno con due voci sembrerebbe una carenza.
 */

export const PERIODS = [
  { key: 'day', days: 1, minDays: 1 },
  { key: 'week', days: 7, minDays: 3 },
  { key: 'month', days: 30, minDays: 10 },
  { key: 'year', days: 365, minDays: 30 },
] as const;
export type PeriodKey = (typeof PERIODS)[number]['key'];

export interface NutrientPeriod {
  key: PeriodKey;
  /** Giorni completi con questo nutriente stimato. */
  days: number;
  avg: number;
  /** Percentuale del riferimento (null per l'alcol). */
  pct: number | null;
  status: RefStatus;
}

export interface NutrientTrend {
  id: string;
  /** Nome in inglese per il prompt. */
  name: string;
  unit: string;
  ref: NutrientRef;
  periods: NutrientPeriod[];
}

export interface NutrientReport {
  trends: NutrientTrend[];
  /** Giorni completi per periodo e giorni esclusi perché il diario era troppo scarno. */
  logged: Record<PeriodKey, number>;
  incomplete: number;
}

type DayTotals = DailyFoodTotals;

const BASE_NAMES: Record<string, string> = {
  fiber: 'fiber',
  saturatedFat: 'saturated fat',
  sodium: 'sodium',
};

export const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localIsoDate(d);
};

const round = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

/** Valore di un nutriente in un giorno: null se quel giorno non è stato stimato. */
function valueOf(d: DayTotals, id: string): number | null {
  if ((BASE_NUTRIENTS as readonly string[]).includes(id)) {
    // In un giorno con un diario completo 0 g di fibre o di sodio vuol dire "non stimato".
    const v = d[id as (typeof BASE_NUTRIENTS)[number]];
    return v ? v : null;
  }
  return id in d.extras ? d.extras[id]! : null;
}

export function buildNutrientReport(
  days: DayTotals[],
  trackers: Tracker[],
  profile: { sex: 'female' | 'male' | 'other' | null; age: number | null; kcal: number | null },
  today: string,
): NutrientReport {
  // Giorno "completo": almeno il 60% delle calorie dell'obiettivo (o 1000 kcal senza obiettivo).
  const minKcal = profile.kcal ? profile.kcal * 0.6 : 1000;
  const past = days.filter((d) => d.day < today);
  const complete = past.filter((d) => d.calories >= minKcal);
  const since = (n: number) => addDays(today, -n);

  const nutrients = [
    ...BASE_NUTRIENTS.map((id) => ({ id, name: BASE_NAMES[id]!, unit: BASE_UNITS[id] })),
    ...trackers.map((t) => ({ id: t.id, name: trackerPromptName(t), unit: t.unit })),
  ];
  const trends: NutrientTrend[] = [];
  for (const n of nutrients) {
    const ref = nutrientReference(n.id, profile);
    if (!ref) continue;
    const periods: NutrientPeriod[] = [];
    for (const p of PERIODS) {
      const from = since(p.days);
      const values = complete
        .filter((d) => d.day >= from)
        .map((d) => valueOf(d, n.id))
        .filter((v): v is number => v !== null);
      if (values.length < p.minDays) continue;
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      periods.push({
        key: p.key,
        days: values.length,
        avg: round(avg),
        pct: ref.kind === 'avoid' ? null : Math.round((avg / ref.value) * 100),
        status: refStatus(avg, ref),
      });
    }
    if (periods.length) trends.push({ ...n, ref, periods });
  }
  const logged = Object.fromEntries(
    PERIODS.map((p) => [p.key, complete.filter((d) => d.day >= since(p.days)).length]),
  ) as Record<PeriodKey, number>;
  return { trends, logged, incomplete: past.length - complete.length };
}

const LABEL: Record<PeriodKey, string> = {
  day: 'yesterday',
  week: '7 days',
  month: '30 days',
  year: '365 days',
};

const refText = (r: NutrientRef) =>
  r.kind === 'min'
    ? `${r.source} need ${r.value} ${r.unit}/day`
    : r.kind === 'max'
      ? `${r.source} limit ${r.value} ${r.unit}/day`
      : `${r.source}: no safe amount`;

const flagged = (s: RefStatus) => s === 'low' || s === 'high';

/** Righe per il prompt del coach (in inglese). In modalità compatta solo i nutrienti fuori range. */
export function nutrientLines(report: NutrientReport, compact?: boolean): string | null {
  const period = (t: NutrientTrend, p: NutrientPeriod) =>
    compact
      ? `${LABEL[p.key]} ${p.pct !== null ? `${p.pct}%` : `${p.avg} ${t.unit}`}${flagged(p.status) ? ` ${p.status}` : ''}`
      : `${LABEL[p.key]} ${p.avg} ${t.unit}${p.pct !== null ? ` (${p.pct}%${p.status !== 'ok' ? `, ${p.status}` : ''})` : p.status === 'high' ? ' (above zero)' : ''}`;
  const list = compact
    ? report.trends.filter((t) => t.periods.some((p) => flagged(p.status)))
    : report.trends;
  if (!list.length) return null;
  const lines = list
    .slice(0, compact ? 5 : 20)
    .map(
      (t) => `- ${t.name} (${refText(t.ref)}): ${t.periods.map((p) => period(t, p)).join(' · ')}`,
    );
  const l = report.logged;
  const head = `NUTRIENT CHECK (app-computed daily averages from the food diary vs adult reference values; AI estimates; only days with a fairly complete log count: ${l.day ? 'yesterday, ' : ''}${l.week}/7, ${l.month}/30, ${l.year}/365 days${report.incomplete ? `; ${report.incomplete} sparse days left out` : ''})`;
  return `${head}\n${lines.join('\n')}`;
}
