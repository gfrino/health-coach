/**
 * Modello normalizzato comune a tutte le sorgenti (Apple Health, Health Connect, integrazioni future).
 * Unità canoniche: le conversioni per l'utente (lb, mi, °F, mmol/L) avvengono solo in visualizzazione.
 */

/** Tipi di metrica salvati nella tabella `metrics`, con unità canonica. */
export const METRIC_UNITS = {
  steps: 'count',
  distance: 'm',
  floors: 'count',
  activeEnergy: 'kcal',
  restingEnergy: 'kcal',
  heartRate: 'bpm',
  restingHeartRate: 'bpm',
  hrv: 'ms',
  vo2max: 'ml/kg/min',
  weight: 'kg',
  height: 'cm',
  bmi: 'kg/m2',
  bodyFat: '%',
  leanMass: 'kg',
  bloodPressureSystolic: 'mmHg',
  bloodPressureDiastolic: 'mmHg',
  bloodGlucose: 'mg/dL',
  oxygenSaturation: '%',
  respiratoryRate: 'breaths/min',
  bodyTemperature: 'degC',
  dietaryEnergy: 'kcal',
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  water: 'ml',
  caffeine: 'mg',
  menstrualFlow: 'level',
  mindfulness: 'min',
  sleepStage: 'stage',
} as const;

export type MetricType = keyof typeof METRIC_UNITS;

/** Metriche cumulative: il valore del giorno è una somma (le altre sono medie/ultimi valori). */
export const CUMULATIVE_METRICS: ReadonlySet<MetricType> = new Set([
  'steps',
  'distance',
  'floors',
  'activeEnergy',
  'restingEnergy',
  'dietaryEnergy',
  'protein',
  'carbs',
  'fat',
  'water',
  'caffeine',
  'mindfulness',
]);

/**
 * Fasi del sonno (codici comuni). Apple Health e Health Connect usano codici diversi:
 * gli adapter li traducono in questi.
 */
export enum SleepStage {
  InBed = 0,
  Asleep = 1, // addormentato, fase non specificata
  Awake = 2,
  Light = 3, // "core" su Apple
  Deep = 4,
  REM = 5,
  OutOfBed = 6,
}

export const ASLEEP_STAGES: ReadonlySet<SleepStage> = new Set([
  SleepStage.Asleep,
  SleepStage.Light,
  SleepStage.Deep,
  SleepStage.REM,
]);

export interface NormalizedMetric {
  type: MetricType;
  value: number;
  unit: string;
  startAt: number;
  endAt: number;
  source: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedWorkout {
  activityType: string;
  startAt: number;
  endAt: number;
  durationS: number | null;
  energyKcal: number | null;
  distanceM: number | null;
  source: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
}

export interface StageInterval {
  stage: SleepStage;
  startAt: number;
  endAt: number;
}

export interface NormalizedSleepSession {
  startAt: number;
  endAt: number;
  inBedS: number | null;
  asleepS: number;
  stages: StageInterval[];
  source: string;
  sourceId: string;
}

export interface NormalizedBatch {
  metrics: NormalizedMetric[];
  workouts: NormalizedWorkout[];
  sleep: NormalizedSleepSession[];
}

export const emptyBatch = (): NormalizedBatch => ({ metrics: [], workouts: [], sleep: [] });

export function mergeBatches(batches: NormalizedBatch[]): NormalizedBatch {
  return {
    metrics: batches.flatMap((b) => b.metrics),
    workouts: batches.flatMap((b) => b.workouts),
    sleep: batches.flatMap((b) => b.sleep),
  };
}
