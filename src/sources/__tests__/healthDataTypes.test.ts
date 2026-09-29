import appConfig from '../../../app.config';
import { HEALTH_DATA_TYPES, permissionIdentifiers, typesForPlatform } from '../healthDataTypes';

/** record type Health Connect → permesso nel manifest. */
const HC_PERMISSION: Record<string, string> = {
  Steps: 'READ_STEPS',
  Distance: 'READ_DISTANCE',
  FloorsClimbed: 'READ_FLOORS_CLIMBED',
  ActiveCaloriesBurned: 'READ_ACTIVE_CALORIES_BURNED',
  BasalMetabolicRate: 'READ_BASAL_METABOLIC_RATE',
  TotalCaloriesBurned: 'READ_TOTAL_CALORIES_BURNED',
  ExerciseSession: 'READ_EXERCISE',
  HeartRate: 'READ_HEART_RATE',
  RestingHeartRate: 'READ_RESTING_HEART_RATE',
  HeartRateVariabilityRmssd: 'READ_HEART_RATE_VARIABILITY',
  Vo2Max: 'READ_VO2_MAX',
  SleepSession: 'READ_SLEEP',
  Weight: 'READ_WEIGHT',
  Height: 'READ_HEIGHT',
  BodyFat: 'READ_BODY_FAT',
  LeanBodyMass: 'READ_LEAN_BODY_MASS',
  BloodPressure: 'READ_BLOOD_PRESSURE',
  BloodGlucose: 'READ_BLOOD_GLUCOSE',
  OxygenSaturation: 'READ_OXYGEN_SATURATION',
  RespiratoryRate: 'READ_RESPIRATORY_RATE',
  BodyTemperature: 'READ_BODY_TEMPERATURE',
  Nutrition: 'READ_NUTRITION',
  Hydration: 'READ_HYDRATION',
  MenstruationFlow: 'READ_MENSTRUATION',
  MenstruationPeriod: 'READ_MENSTRUATION',
  MindfulnessSession: 'READ_MINDFULNESS',
};

describe('catalogo dei tipi di dato', () => {
  it('ha id univoci', () => {
    const ids = HEALTH_DATA_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ogni record type Health Connect ha il permesso dichiarato nel manifest', () => {
    const manifest = new Set(
      (appConfig({ config: {} } as Parameters<typeof appConfig>[0]).android?.permissions ?? []).map(
        (p) => p.replace('android.permission.health.', ''),
      ),
    );
    for (const recordType of permissionIdentifiers('android')) {
      expect(HC_PERMISSION[recordType]).toBeDefined();
      expect(manifest.has(HC_PERMISSION[recordType] as string)).toBe(true);
    }
    expect(manifest.has('READ_HEALTH_DATA_IN_BACKGROUND')).toBe(true);
    expect(manifest.has('READ_HEALTH_DATA_HISTORY')).toBe(true);
  });

  it('i tipi assenti su una piattaforma vengono semplicemente esclusi', () => {
    expect(typesForPlatform('android').some((t) => t.id === 'bmi')).toBe(false);
    expect(typesForPlatform('ios').some((t) => t.id === 'bmi')).toBe(true);
  });
});
