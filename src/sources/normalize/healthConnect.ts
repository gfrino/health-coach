import { localIsoDate } from '@/lib/dates';

import {
  ASLEEP_STAGES,
  emptyBatch,
  METRIC_UNITS,
  SleepStage,
  type MetricType,
  type NormalizedBatch,
  type NormalizedMetric,
  type StageInterval,
} from '../model';

/**
 * Normalizzazione Health Connect → modello comune. Le funzioni accettano i record
 * restituiti da react-native-health-connect (forma "Result", con le unità già convertite)
 * tramite tipi strutturali minimi: sono pure e testabili senza dispositivo.
 */

export const SOURCE_HEALTH_CONNECT = 'health_connect';

/**
 * Prefisso del clientRecordId dei record che AlbA scrive in Health Connect (pasti, acqua, peso,
 * altezza): in lettura si saltano, perché sono già nell'app.
 */
export const OWN_CLIENT_ID_PREFIX = 'alba-';
const isOwnRecord = (r: HCRecord) =>
  String(r.metadata?.clientRecordId ?? '').startsWith(OWN_CLIENT_ID_PREFIX);

/** Media dei campioni di un record (velocità, potenza, cadenza…), una riga per record. */
const sampleAvg = (samples: unknown, read: (s: any) => unknown): number | null => {
  const values = ((samples ?? []) as any[])
    .map(read)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
};

type HCRecord = {
  recordType: string;
  metadata?: { id?: string; dataOrigin?: string; clientRecordId?: string };
} & Record<string, any>;

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const ms = (iso: string) => new Date(iso).getTime();

function metric(
  type: MetricType,
  value: unknown,
  record: HCRecord,
  suffix = '',
  times?: { start: string; end: string },
): NormalizedMetric | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const id = record.metadata?.id;
  if (!id) return null;
  const start = times?.start ?? record.time ?? record.startTime;
  const end = times?.end ?? record.time ?? record.endTime ?? start;
  if (typeof start !== 'string') return null;
  return {
    type,
    value: round(value),
    unit: METRIC_UNITS[type],
    startAt: ms(start),
    endAt: ms(end),
    source: SOURCE_HEALTH_CONNECT,
    sourceId: suffix ? `${id}:${suffix}` : id,
    metadata: record.metadata?.dataOrigin ? { origin: record.metadata.dataOrigin } : undefined,
  };
}

/** Codici SleepSessionRecord.STAGE_TYPE_* → fasi comuni. */
export function hcSleepStage(code: number): SleepStage | null {
  switch (code) {
    case 1: // AWAKE
    case 7: // AWAKE_IN_BED
      return SleepStage.Awake;
    case 2: // SLEEPING
      return SleepStage.Asleep;
    case 3: // OUT_OF_BED
      return SleepStage.OutOfBed;
    case 4: // LIGHT
      return SleepStage.Light;
    case 5: // DEEP
      return SleepStage.Deep;
    case 6: // REM
      return SleepStage.REM;
    default:
      return null;
  }
}

/** ExerciseSessionRecord.EXERCISE_TYPE_* più comuni. */
const HC_EXERCISE: Record<number, string> = {
  8: 'cycling',
  13: 'functionalStrength',
  9: 'cycling',
  16: 'dance',
  25: 'elliptical',
  36: 'hiit',
  37: 'hiking',
  48: 'pilates',
  53: 'rowing',
  56: 'running',
  57: 'running',
  70: 'strength',
  71: 'flexibility',
  73: 'swimming',
  74: 'swimming',
  79: 'walking',
  81: 'strength',
  83: 'yoga',
};

/**
 * Record non cumulativi (i cumulativi — passi, distanza, calorie, acqua, nutrizione —
 * arrivano dagli aggregati giornalieri, già deduplicati tra le app).
 */
