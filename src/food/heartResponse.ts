import type { FoodEntry } from '@/db/repositories/foodRepository';

/**
 * Risposta del cuore ai pasti, calcolata solo sul telefono.
 *
 * Per ogni pasto (le voci registrate a meno di 30 minuti l'una dall'altra sono un pasto solo):
 * - frequenza cardiaca "prima" = media dei campioni da 60 a 5 minuti prima;
 * - "dopo" = media da 30 a 120 minuti dopo; picco = massimo da 0 a 120 minuti dopo;
 * - HRV prima = da 3 ore prima al pasto; dopo = da 30 minuti a 3 ore dopo (l'HRV è rara).
 * Un pasto non si analizza se un altro pasto cade nelle 2 ore prima o dopo (finestre sporche),
 * né se il picco supera di molto il "prima" (probabile attività fisica).
 * La correlazione tra nutrienti e variazione è di Pearson, con intervallo di confidenza al 95%.
 */

export const MIN = 60_000;
export const WINDOW = {
  hrBefore: [-60, -5],
  hrAfter: [30, 120],
  hrPeak: [0, 120],
  hrvBefore: [-180, 0],
  hrvAfter: [30, 180],
  /** Intervallo mostrato nel grafico e incluso nell'esportazione. */
  chart: [-60, 150],
} as const;
const MERGE_GAP = 30 * MIN;
const ISOLATION = 120 * MIN;
const MIN_HR_SAMPLES = 3;
/** Oltre questo aumento il pasto è probabilmente coinciso con un'attività fisica. */
const ACTIVITY_JUMP_BPM = 40;
/** Sotto questo numero di pasti nessuna conclusione. */
export const MIN_MEALS_FOR_CORRELATION = 8;

export interface Sample {
  at: number;
  value: number;
}

export interface MealEvent {
  /** Ora del primo alimento del pasto. */
  at: number;
  entryIds: string[];
  names: string[];
  meal: FoodEntry['meal'];
  calories: number | null;
  carbs: number | null;
  sugar: number | null;
  protein: number | null;
  fat: number | null;
}

export type SkipReason = 'otherMealNear' | 'noHeartData' | 'activity';

export interface MealResponse {
  event: MealEvent;
  hrBefore: number | null;
  hrAfter: number | null;
  hrPeak: number | null;
  /** hrAfter − hrBefore, in bpm. */
  hrDelta: number | null;
  hrvBefore: number | null;
  hrvAfter: number | null;
  hrvDelta: number | null;
  samples: { hrBefore: number; hrAfter: number };
  /** Motivo per cui il pasto non entra nelle correlazioni (null = usato). */
  skip: SkipReason | null;
}

export type Confidence = 'insufficient' | 'unclear' | 'clear';

export interface Correlation {
  nutrient: 'carbs' | 'sugar' | 'calories';
  target: 'hr' | 'hrv';
  n: number;
  r: number | null;
  low: number | null;
  high: number | null;
  confidence: Confidence;
}

export interface HeartMealAnalysis {
  responses: MealResponse[];
  used: number;
  avgHrDelta: number | null;
  avgHrvDelta: number | null;
  correlations: Correlation[];
}

const sum = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};

/** Raggruppa le voci del diario in pasti (voci a meno di 30 minuti l'una dall'altra). */
export function groupMeals(entries: FoodEntry[]): MealEvent[] {
  const sorted = [...entries].sort((a, b) => a.eatenAt - b.eatenAt);
  const groups: FoodEntry[][] = [];
  for (const e of sorted) {
    const last = groups.at(-1);
    const prev = last?.at(-1);
    if (last && prev && e.eatenAt - prev.eatenAt <= MERGE_GAP) last.push(e);
    else groups.push([e]);
  }
  return groups
    .map(([first, ...rest]) => [first!, ...rest])
    .map((g) => ({
      at: g[0]!.eatenAt,
      entryIds: g.map((e) => e.id),
      names: g.map((e) => e.name),
      meal: g[0]!.meal,
      calories: sum(g.map((e) => e.calories)),
      carbs: sum(g.map((e) => e.carbs)),
      sugar: sum(g.map((e) => e.sugar)),
      protein: sum(g.map((e) => e.protein)),
      fat: sum(g.map((e) => e.fat)),
    }));
}

