import { localIsoDate } from '@/lib/dates';

import {
  METRIC_UNITS,
  SleepStage,
  type MetricType,
  type NormalizedMetric,
  type NormalizedWorkout,
  type StageInterval,
} from '../model';

/**
 * Normalizzazione HealthKit → modello comune. Funzioni pure: ricevono oggetti "a forma di"
 * campione HealthKit, così sono testabili senza dispositivo.
 */

export const SOURCE_APPLE_HEALTH = 'apple_health';

export interface HKQuantityMapping {
  type: MetricType;
  /** Unità richiesta a HealthKit (stringa HKUnit). */
  unit: string;
  /** Moltiplicatore verso l'unità canonica (es. HealthKit restituisce le percentuali come 0–1). */
  scale?: number;
  /** Cumulativa: il sync usa le statistiche giornaliere deduplicate tra dispositivi. */
  cumulative?: boolean;
}

/** Tipi quantità HealthKit → metrica normalizzata. */
export const HK_QUANTITY: Record<string, HKQuantityMapping> = {
  HKQuantityTypeIdentifierStepCount: { type: 'steps', unit: 'count', cumulative: true },
  HKQuantityTypeIdentifierDistanceWalkingRunning: { type: 'distance', unit: 'm', cumulative: true },
  HKQuantityTypeIdentifierDistanceCycling: { type: 'distance', unit: 'm', cumulative: true },
  HKQuantityTypeIdentifierFlightsClimbed: { type: 'floors', unit: 'count', cumulative: true },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    type: 'activeEnergy',
    unit: 'kcal',
    cumulative: true,
  },
  HKQuantityTypeIdentifierBasalEnergyBurned: {
    type: 'restingEnergy',
    unit: 'kcal',
    cumulative: true,
  },
  HKQuantityTypeIdentifierHeartRate: { type: 'heartRate', unit: 'count/min' },
  HKQuantityTypeIdentifierRestingHeartRate: { type: 'restingHeartRate', unit: 'count/min' },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: { type: 'hrv', unit: 'ms' },
  HKQuantityTypeIdentifierVO2Max: { type: 'vo2max', unit: 'ml/kg*min' },
  HKQuantityTypeIdentifierBodyMass: { type: 'weight', unit: 'kg' },
  HKQuantityTypeIdentifierHeight: { type: 'height', unit: 'cm' },
  HKQuantityTypeIdentifierBodyMassIndex: { type: 'bmi', unit: 'count' },
  HKQuantityTypeIdentifierBodyFatPercentage: { type: 'bodyFat', unit: '%', scale: 100 },
  HKQuantityTypeIdentifierLeanBodyMass: { type: 'leanMass', unit: 'kg' },
  HKQuantityTypeIdentifierBloodPressureSystolic: { type: 'bloodPressureSystolic', unit: 'mmHg' },
  HKQuantityTypeIdentifierBloodPressureDiastolic: { type: 'bloodPressureDiastolic', unit: 'mmHg' },
  HKQuantityTypeIdentifierBloodGlucose: { type: 'bloodGlucose', unit: 'mg/dL' },
  HKQuantityTypeIdentifierOxygenSaturation: { type: 'oxygenSaturation', unit: '%', scale: 100 },
  HKQuantityTypeIdentifierRespiratoryRate: { type: 'respiratoryRate', unit: 'count/min' },
  HKQuantityTypeIdentifierBodyTemperature: { type: 'bodyTemperature', unit: 'degC' },
  HKQuantityTypeIdentifierDietaryEnergyConsumed: {
    type: 'dietaryEnergy',
    unit: 'kcal',
    cumulative: true,
  },
  HKQuantityTypeIdentifierDietaryProtein: { type: 'protein', unit: 'g', cumulative: true },
  HKQuantityTypeIdentifierDietaryCarbohydrates: { type: 'carbs', unit: 'g', cumulative: true },
  HKQuantityTypeIdentifierDietaryFatTotal: { type: 'fat', unit: 'g', cumulative: true },
  HKQuantityTypeIdentifierDietaryWater: { type: 'water', unit: 'mL', cumulative: true },
  HKQuantityTypeIdentifierDietaryCaffeine: { type: 'caffeine', unit: 'mg', cumulative: true },
};

