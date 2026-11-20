/**
 * Tutto il resto di Apple Salute (oltre ai tipi "storici" in normalize/healthKit): minuti di
 * esercizio, luce del giorno, rumore, camminata, corsa, micronutrienti, sintomi, eventi del
 * cuore, salute riproduttiva… Dati puri, senza import nativi: li usano il sync, i permessi, il
 * coach e i test.
 *
 * - `unit`: unità chiesta a HealthKit. Assente = unità preferita dall'utente (per i tipi con unità
 *   particolari, es. watt o effort score): il valore si salva con l'unità che HealthKit restituisce.
 * - `minIos`: versione di iOS in cui il tipo esiste; prima si salta (HealthKit non lo conosce).
 * - `label`: nome in inglese per il prompt del coach.
 * - Android (Health Connect) ha bisogno di permessi nel manifest: arriva con una build nativa.
 */

/** Unità canonica delle nuove metriche (quelle con unità preferita usano quella di HealthKit). */
export const EXTRA_METRIC_UNITS = {
  // Attività
  exerciseTime: 'min',
  moveTime: 'min',
  standTime: 'min',
  standHours: 'count',
  timeInDaylight: 'min',
  physicalEffort: 'kcal/hr·kg',
  pushCount: 'count',
  distanceWheelchair: 'm',
  distanceSwimming: 'm',
  swimmingStrokes: 'count',
  distanceRowing: 'm',
  distancePaddle: 'm',
  distanceSkating: 'm',
  distanceSnowSports: 'm',
  distanceCrossCountrySkiing: 'm',
  cyclingSpeed: 'm/s',
  cyclingPower: 'W',
  cyclingCadence: 'count/min',
  cyclingFtp: 'W',
  runningSpeed: 'm/s',
  runningPower: 'W',
  runningStrideLength: 'm',
  runningVerticalOscillation: 'cm',
  runningGroundContactTime: 'ms',
  rowingSpeed: 'm/s',
  paddleSpeed: 'm/s',
  crossCountrySkiingSpeed: 'm/s',
  underwaterDepth: 'm',
  waterTemperature: 'degC',
  workoutEffort: 'appleEffortScore',
  estimatedWorkoutEffort: 'appleEffortScore',
  // Mobilità
  walkingSpeed: 'm/s',
  walkingStepLength: 'm',
  walkingAsymmetry: '%',
  walkingDoubleSupport: '%',
  walkingSteadiness: '%',
  stairAscentSpeed: 'm/s',
  stairDescentSpeed: 'm/s',
  sixMinuteWalk: 'm',
  falls: 'count',
  // Cuore
  walkingHeartRate: 'bpm',
  heartRateRecovery: 'bpm',
  hrvRmssd: 'ms',
  afibBurden: '%',
  perfusionIndex: '%',
  // Respirazione
  fev1: 'L',
  forcedVitalCapacity: 'L',
  peakExpiratoryFlow: 'L/min',
  inhalerUsage: 'count',
  sleepBreathingDisturbances: 'count',
  // Corpo
  waistCircumference: 'cm',
  basalBodyTemperature: 'degC',
  wristTemperature: 'degC',
  electrodermalActivity: 'mcS',
  insulinDelivery: 'IU',
  bloodAlcohol: '%',
  alcoholicDrinks: 'count',
  // Ambiente e udito
  environmentalAudio: 'dBASPL',
  headphoneAudio: 'dBASPL',
  soundReduction: 'dBASPL',
  uvExposure: 'count',
  // Micronutrienti e altri nutrienti
  fiber: 'g',
  sugar: 'g',
  saturatedFat: 'g',
  monounsaturatedFat: 'g',
  polyunsaturatedFat: 'g',
  cholesterol: 'mg',
  sodium: 'mg',
  potassium: 'mg',
  calcium: 'mg',
  iron: 'mg',
  magnesium: 'mg',
  phosphorus: 'mg',
  zinc: 'mg',
  copper: 'mg',
  manganese: 'mg',
  chloride: 'mg',
  selenium: 'mcg',
  iodine: 'mcg',
  chromium: 'mcg',
  molybdenum: 'mcg',
  vitaminA: 'mcg',
  vitaminB6: 'mg',
  vitaminB12: 'mcg',
  vitaminC: 'mg',
  vitaminD: 'mcg',
  vitaminE: 'mg',
  vitaminK: 'mcg',
  thiamin: 'mg',
  riboflavin: 'mg',
  niacin: 'mg',
  pantothenicAcid: 'mg',
  folate: 'mcg',
  biotin: 'mcg',
  // Eventi (conteggi al giorno)
  highHeartRateEvent: 'count',
  lowHeartRateEvent: 'count',
  irregularRhythmEvent: 'count',
  lowCardioFitnessEvent: 'count',
  hypertensionEvent: 'count',
  sleepApneaEvent: 'count',
  walkingSteadinessEvent: 'count',
  environmentalAudioEvent: 'count',
  headphoneAudioEvent: 'count',
  handwashing: 'count',
  toothbrushing: 'count',
  sexualActivity: 'count',
  // Salute riproduttiva
  intermenstrualBleeding: 'count',
  ovulationTest: 'level',
  pregnancyTest: 'level',
  progesteroneTest: 'level',
  cervicalMucus: 'level',
  contraceptive: 'level',
  pregnancy: 'count',
  lactation: 'count',
  bleedingDuringPregnancy: 'count',
  bleedingAfterPregnancy: 'count',
  irregularCycles: 'count',
  infrequentCycles: 'count',
  prolongedPeriods: 'count',
  persistentIntermenstrualBleeding: 'count',
  // Sintomi (intensità 0–3)
  symptomAbdominalCramps: 'level',
  symptomAcne: 'level',
  symptomAppetiteChanges: 'level',
  symptomBladderIncontinence: 'level',
  symptomBloating: 'level',
  symptomBreastPain: 'level',
  symptomChestPain: 'level',
  symptomChills: 'level',
  symptomConstipation: 'level',
  symptomCoughing: 'level',
  symptomDiarrhea: 'level',
  symptomDizziness: 'level',
  symptomDrySkin: 'level',
  symptomFainting: 'level',
  symptomFatigue: 'level',
  symptomFever: 'level',
  symptomBodyAche: 'level',
  symptomHairLoss: 'level',
  symptomHeadache: 'level',
  symptomHeartburn: 'level',
  symptomHotFlashes: 'level',
  symptomLossOfSmell: 'level',
  symptomLossOfTaste: 'level',
  symptomLowerBackPain: 'level',
  symptomMemoryLapse: 'level',
  symptomMoodChanges: 'level',
  symptomNausea: 'level',
  symptomNightSweats: 'level',
  symptomPelvicPain: 'level',
  symptomPalpitations: 'level',
  symptomRunnyNose: 'level',
  symptomShortnessOfBreath: 'level',
  symptomSinusCongestion: 'level',
  symptomSkippedHeartbeat: 'level',
  symptomSleepChanges: 'level',
  symptomSoreThroat: 'level',
  symptomVaginalDryness: 'level',
  symptomVomiting: 'level',
  symptomWheezing: 'level',
  // Stato d'animo (Apple: valenza da -1 a +1)
  stateOfMind: 'valence',
  // Solo Health Connect (Android)
  elevationGained: 'm',
  bodyWaterMass: 'kg',
  boneMass: 'kg',
  skinTemperatureDelta: 'degC',
  speed: 'm/s',
  power: 'W',
  stepsCadence: 'count/min',
} as const;