export function normalizeHCRecord(record: HCRecord): NormalizedBatch {
  const batch = emptyBatch();
  if (isOwnRecord(record)) return batch;
  const push = (m: NormalizedMetric | null) => m && batch.metrics.push(m);

  switch (record.recordType) {
    case 'HeartRate':
      for (const [i, s] of (
        (record.samples ?? []) as { time: string; beatsPerMinute: number }[]
      ).entries()) {
        push(
          metric('heartRate', s.beatsPerMinute, record, String(i), { start: s.time, end: s.time }),
        );
      }
      break;
    case 'RestingHeartRate':
      push(metric('restingHeartRate', record.beatsPerMinute, record));
      break;
    case 'HeartRateVariabilityRmssd':
      push(metric('hrv', record.heartRateVariabilityMillis, record));
      break;
    case 'Vo2Max':
      push(metric('vo2max', record.vo2MillilitersPerMinuteKilogram, record));
      break;
    case 'Weight':
      push(metric('weight', record.weight?.inKilograms, record));
      break;
    case 'Height':
      push(metric('height', (record.height?.inMeters ?? NaN) * 100, record));
      break;
    case 'BodyFat':
      push(metric('bodyFat', record.percentage, record));
      break;
    case 'LeanBodyMass':
      push(metric('leanMass', record.mass?.inKilograms, record));
      break;
    case 'BloodPressure':
      push(metric('bloodPressureSystolic', record.systolic?.inMillimetersOfMercury, record, 'sys'));
      push(
        metric('bloodPressureDiastolic', record.diastolic?.inMillimetersOfMercury, record, 'dia'),
      );
      break;
    case 'BloodGlucose':
      push(metric('bloodGlucose', record.level?.inMilligramsPerDeciliter, record));
      break;
    case 'OxygenSaturation':
      push(metric('oxygenSaturation', record.percentage, record));
      break;
    case 'RespiratoryRate':
      push(metric('respiratoryRate', record.rate, record));
      break;
    case 'BodyTemperature':
      push(metric('bodyTemperature', record.temperature?.inCelsius, record));
      break;
    case 'MenstruationFlow':
      // FLOW_LIGHT=1, MEDIUM=2, HEAVY=3 (0 = sconosciuto → 1)
      push(metric('menstrualFlow', Math.max(1, Number(record.flow ?? 1)), record));
      break;
    case 'MenstruationPeriod':
      push(metric('menstrualFlow', 1, record));
      break;
    // Il resto di Health Connect (1.40.0)
    case 'BasalBodyTemperature':
      push(metric('basalBodyTemperature', record.temperature?.inCelsius, record));
      break;
    case 'BodyWaterMass':
      push(metric('bodyWaterMass', record.mass?.inKilograms, record));
      break;
    case 'BoneMass':
      push(metric('boneMass', record.mass?.inKilograms, record));
      break;
    case 'SkinTemperature':
      push(
        metric(
          'skinTemperatureDelta',
          sampleAvg(record.deltas, (d) => d.delta?.inCelsius),
          record,
        ),
      );
      break;
    case 'Speed':
      push(
        metric(
          'speed',
          sampleAvg(record.samples, (s) => s.speed?.inMetersPerSecond),
          record,
        ),
      );
      break;
    case 'Power':
      push(
        metric(
          'power',
          sampleAvg(record.samples, (s) => s.power?.inWatts),
          record,
        ),
      );
      break;
    case 'StepsCadence':
      push(
        metric(
          'stepsCadence',
          sampleAvg(record.samples, (s) => s.rate),
          record,
        ),
      );
      break;
    case 'CyclingPedalingCadence':
      push(
        metric(
          'cyclingCadence',
          sampleAvg(record.samples, (s) => s.revolutionsPerMinute),
          record,
        ),
      );
      break;
    case 'CervicalMucus':
      // CervicalMucusAppearance: 1 dry … 6 unusual (0 = sconosciuto, non salvato)
      if (record.appearance) push(metric('cervicalMucus', record.appearance, record));
      break;
    case 'OvulationTest':
      push(metric('ovulationTest', record.result, record));
      break;
    case 'IntermenstrualBleeding':
      push(metric('intermenstrualBleeding', 1, record));
      break;
    case 'SexualActivity':
      push(metric('sexualActivity', 1, record));
      break;
    case 'MindfulnessSession':
      push(metric('mindfulness', (ms(record.endTime) - ms(record.startTime)) / 60000, record));
      break;
    case 'ExerciseSession': {
      const id = record.metadata?.id;
      if (!id) break;
      batch.workouts.push({
        activityType: HC_EXERCISE[record.exerciseType as number] ?? 'other',
        startAt: ms(record.startTime),
        endAt: ms(record.endTime),
        durationS: round((ms(record.endTime) - ms(record.startTime)) / 1000),
        energyKcal: null,
        distanceM: null,
        source: SOURCE_HEALTH_CONNECT,
        sourceId: id,
        metadata: { hcExerciseType: record.exerciseType, title: record.title },
      });
      break;
    }
    case 'SleepSession': {
      const id = record.metadata?.id;
      if (!id) break;
      const stages: StageInterval[] = (
        (record.stages ?? []) as { startTime: string; endTime: string; stage: number }[]
      )
        .map((s) => ({
          stage: hcSleepStage(s.stage),
          startAt: ms(s.startTime),
          endAt: ms(s.endTime),
        }))
        .filter((s): s is StageInterval => s.stage !== null);
      const start = ms(record.startTime);
      const end = ms(record.endTime);
      // Senza fasi, l'intera sessione conta come sonno.
      const asleepMs = stages.length
        ? stages
            .filter((s) => ASLEEP_STAGES.has(s.stage))
            .reduce((a, s) => a + (s.endAt - s.startAt), 0)
        : end - start;
      batch.sleep.push({
        startAt: start,
        endAt: end,
        inBedS: round((end - start) / 1000),
        asleepS: round(asleepMs / 1000),
        stages,
        source: SOURCE_HEALTH_CONNECT,
        sourceId: id,
      });
      break;
    }
    default:
      break;
  }
  return batch;
}