export const HK_SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
export const HK_MINDFUL = 'HKCategoryTypeIdentifierMindfulSession';
export const HK_MENSTRUAL_FLOW = 'HKCategoryTypeIdentifierMenstrualFlow';

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export interface HKSampleLike {
  uuid: string;
  startDate: Date;
  endDate: Date;
  sourceRevision?: { source?: { name?: string; bundleIdentifier?: string } };
  metadata?: Record<string, unknown>;
}

/**
 * Metadato dei campioni che l'app scrive in Apple Salute dal diario alimentare (valore: id della
 * voce). Rileggendoli si conterebbero due volte: si escludono nelle query e qui.
 */
export const FOOD_ENTRY_METADATA_KEY = 'AlbAFoodEntry';

export const isOwnFoodSample = (s: HKSampleLike): boolean =>
  s.metadata?.[FOOD_ENTRY_METADATA_KEY] !== undefined;

/** Tipi che l'app scrive dal diario alimentare (e che quindi vanno filtrati in lettura). */
export const FOOD_WRITE_TYPES = [
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKQuantityTypeIdentifierDietaryFiber',
  'HKQuantityTypeIdentifierDietarySugar',
  'HKQuantityTypeIdentifierDietaryFatSaturated',
  'HKQuantityTypeIdentifierDietarySodium',
] as const;

const origin = (s: HKSampleLike) => {
  const src = s.sourceRevision?.source;
  return src ? { origin: src.bundleIdentifier ?? src.name } : undefined;
};

export function normalizeQuantitySample(
  identifier: string,
  sample: HKSampleLike & { quantity: number },
): NormalizedMetric | null {
  const m = HK_QUANTITY[identifier];
  if (!m || !Number.isFinite(sample.quantity) || isOwnFoodSample(sample)) return null;
  return {
    type: m.type,
    value: round(sample.quantity * (m.scale ?? 1)),
    unit: unitOf(m.type),
    startAt: sample.startDate.getTime(),
    endAt: sample.endDate.getTime(),
    source: SOURCE_APPLE_HEALTH,
    sourceId: sample.uuid,
    metadata: origin(sample),
  };
}

/** Statistica giornaliera HealthKit (già deduplicata tra iPhone e Watch) → una riga per giorno. */
export function normalizeDailyStatistic(
  identifier: string,
  stat: { startDate?: Date; endDate?: Date; sumQuantity?: { quantity: number } },
): NormalizedMetric | null {
  const m = HK_QUANTITY[identifier];
  if (!m || !stat.startDate || !stat.endDate || !stat.sumQuantity) return null;
  const value = stat.sumQuantity.quantity * (m.scale ?? 1);
  if (!Number.isFinite(value) || value <= 0) return null;
  const day = localIsoDate(stat.startDate);
  return {
    type: m.type,
    value: round(value),
    unit: unitOf(m.type),
    startAt: stat.startDate.getTime(),
    endAt: stat.endDate.getTime(),
    source: SOURCE_APPLE_HEALTH,
    // Una riga per tipo e giorno: la risincronizzazione la sovrascrive.
    sourceId: `daily:${identifier}:${day}`,
    metadata: { aggregate: 'day' },
  };
}

/** Codici HKCategoryValueSleepAnalysis → fasi comuni. */
export function hkSleepStage(value: number): SleepStage | null {
  switch (value) {
    case 0:
      return SleepStage.InBed;
    case 1:
      return SleepStage.Asleep;
    case 2:
      return SleepStage.Awake;
    case 3:
      return SleepStage.Light;
    case 4:
      return SleepStage.Deep;
    case 5:
      return SleepStage.REM;
    default:
      return null;
  }
}