export type ExtraMetricType = keyof typeof EXTRA_METRIC_UNITS;

/** Gruppi per i permessi (uno per voce del catalogo in healthDataTypes). */
export type ExtraGroup =
  | 'activityMore'
  | 'mobility'
  | 'heartMore'
  | 'respiratory'
  | 'bodyMore'
  | 'environment'
  | 'nutrients'
  | 'healthEvents'
  | 'reproductive'
  | 'symptoms'
  | 'stateOfMind';

export interface HKExtraQuantity {
  hk: string;
  type: ExtraMetricType;
  unit?: string;
  scale?: number;
  cumulative?: boolean;
  minIos?: number;
  label: string;
  group: ExtraGroup;
}

/**
 * Come si legge un tipo categoria:
 * - count: ogni campione conta 1 (eventi, sintomi segnati come presenti senza intensità);
 * - severity: intensità del sintomo 0–3 (HKCategoryValueSeverity);
 * - value: valore così com'è (risultati dei test, muco cervicale, contraccettivo);
 * - standHour: 1 per ogni ora in cui ci si è alzati.
 */
export type HKCategoryKind = 'count' | 'severity' | 'value' | 'standHour';

export interface HKExtraCategory {
  hk: string;
  type: ExtraMetricType;
  kind: HKCategoryKind;
  minIos?: number;
  label: string;
  group: ExtraGroup;
}