/** Aggregati giornalieri per i tipi cumulativi: record type HC → metrica + campo dell'aggregato. */
export const HC_DAILY_AGGREGATES: {
  recordType: string;
  fields: { type: MetricType; read: (r: HCRecord) => unknown }[];
}[] = [
  { recordType: 'Steps', fields: [{ type: 'steps', read: (r) => r.COUNT_TOTAL }] },
  { recordType: 'Distance', fields: [{ type: 'distance', read: (r) => r.DISTANCE?.inMeters }] },
  {
    recordType: 'FloorsClimbed',
    fields: [{ type: 'floors', read: (r) => r.FLOORS_CLIMBED_TOTAL }],
  },
  {
    recordType: 'ActiveCaloriesBurned',
    fields: [{ type: 'activeEnergy', read: (r) => r.ACTIVE_CALORIES_TOTAL?.inKilocalories }],
  },
  {
    recordType: 'BasalMetabolicRate',
    fields: [{ type: 'restingEnergy', read: (r) => r.BASAL_CALORIES_TOTAL?.inKilocalories }],
  },
  {
    recordType: 'Hydration',
    fields: [{ type: 'water', read: (r) => r.VOLUME_TOTAL?.inMilliliters }],
  },
  {
    recordType: 'Nutrition',
    fields: [
      { type: 'dietaryEnergy', read: (r) => r.ENERGY_TOTAL?.inKilocalories },
      { type: 'protein', read: (r) => r.PROTEIN_TOTAL?.inGrams },
      { type: 'carbs', read: (r) => r.TOTAL_CARBOHYDRATE_TOTAL?.inGrams },
      { type: 'fat', read: (r) => r.TOTAL_FAT_TOTAL?.inGrams },
      { type: 'caffeine', read: (r) => r.CAFFEINE_TOTAL?.inMilligrams },
      // Micronutrienti e altri nutrienti (1.40.0)
      { type: 'fiber', read: (r) => r.DIETARY_FIBER_TOTAL?.inGrams },
      { type: 'sugar', read: (r) => r.SUGAR_TOTAL?.inGrams },
      { type: 'saturatedFat', read: (r) => r.SATURATED_FAT_TOTAL?.inGrams },
      { type: 'monounsaturatedFat', read: (r) => r.MONOUNSATURATED_FAT_TOTAL?.inGrams },
      { type: 'polyunsaturatedFat', read: (r) => r.POLYUNSATURATED_FAT_TOTAL?.inGrams },
      { type: 'cholesterol', read: (r) => r.CHOLESTEROL_TOTAL?.inMilligrams },
      { type: 'sodium', read: (r) => r.SODIUM_TOTAL?.inMilligrams },
      { type: 'potassium', read: (r) => r.POTASSIUM_TOTAL?.inMilligrams },
      { type: 'calcium', read: (r) => r.CALCIUM_TOTAL?.inMilligrams },
      { type: 'iron', read: (r) => r.IRON_TOTAL?.inMilligrams },
      { type: 'magnesium', read: (r) => r.MAGNESIUM_TOTAL?.inMilligrams },
      { type: 'phosphorus', read: (r) => r.PHOSPHORUS_TOTAL?.inMilligrams },
      { type: 'zinc', read: (r) => r.ZINC_TOTAL?.inMilligrams },
      { type: 'copper', read: (r) => r.COPPER_TOTAL?.inMilligrams },
      { type: 'manganese', read: (r) => r.MANGANESE_TOTAL?.inMilligrams },
      { type: 'chloride', read: (r) => r.CHLORIDE_TOTAL?.inMilligrams },
      { type: 'selenium', read: (r) => r.SELENIUM_TOTAL?.inMicrograms },
      { type: 'iodine', read: (r) => r.IODINE_TOTAL?.inMicrograms },
      { type: 'chromium', read: (r) => r.CHROMIUM_TOTAL?.inMicrograms },
      { type: 'molybdenum', read: (r) => r.MOLYBDENUM_TOTAL?.inMicrograms },
      { type: 'vitaminA', read: (r) => r.VITAMIN_A_TOTAL?.inMicrograms },
      { type: 'vitaminB6', read: (r) => r.VITAMIN_B6_TOTAL?.inMilligrams },
      { type: 'vitaminB12', read: (r) => r.VITAMIN_B12_TOTAL?.inMicrograms },
      { type: 'vitaminC', read: (r) => r.VITAMIN_C_TOTAL?.inMilligrams },
      { type: 'vitaminD', read: (r) => r.VITAMIN_D_TOTAL?.inMicrograms },
      { type: 'vitaminE', read: (r) => r.VITAMIN_E_TOTAL?.inMilligrams },
      { type: 'vitaminK', read: (r) => r.VITAMIN_K_TOTAL?.inMicrograms },
      { type: 'thiamin', read: (r) => r.THIAMIN_TOTAL?.inMilligrams },
      { type: 'riboflavin', read: (r) => r.RIBOFLAVIN_TOTAL?.inMilligrams },
      { type: 'niacin', read: (r) => r.NIACIN_TOTAL?.inMilligrams },
      { type: 'pantothenicAcid', read: (r) => r.PANTOTHENIC_ACID_TOTAL?.inMilligrams },
      { type: 'folate', read: (r) => r.FOLATE_TOTAL?.inMicrograms },
      { type: 'biotin', read: (r) => r.BIOTIN_TOTAL?.inMicrograms },
    ],
  },
  {
    recordType: 'ElevationGained',
    fields: [{ type: 'elevationGained', read: (r) => r.ELEVATION_GAINED_TOTAL?.inMeters }],
  },
  {
    recordType: 'WheelchairPushes',
    fields: [{ type: 'pushCount', read: (r) => r.COUNT_TOTAL }],
  },
];

