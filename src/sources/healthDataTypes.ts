/**
 * Catalogo dei tipi di dato di salute letti in v1.0, con la mappatura su
 * HealthKit (iOS) e Health Connect (Android). Un array vuoto significa
 * "non disponibile su quella piattaforma": il tipo viene semplicemente saltato.
 *
 * Nessun import nativo qui: il file è usato dall'UI dei permessi, dagli adapter e dai test.
 */

import {
  HK_EXTRA_CATEGORIES,
  HK_EXTRA_QUANTITIES,
  HK_STATE_OF_MIND,
  type ExtraGroup,
} from './hkExtra';

export type HealthDataCategory =
  | 'activity'
  | 'heart'
  | 'sleep'
  | 'body'
  | 'vitals'
  | 'nutrition'
  | 'cycle'
  | 'mindfulness'
  | 'environment'
  | 'symptoms';

export type HealthDataTypeId =
  | 'steps'
  | 'distance'
  | 'floors'
  | 'activeEnergy'
  | 'restingEnergy'
  | 'workouts'
  | 'heartRate'
  | 'restingHeartRate'
  | 'hrv'
  | 'vo2max'
  | 'sleep'
  | 'weight'
  | 'height'
  | 'bmi'
  | 'bodyFat'
  | 'leanMass'
  | 'bloodPressure'
  | 'bloodGlucose'
  | 'oxygenSaturation'
  | 'respiratoryRate'
  | 'bodyTemperature'
  | 'nutrition'
  | 'water'
  | 'caffeine'
  | 'menstrualCycle'
  | 'mindfulness'
  | ExtraGroup;

export interface HealthDataType {
  id: HealthDataTypeId;
  category: HealthDataCategory;
  /** Identificatori HealthKit da autorizzare in lettura. */
  healthKit: readonly string[];
  /** Record type di Health Connect da autorizzare in lettura. */
  healthConnect: readonly string[];
}

const BASE_TYPES: readonly HealthDataType[] = [
  // Attività
  {
    id: 'steps',
    category: 'activity',
    healthKit: ['HKQuantityTypeIdentifierStepCount'],
    healthConnect: ['Steps'],
  },
  {
    id: 'distance',
    category: 'activity',
    healthKit: [
      'HKQuantityTypeIdentifierDistanceWalkingRunning',
      'HKQuantityTypeIdentifierDistanceCycling',
    ],
    healthConnect: ['Distance'],
  },
  {
    id: 'floors',
    category: 'activity',
    healthKit: ['HKQuantityTypeIdentifierFlightsClimbed'],
    healthConnect: ['FloorsClimbed'],
  },
  {
    id: 'activeEnergy',
    category: 'activity',
    healthKit: ['HKQuantityTypeIdentifierActiveEnergyBurned'],
    healthConnect: ['ActiveCaloriesBurned'],
  },
  {
    id: 'restingEnergy',
    category: 'activity',
    healthKit: ['HKQuantityTypeIdentifierBasalEnergyBurned'],
    healthConnect: ['BasalMetabolicRate', 'TotalCaloriesBurned'],
  },
  {
    id: 'workouts',
    category: 'activity',
    healthKit: ['HKWorkoutTypeIdentifier'],
    healthConnect: ['ExerciseSession'],
  },

  // Cuore
  {
    id: 'heartRate',
    category: 'heart',
    healthKit: ['HKQuantityTypeIdentifierHeartRate'],
    healthConnect: ['HeartRate'],
  },
  {
    id: 'restingHeartRate',
    category: 'heart',
    healthKit: ['HKQuantityTypeIdentifierRestingHeartRate'],
    healthConnect: ['RestingHeartRate'],
  },
  {
    id: 'hrv',
    category: 'heart',
    healthKit: ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN'],
    healthConnect: ['HeartRateVariabilityRmssd'],
  },
  {
    id: 'vo2max',
    category: 'heart',
    healthKit: ['HKQuantityTypeIdentifierVO2Max'],
    healthConnect: ['Vo2Max'],
  },

  // Sonno
  {
    id: 'sleep',
    category: 'sleep',
    healthKit: ['HKCategoryTypeIdentifierSleepAnalysis'],
    healthConnect: ['SleepSession'],
  },

  // Corpo
  {
    id: 'weight',
    category: 'body',
    healthKit: ['HKQuantityTypeIdentifierBodyMass'],
    healthConnect: ['Weight'],
  },
  {
    id: 'height',
    category: 'body',
    healthKit: ['HKQuantityTypeIdentifierHeight'],
    healthConnect: ['Height'],
  },
  // Health Connect non ha un record BMI: viene calcolato da peso e altezza.
  {
    id: 'bmi',
    category: 'body',
    healthKit: ['HKQuantityTypeIdentifierBodyMassIndex'],
    healthConnect: [],
  },
  {
    id: 'bodyFat',
    category: 'body',
    healthKit: ['HKQuantityTypeIdentifierBodyFatPercentage'],
    healthConnect: ['BodyFat'],
  },
  {
    id: 'leanMass',
    category: 'body',
    healthKit: ['HKQuantityTypeIdentifierLeanBodyMass'],
    healthConnect: ['LeanBodyMass'],
  },

  // Parametri vitali
  {
    id: 'bloodPressure',
    category: 'vitals',
    healthKit: [
      'HKQuantityTypeIdentifierBloodPressureSystolic',
      'HKQuantityTypeIdentifierBloodPressureDiastolic',
    ],
    healthConnect: ['BloodPressure'],
  },
  {
    id: 'bloodGlucose',
    category: 'vitals',
    healthKit: ['HKQuantityTypeIdentifierBloodGlucose'],
    healthConnect: ['BloodGlucose'],
  },
  {
    id: 'oxygenSaturation',
    category: 'vitals',
    healthKit: ['HKQuantityTypeIdentifierOxygenSaturation'],
    healthConnect: ['OxygenSaturation'],
  },
  {
    id: 'respiratoryRate',
    category: 'vitals',
    healthKit: ['HKQuantityTypeIdentifierRespiratoryRate'],
    healthConnect: ['RespiratoryRate'],
  },
  {
    id: 'bodyTemperature',
    category: 'vitals',
    healthKit: ['HKQuantityTypeIdentifierBodyTemperature'],
    healthConnect: ['BodyTemperature'],
  },

  // Nutrizione (caffeina: su Health Connect è un campo del record Nutrition)
  {
    id: 'nutrition',
    category: 'nutrition',
    healthKit: [
      'HKQuantityTypeIdentifierDietaryEnergyConsumed',
      'HKQuantityTypeIdentifierDietaryProtein',
      'HKQuantityTypeIdentifierDietaryCarbohydrates',
      'HKQuantityTypeIdentifierDietaryFatTotal',
    ],
    healthConnect: ['Nutrition'],
  },
  {
    id: 'water',
    category: 'nutrition',
    healthKit: ['HKQuantityTypeIdentifierDietaryWater'],
    healthConnect: ['Hydration'],
  },
  {
    id: 'caffeine',
    category: 'nutrition',
    healthKit: ['HKQuantityTypeIdentifierDietaryCaffeine'],
    healthConnect: ['Nutrition'],
  },

  // Ciclo e mindfulness
  {
    id: 'menstrualCycle',
    category: 'cycle',
    healthKit: ['HKCategoryTypeIdentifierMenstrualFlow'],
    healthConnect: ['MenstruationFlow', 'MenstruationPeriod'],
  },
  {
    id: 'mindfulness',
    category: 'mindfulness',
    healthKit: ['HKCategoryTypeIdentifierMindfulSession'],
    healthConnect: ['MindfulnessSession'],
  },
];