const Q = 'HKQuantityTypeIdentifier';
const C = 'HKCategoryTypeIdentifier';

const q = (
  id: string,
  type: ExtraMetricType,
  label: string,
  group: ExtraGroup,
  o: Partial<Pick<HKExtraQuantity, 'unit' | 'scale' | 'cumulative' | 'minIos'>> = {},
): HKExtraQuantity => ({ hk: `${Q}${id}`, type, label, group, ...o });

/** Nutriente (somma giornaliera). */
const n = (id: string, type: ExtraMetricType, label: string, unit: string) =>
  q(id, type, label, 'nutrients', { unit, cumulative: true });

export const HK_EXTRA_QUANTITIES: readonly HKExtraQuantity[] = [
  // Attività
  q('AppleExerciseTime', 'exerciseTime', 'Exercise minutes (Apple ring)', 'activityMore', {
    unit: 'min',
    cumulative: true,
  }),
  q('AppleMoveTime', 'moveTime', 'Move minutes', 'activityMore', { unit: 'min', cumulative: true }),
  q('AppleStandTime', 'standTime', 'Stand minutes', 'activityMore', {
    unit: 'min',
    cumulative: true,
  }),
  q('TimeInDaylight', 'timeInDaylight', 'Time in daylight', 'environment', {
    unit: 'min',
    cumulative: true,
    minIos: 17,
  }),
  q('PhysicalEffort', 'physicalEffort', 'Physical effort (METs)', 'activityMore', { minIos: 17 }),
  q('PushCount', 'pushCount', 'Wheelchair pushes', 'activityMore', {
    unit: 'count',
    cumulative: true,
  }),
  q('DistanceWheelchair', 'distanceWheelchair', 'Wheelchair distance', 'activityMore', {
    unit: 'm',
    cumulative: true,
  }),
  q('DistanceSwimming', 'distanceSwimming', 'Swimming distance', 'activityMore', {
    unit: 'm',
    cumulative: true,
  }),
  q('SwimmingStrokeCount', 'swimmingStrokes', 'Swimming strokes', 'activityMore', {
    unit: 'count',
    cumulative: true,
  }),
  q('DistanceRowing', 'distanceRowing', 'Rowing distance', 'activityMore', {
    unit: 'm',
    cumulative: true,
    minIos: 18,
  }),
  q('DistancePaddleSports', 'distancePaddle', 'Paddle sports distance', 'activityMore', {
    unit: 'm',
    cumulative: true,
    minIos: 18,
  }),
  q('DistanceSkatingSports', 'distanceSkating', 'Skating distance', 'activityMore', {
    unit: 'm',
    cumulative: true,
    minIos: 18,
  }),
  q(
    'DistanceDownhillSnowSports',
    'distanceSnowSports',
    'Downhill snow sports distance',
    'activityMore',
    {
      unit: 'm',
      cumulative: true,
    },
  ),
  q(
    'DistanceCrossCountrySkiing',
    'distanceCrossCountrySkiing',
    'Cross-country skiing distance',
    'activityMore',
    { unit: 'm', cumulative: true, minIos: 18 },
  ),
  q('CyclingSpeed', 'cyclingSpeed', 'Cycling speed', 'activityMore', { unit: 'm/s', minIos: 17 }),
  q('CyclingPower', 'cyclingPower', 'Cycling power', 'activityMore', { minIos: 17 }),
  q('CyclingCadence', 'cyclingCadence', 'Cycling cadence', 'activityMore', {
    unit: 'count/min',
    minIos: 17,
  }),
  q('CyclingFunctionalThresholdPower', 'cyclingFtp', 'Cycling FTP', 'activityMore', {
    minIos: 17,
  }),
  q('RunningSpeed', 'runningSpeed', 'Running speed', 'activityMore', { unit: 'm/s' }),
  q('RunningPower', 'runningPower', 'Running power', 'activityMore'),
  q('RunningStrideLength', 'runningStrideLength', 'Running stride length', 'activityMore', {
    unit: 'm',
  }),
  q(
    'RunningVerticalOscillation',
    'runningVerticalOscillation',
    'Running vertical oscillation',
    'activityMore',
    { unit: 'cm' },
  ),
  q(
    'RunningGroundContactTime',
    'runningGroundContactTime',
    'Running ground contact time',
    'activityMore',
    { unit: 'ms' },
  ),
  q('RowingSpeed', 'rowingSpeed', 'Rowing speed', 'activityMore', { unit: 'm/s', minIos: 18 }),
  q('PaddleSportsSpeed', 'paddleSpeed', 'Paddle sports speed', 'activityMore', {
    unit: 'm/s',
    minIos: 18,
  }),
  q(
    'CrossCountrySkiingSpeed',
    'crossCountrySkiingSpeed',
    'Cross-country skiing speed',
    'activityMore',
    {
      unit: 'm/s',
      minIos: 18,
    },
  ),
  q('UnderwaterDepth', 'underwaterDepth', 'Underwater depth', 'activityMore', { unit: 'm' }),
  q('WaterTemperature', 'waterTemperature', 'Water temperature', 'activityMore', { unit: 'degC' }),
  q('WorkoutEffortScore', 'workoutEffort', 'Workout effort (1–10)', 'activityMore', { minIos: 18 }),
  q(
    'EstimatedWorkoutEffortScore',
    'estimatedWorkoutEffort',
    'Estimated workout effort (1–10)',
    'activityMore',
    { minIos: 18 },
  ),
  // Mobilità
  q('WalkingSpeed', 'walkingSpeed', 'Walking speed', 'mobility', { unit: 'm/s' }),
  q('WalkingStepLength', 'walkingStepLength', 'Walking step length', 'mobility', { unit: 'm' }),
  q('WalkingAsymmetryPercentage', 'walkingAsymmetry', 'Walking asymmetry', 'mobility', {
    unit: '%',
    scale: 100,
  }),
  q('WalkingDoubleSupportPercentage', 'walkingDoubleSupport', 'Double support time', 'mobility', {
    unit: '%',
    scale: 100,
  }),
  q('AppleWalkingSteadiness', 'walkingSteadiness', 'Walking steadiness', 'mobility', {
    unit: '%',
    scale: 100,
  }),
  q('StairAscentSpeed', 'stairAscentSpeed', 'Stair speed up', 'mobility', { unit: 'm/s' }),
  q('StairDescentSpeed', 'stairDescentSpeed', 'Stair speed down', 'mobility', { unit: 'm/s' }),
  q('SixMinuteWalkTestDistance', 'sixMinuteWalk', 'Six-minute walk distance', 'mobility', {
    unit: 'm',
  }),
  q('NumberOfTimesFallen', 'falls', 'Falls', 'mobility', { unit: 'count', cumulative: true }),
  // Cuore
  q('WalkingHeartRateAverage', 'walkingHeartRate', 'Walking heart rate average', 'heartMore', {
    unit: 'count/min',
  }),
  q('HeartRateRecoveryOneMinute', 'heartRateRecovery', 'Heart rate recovery (1 min)', 'heartMore', {
    unit: 'count/min',
  }),
  q('HeartRateVariabilityRMSSD', 'hrvRmssd', 'HRV (RMSSD)', 'heartMore', { unit: 'ms' }),
  q('AtrialFibrillationBurden', 'afibBurden', 'AFib history (burden)', 'heartMore', {
    unit: '%',
    scale: 100,
  }),
  q('PeripheralPerfusionIndex', 'perfusionIndex', 'Peripheral perfusion index', 'heartMore', {
    unit: '%',
    scale: 100,
  }),
  // Respirazione
  q('ForcedExpiratoryVolume1', 'fev1', 'FEV1', 'respiratory', { unit: 'L' }),
  q('ForcedVitalCapacity', 'forcedVitalCapacity', 'Forced vital capacity', 'respiratory', {
    unit: 'L',
  }),
  q('PeakExpiratoryFlowRate', 'peakExpiratoryFlow', 'Peak expiratory flow', 'respiratory', {
    unit: 'L/min',
  }),
  q('InhalerUsage', 'inhalerUsage', 'Inhaler puffs', 'respiratory', {
    unit: 'count',
    cumulative: true,
  }),
  q(
    'AppleSleepingBreathingDisturbances',
    'sleepBreathingDisturbances',
    'Breathing disturbances during sleep',
    'respiratory',
    { unit: 'count', minIos: 18 },
  ),
  // Corpo
  q('WaistCircumference', 'waistCircumference', 'Waist circumference', 'bodyMore', { unit: 'cm' }),
  q('BasalBodyTemperature', 'basalBodyTemperature', 'Basal body temperature', 'bodyMore', {
    unit: 'degC',
  }),
  q('AppleSleepingWristTemperature', 'wristTemperature', 'Sleeping wrist temperature', 'bodyMore', {
    unit: 'degC',
  }),
  q('ElectrodermalActivity', 'electrodermalActivity', 'Electrodermal activity', 'bodyMore'),
  q('InsulinDelivery', 'insulinDelivery', 'Insulin delivered', 'bodyMore', {
    unit: 'IU',
    cumulative: true,
  }),
  q('BloodAlcoholContent', 'bloodAlcohol', 'Blood alcohol content', 'bodyMore', {
    unit: '%',
    scale: 100,
  }),
  q('NumberOfAlcoholicBeverages', 'alcoholicDrinks', 'Alcoholic drinks', 'nutrients', {
    unit: 'count',
    cumulative: true,
  }),
  // Ambiente e udito
  q(
    'EnvironmentalAudioExposure',
    'environmentalAudio',
    'Environmental noise level',
    'environment',
    {
      unit: 'dBASPL',
    },
  ),
  q('HeadphoneAudioExposure', 'headphoneAudio', 'Headphone audio level', 'environment', {
    unit: 'dBASPL',
  }),
  q(
    'EnvironmentalSoundReduction',
    'soundReduction',
    'Sound reduction (hearing protection)',
    'environment',
    {
      unit: 'dBASPL',
    },
  ),
  q('UVExposure', 'uvExposure', 'UV index exposure', 'environment', { unit: 'count' }),
  // Nutrienti (da altre app; quelli scritti da AlbA si saltano in lettura)
  n('DietaryFiber', 'fiber', 'Fiber eaten', 'g'),
  n('DietarySugar', 'sugar', 'Sugar eaten', 'g'),
  n('DietaryFatSaturated', 'saturatedFat', 'Saturated fat eaten', 'g'),
  n('DietaryFatMonounsaturated', 'monounsaturatedFat', 'Monounsaturated fat eaten', 'g'),
  n('DietaryFatPolyunsaturated', 'polyunsaturatedFat', 'Polyunsaturated fat eaten', 'g'),
  n('DietaryCholesterol', 'cholesterol', 'Cholesterol eaten', 'mg'),
  n('DietarySodium', 'sodium', 'Sodium eaten', 'mg'),
  n('DietaryPotassium', 'potassium', 'Potassium', 'mg'),
  n('DietaryCalcium', 'calcium', 'Calcium', 'mg'),
  n('DietaryIron', 'iron', 'Iron', 'mg'),
  n('DietaryMagnesium', 'magnesium', 'Magnesium', 'mg'),
  n('DietaryPhosphorus', 'phosphorus', 'Phosphorus', 'mg'),
  n('DietaryZinc', 'zinc', 'Zinc', 'mg'),
  n('DietaryCopper', 'copper', 'Copper', 'mg'),
  n('DietaryManganese', 'manganese', 'Manganese', 'mg'),
  n('DietaryChloride', 'chloride', 'Chloride', 'mg'),
  n('DietarySelenium', 'selenium', 'Selenium', 'mcg'),
  n('DietaryIodine', 'iodine', 'Iodine', 'mcg'),
  n('DietaryChromium', 'chromium', 'Chromium', 'mcg'),
  n('DietaryMolybdenum', 'molybdenum', 'Molybdenum', 'mcg'),
  n('DietaryVitaminA', 'vitaminA', 'Vitamin A', 'mcg'),
  n('DietaryVitaminB6', 'vitaminB6', 'Vitamin B6', 'mg'),
  n('DietaryVitaminB12', 'vitaminB12', 'Vitamin B12', 'mcg'),
  n('DietaryVitaminC', 'vitaminC', 'Vitamin C', 'mg'),
  n('DietaryVitaminD', 'vitaminD', 'Vitamin D', 'mcg'),
  n('DietaryVitaminE', 'vitaminE', 'Vitamin E', 'mg'),
  n('DietaryVitaminK', 'vitaminK', 'Vitamin K', 'mcg'),
  n('DietaryThiamin', 'thiamin', 'Thiamin (B1)', 'mg'),
  n('DietaryRiboflavin', 'riboflavin', 'Riboflavin (B2)', 'mg'),
  n('DietaryNiacin', 'niacin', 'Niacin (B3)', 'mg'),
  n('DietaryPantothenicAcid', 'pantothenicAcid', 'Pantothenic acid (B5)', 'mg'),
  n('DietaryFolate', 'folate', 'Folate', 'mcg'),
  n('DietaryBiotin', 'biotin', 'Biotin', 'mcg'),
];