/** Gruppo giornaliero di aggregateGroupByPeriod → righe per giorno (sovrascritte a ogni sync). */
export function normalizeHCDailyGroup(
  recordType: string,
  group: { startTime: string; endTime: string; result: HCRecord },
): NormalizedMetric[] {
  const spec = HC_DAILY_AGGREGATES.find((a) => a.recordType === recordType);
  if (!spec) return [];
  const day = localIsoDate(new Date(group.startTime));
  const out: NormalizedMetric[] = [];
  for (const f of spec.fields) {
    const v = f.read(group.result);
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) continue;
    out.push({
      type: f.type,
      value: round(v),
      unit: METRIC_UNITS[f.type],
      startAt: ms(group.startTime),
      endAt: ms(group.endTime),
      source: SOURCE_HEALTH_CONNECT,
      sourceId: `daily:${f.type}:${day}`,
      metadata: { aggregate: 'day' },
    });
  }
  return out;
}

/** Campi dei record scritti da AlbA che finiscono negli aggregati giornalieri (Nutrition, Hydration). */
const OWN_FIELDS: Record<string, { type: MetricType; read: (r: HCRecord) => unknown }[]> = {
  Hydration: [{ type: 'water', read: (r) => r.volume?.inMilliliters }],
  Nutrition: [
    { type: 'dietaryEnergy', read: (r) => r.energy?.inKilocalories },
    { type: 'protein', read: (r) => r.protein?.inGrams },
    { type: 'carbs', read: (r) => r.totalCarbohydrate?.inGrams },
    { type: 'fat', read: (r) => r.totalFat?.inGrams },
    { type: 'fiber', read: (r) => r.dietaryFiber?.inGrams },
    { type: 'sugar', read: (r) => r.sugar?.inGrams },
    { type: 'saturatedFat', read: (r) => r.saturatedFat?.inGrams },
    { type: 'sodium', read: (r) => r.sodium?.inMilligrams },
    { type: 'caffeine', read: (r) => r.caffeine?.inMilligrams },
    { type: 'cholesterol', read: (r) => r.cholesterol?.inMilligrams },
    { type: 'potassium', read: (r) => r.potassium?.inMilligrams },
    { type: 'magnesium', read: (r) => r.magnesium?.inMilligrams },
    { type: 'calcium', read: (r) => r.calcium?.inMilligrams },
    { type: 'iron', read: (r) => r.iron?.inMilligrams },
    { type: 'vitaminC', read: (r) => r.vitaminC?.inMilligrams },
    { type: 'vitaminD', read: (r) => r.vitaminD?.inMicrograms },
  ],
};

