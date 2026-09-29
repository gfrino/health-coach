import {
  hkSleepStage,
  normalizeDailyStatistic,
  normalizeMenstrualSample,
  normalizeMindfulSample,
  normalizeQuantitySample,
  normalizeSleepSample,
  normalizeWorkout,
} from '../normalize/healthKit';
import { SleepStage } from '../model';

const base = (uuid: string, start: string, end = start) => ({
  uuid,
  startDate: new Date(start),
  endDate: new Date(end),
  sourceRevision: { source: { name: 'Apple Watch', bundleIdentifier: 'com.apple.health.X' } },
});

describe('normalizzazione HealthKit', () => {
  it('quantità: unità canonica, percentuali da 0–1 a %, id del campione come source_id', () => {
    const spo2 = normalizeQuantitySample('HKQuantityTypeIdentifierOxygenSaturation', {
      ...base('u1', '2026-09-29T08:00:00Z'),
      quantity: 0.974,
    });
    expect(spo2).toMatchObject({
      type: 'oxygenSaturation',
      value: 97.4,
      unit: '%',
      source: 'apple_health',
      sourceId: 'u1',
    });
    expect(spo2?.metadata).toEqual({ origin: 'com.apple.health.X' });
    const hr = normalizeQuantitySample('HKQuantityTypeIdentifierHeartRate', {
      ...base('u2', '2026-09-29T08:00:00Z'),
      quantity: 61,
    });
    expect(hr).toMatchObject({ type: 'heartRate', value: 61, unit: 'bpm' });
  });

  it('ignora identificatori sconosciuti e valori non numerici', () => {
    expect(
      normalizeQuantitySample('HKQuantityTypeIdentifierNope', {
        ...base('x', '2026-01-01T00:00:00Z'),
        quantity: 1,
      }),
    ).toBeNull();
    expect(
      normalizeQuantitySample('HKQuantityTypeIdentifierHeartRate', {
        ...base('x', '2026-01-01T00:00:00Z'),
        quantity: NaN,
      }),
    ).toBeNull();
  });

  it('statistiche giornaliere: una riga stabile per tipo e giorno', () => {
    const start = new Date(2026, 8, 29, 0, 0, 0);
    const end = new Date(2026, 8, 30, 0, 0, 0);
    const row = normalizeDailyStatistic('HKQuantityTypeIdentifierStepCount', {
      startDate: start,
      endDate: end,
      sumQuantity: { quantity: 8123 },
    });
    expect(row).toMatchObject({
      type: 'steps',
      value: 8123,
      sourceId: 'daily:HKQuantityTypeIdentifierStepCount:2026-09-29',
    });
    expect(
      normalizeDailyStatistic('HKQuantityTypeIdentifierStepCount', {
        startDate: start,
        endDate: end,
      }),
    ).toBeNull();
  });

  it('sonno: codici HealthKit → fasi comuni', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(hkSleepStage)).toEqual([
      SleepStage.InBed,
      SleepStage.Asleep,
      SleepStage.Awake,
      SleepStage.Light,
      SleepStage.Deep,
      SleepStage.REM,
      null,
    ]);
    expect(
      normalizeSleepSample({
        ...base('s1', '2026-09-28T23:00:00Z', '2026-09-28T23:40:00Z'),
        value: 4,
      }),
    ).toMatchObject({
      type: 'sleepStage',
      value: SleepStage.Deep,
    });
  });

  it('mindfulness in minuti e flusso mestruale su scala 0–3', () => {
    expect(
      normalizeMindfulSample(base('m', '2026-09-29T20:00:00Z', '2026-09-29T20:12:30Z')).value,
    ).toBe(12.5);
    expect(
      normalizeMenstrualSample({ ...base('f', '2026-09-29T08:00:00Z'), value: 4 })?.value,
    ).toBe(3);
    expect(
      normalizeMenstrualSample({ ...base('f', '2026-09-29T08:00:00Z'), value: 99 }),
    ).toBeNull();
  });

  it('allenamenti: tipo, durata, energia e distanza convertite', () => {
    const w = normalizeWorkout({
      ...base('w1', '2026-09-29T18:00:00Z', '2026-09-29T18:45:00Z'),
      workoutActivityType: 37,
      duration: { quantity: 45, unit: 'min' },
      totalEnergyBurned: { quantity: 1674, unit: 'kJ' },
      totalDistance: { quantity: 7.5, unit: 'km' },
    });
    expect(w).toMatchObject({
      activityType: 'running',
      durationS: 2700,
      energyKcal: 400.1,
      distanceM: 7500,
      sourceId: 'w1',
    });
    expect(
      normalizeWorkout({
        ...base('w2', '2026-09-29T18:00:00Z', '2026-09-29T18:30:00Z'),
        workoutActivityType: 999,
      }),
    ).toMatchObject({
      activityType: 'other',
      durationS: 1800,
      energyKcal: null,
    });
  });
});
