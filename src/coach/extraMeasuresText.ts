import type { MetricType } from '@/sources/model';

export const EXTRA_MEASURES = [
  'heartRate',
  'vo2max',
  'bodyFat',
  'leanMass',
  'bmi',
  'respiratoryRate',
  'bodyTemperature',
  'restingEnergy',
  'distance',
  'floors',
  'protein',
  'carbs',
  'fat',
  'water',
  'caffeine',
  'mindfulness',
] as const satisfies readonly MetricType[];

export type ExtraMeasureType = (typeof EXTRA_MEASURES)[number];

export interface ExtraMeasure {
  type: ExtraMeasureType;
  unit: string;
  /** Somma giornaliera (passi, acqua…) invece di un valore misurato (VO2 max, grasso…). */
  daily: boolean;
  latest: number;
  latestDay: string;
  avg7: number | null;
  avg30: number | null;
}

export interface CycleInfo {
  /** Primo giorno dell'ultima mestruazione registrata. */
  lastStart: string;
  /** Durata media del ciclo (giorni) se ci sono almeno due inizi. */
  avgLength: number | null;
}

const LABELS: Record<ExtraMeasureType, string> = {
  heartRate: 'Heart rate (daily average)',
  vo2max: 'VO2 max',
  bodyFat: 'Body fat',
  leanMass: 'Lean body mass',
  bmi: 'BMI',
  respiratoryRate: 'Respiratory rate',
  bodyTemperature: 'Body temperature',
  restingEnergy: 'Resting energy',
  distance: 'Distance walked/run/cycled',
  floors: 'Floors climbed',
  protein: 'Protein eaten',
  carbs: 'Carbohydrates eaten',
  fat: 'Fat eaten',
  water: 'Water drunk',
  caffeine: 'Caffeine',
  mindfulness: 'Mindfulness',
};

/** Sezione del prompt: una riga per misura presente (anche nel prompt compatto del telefono). */
export function extraMeasuresSection(
  extras: ExtraMeasure[] | undefined,
  cycle: CycleInfo | null | undefined,
): string | null {
  const lines = (extras ?? []).map((m) => {
    const u = m.unit === 'count' ? '' : ` ${m.unit}`;
    if (m.daily) {
      return `- ${LABELS[m.type]}: ${m.avg7 ?? m.latest}${u}/day (7-day avg), 30-day avg ${m.avg30}${u}/day`;
    }
    const avg30 = m.avg30 != null && m.avg30 !== m.latest ? `, 30-day avg ${m.avg30}${u}` : '';
    return `- ${LABELS[m.type]}: ${m.latest}${u} (${m.latestDay})${avg30}`;
  });
  if (cycle) {
    lines.push(
      `- Menstrual cycle: last period started ${cycle.lastStart}${cycle.avgLength ? `, average cycle ${cycle.avgLength} days` : ''}`,
    );
  }
  return lines.length ? `OTHER MEASUREMENTS (last 30 days)\n${lines.join('\n')}` : null;
}