/** Quanto conta un record di AlbA nei totali del giorno (vuoto se il record non è dell'app). */
export function ownContributions(
  record: HCRecord,
): { type: MetricType; day: string; value: number }[] {
  if (!isOwnRecord(record)) return [];
  const start = record.startTime ?? record.time;
  if (typeof start !== 'string') return [];
  const day = localIsoDate(new Date(start));
  return (OWN_FIELDS[record.recordType] ?? [])
    .map((f) => ({ type: f.type, day, value: f.read(record) }))
    .filter(
      (x): x is { type: MetricType; day: string; value: number } =>
        typeof x.value === 'number' && x.value > 0,
    );
}

/** Totali giornalieri meno la parte scritta da AlbA (già nell'app: non si conta due volte). */
export function subtractOwn(
  rows: NormalizedMetric[],
  own: { type: MetricType; day: string; value: number }[],
): NormalizedMetric[] {
  if (!own.length) return rows;
  const minus = new Map<string, number>();
  for (const o of own)
    minus.set(`${o.type}|${o.day}`, (minus.get(`${o.type}|${o.day}`) ?? 0) + o.value);
  return rows
    .map((r) => {
      const day = localIsoDate(new Date(r.startAt));
      const m = minus.get(`${r.type}|${day}`) ?? 0;
      return m ? { ...r, value: round(r.value - m) } : r;
    })
    .filter((r) => r.value > 0.01);
}