/** Categoria di ogni gruppo del resto di Apple Salute. */
const EXTRA_GROUP_CATEGORY: Record<ExtraGroup, HealthDataCategory> = {
  activityMore: 'activity',
  mobility: 'activity',
  heartMore: 'heart',
  respiratory: 'vitals',
  bodyMore: 'body',
  environment: 'environment',
  nutrients: 'nutrition',
  healthEvents: 'symptoms',
  reproductive: 'cycle',
  symptoms: 'symptoms',
  stateOfMind: 'mindfulness',
};

/**
 * Il resto di Apple Salute (sources/hkExtra), un gruppo per voce. Solo iOS per ora: su Android
 * ogni tipo ha bisogno di un permesso nel manifest, quindi di una build nativa.
 */
const EXTRA_TYPES: HealthDataType[] = (Object.keys(EXTRA_GROUP_CATEGORY) as ExtraGroup[]).map(
  (group) => ({
    id: group,
    category: EXTRA_GROUP_CATEGORY[group],
    healthKit: [
      ...HK_EXTRA_QUANTITIES.filter((x) => x.group === group).map((x) => x.hk),
      ...HK_EXTRA_CATEGORIES.filter((x) => x.group === group).map((x) => x.hk),
      ...(group === 'stateOfMind' ? [HK_STATE_OF_MIND] : []),
    ],
    healthConnect: [],
  }),
);

export const HEALTH_DATA_TYPES: readonly HealthDataType[] = [...BASE_TYPES, ...EXTRA_TYPES];

export const HEALTH_DATA_CATEGORIES: readonly HealthDataCategory[] = [
  'activity',
  'heart',
  'sleep',
  'body',
  'vitals',
  'nutrition',
  'cycle',
  'mindfulness',
  'environment',
  'symptoms',
];

/** Caratteristiche fisse lette da HealthKit per precompilare il profilo. */
export const HEALTHKIT_CHARACTERISTICS = [
  'HKCharacteristicTypeIdentifierBiologicalSex',
  'HKCharacteristicTypeIdentifierDateOfBirth',
] as const;

export function typesForPlatform(platform: 'ios' | 'android'): HealthDataType[] {
  return HEALTH_DATA_TYPES.filter((t) =>
    platform === 'ios' ? t.healthKit.length > 0 : t.healthConnect.length > 0,
  );
}

/** Elenco senza duplicati degli identificatori da richiedere su una piattaforma. */
export function permissionIdentifiers(platform: 'ios' | 'android'): string[] {
  const ids = HEALTH_DATA_TYPES.flatMap((t) =>
    platform === 'ios' ? t.healthKit : t.healthConnect,
  );
  return [...new Set(ids)];
}