export function normalizeSleepSample(
  sample: HKSampleLike & { value: number },
): NormalizedMetric | null {
  const stage = hkSleepStage(sample.value);
  if (stage === null) return null;
  return {
    type: 'sleepStage',
    value: stage,
    unit: 'stage',
    startAt: sample.startDate.getTime(),
    endAt: sample.endDate.getTime(),
    source: SOURCE_APPLE_HEALTH,
    sourceId: sample.uuid,
    metadata: origin(sample),
  };
}

export function toStageInterval(
  m: Pick<NormalizedMetric, 'value' | 'startAt' | 'endAt'>,
): StageInterval {
  return { stage: m.value as SleepStage, startAt: m.startAt, endAt: m.endAt };
}

export function normalizeMindfulSample(sample: HKSampleLike): NormalizedMetric {
  return {
    type: 'mindfulness',
    value: round((sample.endDate.getTime() - sample.startDate.getTime()) / 60000, 1),
    unit: 'min',
    startAt: sample.startDate.getTime(),
    endAt: sample.endDate.getTime(),
    source: SOURCE_APPLE_HEALTH,
    sourceId: sample.uuid,
  };
}

/** HKCategoryValueMenstrualFlow: 1 non specificato, 2 leggero, 3 medio, 4 abbondante, 5 nessuno. */
export function normalizeMenstrualSample(
  sample: HKSampleLike & { value: number },
): NormalizedMetric | null {
  const level = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 0 }[sample.value];
  if (level === undefined) return null;
  return {
    type: 'menstrualFlow',
    value: level,
    unit: 'level',
    startAt: sample.startDate.getTime(),
    endAt: sample.endDate.getTime(),
    source: SOURCE_APPLE_HEALTH,
    sourceId: sample.uuid,
  };
}

export interface HKWorkoutLike extends HKSampleLike {
  workoutActivityType: number;
  duration?: { quantity: number; unit?: string };
  totalEnergyBurned?: { quantity: number; unit?: string };
  totalDistance?: { quantity: number; unit?: string };
}

/** Nomi dei tipi di allenamento più comuni (HKWorkoutActivityType); gli altri restano "other". */
const HK_ACTIVITY: Record<number, string> = {
  13: 'cycling',
  16: 'elliptical',
  20: 'functionalStrength',
  24: 'hiking',
  35: 'rowing',
  37: 'running',
  46: 'swimming',
  50: 'strength',
  52: 'walking',
  57: 'yoga',
  58: 'barre',
  59: 'coreTraining',
  63: 'hiit',
  64: 'jumpRope',
  66: 'pilates',
  71: 'wheelchairRun',
  73: 'mixedCardio',
  77: 'dance',
  79: 'cooldown',
};

export function normalizeWorkout(w: HKWorkoutLike): NormalizedWorkout {
  const energy = w.totalEnergyBurned;
  const distance = w.totalDistance;
  return {
    activityType: HK_ACTIVITY[w.workoutActivityType] ?? 'other',
    startAt: w.startDate.getTime(),
    endAt: w.endDate.getTime(),
    durationS: w.duration
      ? round(toSeconds(w.duration))
      : round((w.endDate.getTime() - w.startDate.getTime()) / 1000),
    energyKcal: energy ? round(toKcal(energy)) : null,
    distanceM: distance ? round(toMeters(distance)) : null,
    source: SOURCE_APPLE_HEALTH,
    sourceId: w.uuid,
    metadata: { hkActivityType: w.workoutActivityType, ...origin(w) },
  };
}

function toSeconds(q: { quantity: number; unit?: string }) {
  if (q.unit === 'min') return q.quantity * 60;
  if (q.unit === 'hr') return q.quantity * 3600;
  return q.quantity;
}
function toKcal(q: { quantity: number; unit?: string }) {
  if (q.unit === 'kJ') return q.quantity / 4.184;
  if (q.unit === 'cal') return q.quantity / 1000;
  return q.quantity;
}
function toMeters(q: { quantity: number; unit?: string }) {
  if (q.unit === 'km') return q.quantity * 1000;
  if (q.unit === 'mi') return q.quantity * 1609.344;
  return q.quantity;
}

const unitOf = (t: MetricType) => METRIC_UNITS[t];

export { localIsoDate as localDay } from '@/lib/dates';