function inWindow(samples: Sample[], at: number, [from, to]: readonly [number, number]) {
  return samples.filter((s) => s.at >= at + from * MIN && s.at <= at + to * MIN);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (x: number | null) => (x == null ? null : Math.round(x * 10) / 10);

/** Risposta di un singolo pasto. `neighbours` sono gli orari degli altri pasti. */
export function mealResponse(
  event: MealEvent,
  hr: Sample[],
  hrv: Sample[],
  neighbours: number[] = [],
): MealResponse {
  const before = inWindow(hr, event.at, WINDOW.hrBefore).map((s) => s.value);
  const after = inWindow(hr, event.at, WINDOW.hrAfter).map((s) => s.value);
  const peakW = inWindow(hr, event.at, WINDOW.hrPeak).map((s) => s.value);
  const hrvB = inWindow(hrv, event.at, WINDOW.hrvBefore).map((s) => s.value);
  const hrvA = inWindow(hrv, event.at, WINDOW.hrvAfter).map((s) => s.value);
  const enough = before.length >= MIN_HR_SAMPLES && after.length >= MIN_HR_SAMPLES;
  const hrBefore = enough ? mean(before) : null;
  const hrAfter = enough ? mean(after) : null;
  const hrPeak = enough && peakW.length ? Math.max(...peakW) : null;
  const hrvBefore = mean(hrvB);
  const hrvAfter = mean(hrvA);
  const near = neighbours.some((t) => t !== event.at && Math.abs(t - event.at) < ISOLATION);
  const skip: SkipReason | null = near
    ? 'otherMealNear'
    : !enough
      ? 'noHeartData'
      : hrPeak != null && hrBefore != null && hrPeak - hrBefore > ACTIVITY_JUMP_BPM
        ? 'activity'
        : null;
  return {
    event,
    hrBefore: round1(hrBefore),
    hrAfter: round1(hrAfter),
    hrPeak: round1(hrPeak),
    hrDelta: hrBefore != null && hrAfter != null ? round1(hrAfter - hrBefore) : null,
    hrvBefore: round1(hrvBefore),
    hrvAfter: round1(hrvAfter),
    hrvDelta: hrvBefore != null && hrvAfter != null ? round1(hrvAfter - hrvBefore) : null,
    samples: { hrBefore: before.length, hrAfter: after.length },
    skip,
  };
}

/** Correlazione di Pearson con intervallo di confidenza al 95% (trasformazione di Fisher). */
export function pearson(
  xs: number[],
  ys: number[],
): { r: number | null; low: number | null; high: number | null } {
  const n = xs.length;
  if (n < 4 || n !== ys.length) return { r: null, low: null, high: null };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  xs.forEach((x, i) => {
    const y = ys[i] ?? my;
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  });
  if (sxx === 0 || syy === 0) return { r: null, low: null, high: null };
  const r = Math.max(-0.999999, Math.min(0.999999, sxy / Math.sqrt(sxx * syy)));
  const z = Math.atanh(r);
  const se = 1 / Math.sqrt(n - 3);
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { r: r2(r), low: r2(Math.tanh(z - 1.96 * se)), high: r2(Math.tanh(z + 1.96 * se)) };
}

function correlation(
  used: MealResponse[],
  nutrient: Correlation['nutrient'],
  target: Correlation['target'],
): Correlation {
  const pairs = used
    .map((m) => [m.event[nutrient], target === 'hr' ? m.hrDelta : m.hrvDelta] as const)
    .filter((p): p is readonly [number, number] => p[0] != null && p[1] != null);
  const { r, low, high } = pearson(
    pairs.map((p) => p[0]),
    pairs.map((p) => p[1]),
  );
  const confidence: Confidence =
    pairs.length < MIN_MEALS_FOR_CORRELATION || r == null
      ? 'insufficient'
      : low != null && high != null && (low > 0 || high < 0)
        ? 'clear'
        : 'unclear';
  return { nutrient, target, n: pairs.length, r, low, high, confidence };
}

/** Analisi completa: risposta di ogni pasto, medie e correlazioni con carboidrati, zuccheri e calorie. */
export function analyzeHeartMeals(
  entries: FoodEntry[],
  hr: Sample[],
  hrv: Sample[],
): HeartMealAnalysis {
  const events = groupMeals(entries);
  const times = events.map((e) => e.at);
  const responses = events.map((e) => mealResponse(e, hr, hrv, times));
  const used = responses.filter((r) => r.skip == null);
  const avg = (xs: (number | null)[]) => round1(mean(xs.filter((x): x is number => x != null)));
  const correlations = (['carbs', 'sugar', 'calories'] as const).flatMap((n) =>
    (['hr', 'hrv'] as const).map((t) => correlation(used, n, t)),
  );
  return {
    responses,
    used: used.length,
    avgHrDelta: avg(used.map((u) => u.hrDelta)),
    avgHrvDelta: avg(used.map((u) => u.hrvDelta)),
    correlations,
  };
}

/** CSV dei campioni intorno a ogni pasto (una riga per campione), per chi vuole analizzarli altrove. */
export function heartMealsCsv(events: MealEvent[], hr: Sample[], hrv: Sample[]): string {
  const esc = (v: string | number | null) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const iso = (ms: number) => new Date(ms).toISOString();
  const rows = [
    'meal_time,meal,foods,calories,carbs_g,sugar_g,protein_g,fat_g,type,sample_time,minutes_from_meal,value',
  ];
  for (const e of events) {
    for (const [type, samples] of [
      ['heart_rate_bpm', hr],
      ['hrv_ms', hrv],
    ] as const) {
      for (const s of inWindow(samples, e.at, WINDOW.chart)) {
        rows.push(
          [
            iso(e.at),
            e.meal,
            e.names.join(' + '),
            e.calories,
            e.carbs,
            e.sugar,
            e.protein,
            e.fat,
            type,
            iso(s.at),
            Math.round((s.at - e.at) / MIN),
            Math.round(s.value * 10) / 10,
          ]
            .map(esc)
            .join(','),
        );
      }
    }
  }
  return rows.join('\n');
}