const c = (
  id: string,
  type: ExtraMetricType,
  kind: HKCategoryKind,
  label: string,
  group: ExtraGroup,
  minIos?: number,
): HKExtraCategory => ({ hk: `${C}${id}`, type, kind, label, group, minIos });

/** Sintomo: intensità 0–3 per giorno (il valore più alto del giorno). */
const s = (id: string, type: ExtraMetricType, label: string) =>
  c(id, type, 'severity', `Symptom: ${label} (0 none – 3 severe)`, 'symptoms');

export const HK_EXTRA_CATEGORIES: readonly HKExtraCategory[] = [
  c('AppleStandHour', 'standHours', 'standHour', 'Stand hours', 'activityMore'),
  // Eventi del cuore e altri avvisi
  c('HighHeartRateEvent', 'highHeartRateEvent', 'count', 'High heart rate alerts', 'healthEvents'),
  c('LowHeartRateEvent', 'lowHeartRateEvent', 'count', 'Low heart rate alerts', 'healthEvents'),
  c(
    'IrregularHeartRhythmEvent',
    'irregularRhythmEvent',
    'count',
    'Irregular rhythm alerts',
    'healthEvents',
  ),
  c(
    'LowCardioFitnessEvent',
    'lowCardioFitnessEvent',
    'count',
    'Low cardio fitness alerts',
    'healthEvents',
  ),
  c(
    'HypertensionEvent',
    'hypertensionEvent',
    'count',
    'Hypertension notifications',
    'healthEvents',
    26,
  ),
  c('SleepApneaEvent', 'sleepApneaEvent', 'count', 'Sleep apnea notifications', 'healthEvents', 18),
  c(
    'AppleWalkingSteadinessEvent',
    'walkingSteadinessEvent',
    'count',
    'Walking steadiness notifications',
    'healthEvents',
  ),
  c(
    'EnvironmentalAudioExposureEvent',
    'environmentalAudioEvent',
    'count',
    'Loud environment alerts',
    'environment',
  ),
  c(
    'HeadphoneAudioExposureEvent',
    'headphoneAudioEvent',
    'count',
    'Loud headphone alerts',
    'environment',
  ),
  c('HandwashingEvent', 'handwashing', 'count', 'Handwashing', 'healthEvents'),
  c('ToothbrushingEvent', 'toothbrushing', 'count', 'Toothbrushing', 'healthEvents'),
  c('SexualActivity', 'sexualActivity', 'count', 'Sexual activity', 'reproductive'),
  // Salute riproduttiva
  c('IntermenstrualBleeding', 'intermenstrualBleeding', 'count', 'Spotting', 'reproductive'),
  c(
    'OvulationTestResult',
    'ovulationTest',
    'value',
    'Ovulation test result (1 negative, 2 LH surge, 3 indeterminate, 4 estrogen surge)',
    'reproductive',
  ),
  c(
    'PregnancyTestResult',
    'pregnancyTest',
    'value',
    'Pregnancy test result (1 negative, 2 positive, 3 indeterminate)',
    'reproductive',
  ),
  c(
    'ProgesteroneTestResult',
    'progesteroneTest',
    'value',
    'Progesterone test result (1 negative, 2 positive, 3 indeterminate)',
    'reproductive',
  ),
  c(
    'CervicalMucusQuality',
    'cervicalMucus',
    'value',
    'Cervical mucus (1 dry … 5 egg white)',
    'reproductive',
  ),
  c('Contraceptive', 'contraceptive', 'value', 'Contraceptive (type code)', 'reproductive'),
  c('Pregnancy', 'pregnancy', 'count', 'Pregnancy logged', 'reproductive'),
  c('Lactation', 'lactation', 'count', 'Lactation logged', 'reproductive'),
  c(
    'BleedingDuringPregnancy',
    'bleedingDuringPregnancy',
    'count',
    'Bleeding during pregnancy',
    'reproductive',
    18,
  ),
  c(
    'BleedingAfterPregnancy',
    'bleedingAfterPregnancy',
    'count',
    'Bleeding after pregnancy',
    'reproductive',
    18,
  ),
  c(
    'IrregularMenstrualCycles',
    'irregularCycles',
    'count',
    'Irregular cycles notification',
    'reproductive',
  ),
  c(
    'InfrequentMenstrualCycles',
    'infrequentCycles',
    'count',
    'Infrequent periods notification',
    'reproductive',
  ),
  c(
    'ProlongedMenstrualPeriods',
    'prolongedPeriods',
    'count',
    'Prolonged periods notification',
    'reproductive',
  ),
  c(
    'PersistentIntermenstrualBleeding',
    'persistentIntermenstrualBleeding',
    'count',
    'Persistent spotting notification',
    'reproductive',
  ),
  // Sintomi
  s('AbdominalCramps', 'symptomAbdominalCramps', 'abdominal cramps'),
  s('Acne', 'symptomAcne', 'acne'),
  s('AppetiteChanges', 'symptomAppetiteChanges', 'appetite changes'),
  s('BladderIncontinence', 'symptomBladderIncontinence', 'bladder incontinence'),
  s('Bloating', 'symptomBloating', 'bloating'),
  s('BreastPain', 'symptomBreastPain', 'breast pain'),
  s('ChestTightnessOrPain', 'symptomChestPain', 'chest tightness or pain'),
  s('Chills', 'symptomChills', 'chills'),
  s('Constipation', 'symptomConstipation', 'constipation'),
  s('Coughing', 'symptomCoughing', 'coughing'),
  s('Diarrhea', 'symptomDiarrhea', 'diarrhea'),
  s('Dizziness', 'symptomDizziness', 'dizziness'),
  s('DrySkin', 'symptomDrySkin', 'dry skin'),
  s('Fainting', 'symptomFainting', 'fainting'),
  s('Fatigue', 'symptomFatigue', 'fatigue'),
  s('Fever', 'symptomFever', 'fever'),
  s('GeneralizedBodyAche', 'symptomBodyAche', 'body ache'),
  s('HairLoss', 'symptomHairLoss', 'hair loss'),
  s('Headache', 'symptomHeadache', 'headache'),
  s('Heartburn', 'symptomHeartburn', 'heartburn'),
  s('HotFlashes', 'symptomHotFlashes', 'hot flashes'),
  s('LossOfSmell', 'symptomLossOfSmell', 'loss of smell'),
  s('LossOfTaste', 'symptomLossOfTaste', 'loss of taste'),
  s('LowerBackPain', 'symptomLowerBackPain', 'lower back pain'),
  s('MemoryLapse', 'symptomMemoryLapse', 'memory lapse'),
  s('MoodChanges', 'symptomMoodChanges', 'mood changes'),
  s('Nausea', 'symptomNausea', 'nausea'),
  s('NightSweats', 'symptomNightSweats', 'night sweats'),
  s('PelvicPain', 'symptomPelvicPain', 'pelvic pain'),
  s('RapidPoundingOrFlutteringHeartbeat', 'symptomPalpitations', 'palpitations'),
  s('RunnyNose', 'symptomRunnyNose', 'runny nose'),
  s('ShortnessOfBreath', 'symptomShortnessOfBreath', 'shortness of breath'),
  s('SinusCongestion', 'symptomSinusCongestion', 'sinus congestion'),
  s('SkippedHeartbeat', 'symptomSkippedHeartbeat', 'skipped heartbeat'),
  s('SleepChanges', 'symptomSleepChanges', 'sleep changes'),
  s('SoreThroat', 'symptomSoreThroat', 'sore throat'),
  s('VaginalDryness', 'symptomVaginalDryness', 'vaginal dryness'),
  s('Vomiting', 'symptomVomiting', 'vomiting'),
  s('Wheezing', 'symptomWheezing', 'wheezing'),
];

/** Stato d'animo (iOS 18): letto e scritto con API proprie. */
export const HK_STATE_OF_MIND = 'HKStateOfMindTypeIdentifier';
export const STATE_OF_MIND_MIN_IOS = 18;

/** Metriche che esistono solo in Health Connect (Android), con il nome per il coach. */
export const HC_ONLY_LABELS: Readonly<Partial<Record<ExtraMetricType, string>>> = {
  elevationGained: 'Elevation gained',
  bodyWaterMass: 'Body water mass',
  boneMass: 'Bone mass',
  skinTemperatureDelta: 'Skin temperature change from baseline',
  speed: 'Speed (walking/running)',
  power: 'Power (workouts)',
  stepsCadence: 'Steps cadence',
};

/** Metriche che si sommano nel giorno (le altre: media; i sintomi: il valore più alto). */
export const EXTRA_CUMULATIVE: ReadonlySet<ExtraMetricType> = new Set<ExtraMetricType>([
  'elevationGained',
  ...HK_EXTRA_QUANTITIES.filter((x) => x.cumulative).map((x) => x.type),
  ...HK_EXTRA_CATEGORIES.filter((x) => x.kind === 'count' || x.kind === 'standHour').map(
    (x) => x.type,
  ),
]);

/** Nome in inglese per il coach, per ogni nuova metrica. */
export const EXTRA_LABELS: Readonly<Record<string, string>> = Object.fromEntries([
  ...HK_EXTRA_QUANTITIES.map((x) => [x.type, x.label] as const),
  ...HK_EXTRA_CATEGORIES.map((x) => [x.type, x.label] as const),
  ['stateOfMind', 'State of mind (Apple, -1 very unpleasant … +1 very pleasant)'] as const,
  ...Object.entries(HC_ONLY_LABELS),
]);

/** Il tipo esiste nella versione di iOS indicata? */
export const availableOn = (minIos: number | undefined, iosMajor: number) =>
  !minIos || iosMajor >= minIos;

/** Valore di un campione categoria secondo il tipo di lettura (null = da non salvare). */
export function categoryValue(kind: HKCategoryKind, raw: number): number | null {
  switch (kind) {
    case 'count':
      return 1;
    case 'standHour':
      // HKCategoryValueAppleStandHour: 0 = in piedi, 1 = inattivo.
      return raw === 0 ? 1 : 0;
    case 'severity':
      // HKCategoryValueSeverity: 0 non specificata (presente), 1 assente, 2 lieve, 3 moderata, 4 grave.
      return ({ 0: 1, 1: 0, 2: 1, 3: 2, 4: 3 } as Record<number, number>)[raw] ?? null;
    case 'value':
      return Number.isFinite(raw) ? raw : null;
  }
}
