import { SleepStage } from '../model';
import { hcSleepStage, normalizeHCDailyGroup, normalizeHCRecord } from '../normalize/healthConnect';

const meta = (id: string) => ({ id, dataOrigin: 'com.samsung.health' });

describe('normalizzazione Health Connect', () => {
  it('frequenza cardiaca: un campione per riga con id derivato', () => {
    const b = normalizeHCRecord({
      recordType: 'HeartRate',
      metadata: meta('hr1'),
      startTime: '2026-09-29T08:00:00Z',
      endTime: '2026-09-29T08:05:00Z',
      samples: [
        { time: '2026-09-29T08:00:00Z', beatsPerMinute: 70 },
        { time: '2026-09-29T08:01:00Z', beatsPerMinute: 72 },
      ],
    });
    expect(b.metrics.map((m) => [m.type, m.value, m.sourceId])).toEqual([
      ['heartRate', 70, 'hr1:0'],
      ['heartRate', 72, 'hr1:1'],
    ]);
  });

  it('pressione: sistolica e diastolica separate; unità canoniche', () => {
    const b = normalizeHCRecord({
      recordType: 'BloodPressure',
      metadata: meta('bp1'),
      time: '2026-09-29T09:00:00Z',
      systolic: { inMillimetersOfMercury: 128 },
      diastolic: { inMillimetersOfMercury: 82 },
    });
    expect(b.metrics.map((m) => [m.type, m.value, m.sourceId])).toEqual([
      ['bloodPressureSystolic', 128, 'bp1:sys'],
      ['bloodPressureDiastolic', 82, 'bp1:dia'],
    ]);
    const h = normalizeHCRecord({
      recordType: 'Height',
      metadata: meta('h'),
      time: '2026-01-01T00:00:00Z',
      height: { inMeters: 1.78 },
    });
    expect(h.metrics[0]).toMatchObject({ type: 'height', value: 178, unit: 'cm' });
    const g = normalizeHCRecord({
      recordType: 'BloodGlucose',
      metadata: meta('g'),
      time: '2026-01-01T00:00:00Z',
      level: { inMilligramsPerDeciliter: 95 },
    });
    expect(g.metrics[0]).toMatchObject({ type: 'bloodGlucose', value: 95, unit: 'mg/dL' });
  });

  it('sessione di sonno: fasi convertite e sonno effettivo senza i risvegli', () => {
    const b = normalizeHCRecord({
      recordType: 'SleepSession',
      metadata: meta('sl1'),
      startTime: '2026-09-28T22:00:00Z',
      endTime: '2026-09-29T06:00:00Z',
      stages: [
        { startTime: '2026-09-28T22:00:00Z', endTime: '2026-09-28T22:30:00Z', stage: 1 },
        { startTime: '2026-09-28T22:30:00Z', endTime: '2026-09-29T02:30:00Z', stage: 4 },
        { startTime: '2026-09-29T02:30:00Z', endTime: '2026-09-29T04:00:00Z', stage: 5 },
        { startTime: '2026-09-29T04:00:00Z', endTime: '2026-09-29T06:00:00Z', stage: 6 },
      ],
    });
    expect(b.sleep[0]).toMatchObject({ asleepS: 7.5 * 3600, inBedS: 8 * 3600, sourceId: 'sl1' });
    expect(b.sleep[0]?.stages.map((s) => s.stage)).toEqual([
      SleepStage.Awake,
      SleepStage.Light,
      SleepStage.Deep,
      SleepStage.REM,
    ]);
    expect(hcSleepStage(99)).toBeNull();
  });

  it('allenamento e record senza id (scartati)', () => {
    const w = normalizeHCRecord({
      recordType: 'ExerciseSession',
      metadata: meta('ex1'),
      startTime: '2026-09-29T18:00:00Z',
      endTime: '2026-09-29T18:40:00Z',
      exerciseType: 56,
    });
    expect(w.workouts[0]).toMatchObject({
      activityType: 'running',
      durationS: 2400,
      source: 'health_connect',
    });
    expect(
      normalizeHCRecord({
        recordType: 'Weight',
        time: '2026-01-01T00:00:00Z',
        weight: { inKilograms: 70 },
      }).metrics,
    ).toEqual([]);
  });

  it('aggregati giornalieri: nutrizione in più metriche, valori nulli ignorati', () => {
    const rows = normalizeHCDailyGroup('Nutrition', {
      startTime: new Date(2026, 8, 29).toISOString(),
      endTime: new Date(2026, 8, 30).toISOString(),
      result: {
        recordType: 'Nutrition',
        ENERGY_TOTAL: { inKilocalories: 2150 },
        PROTEIN_TOTAL: { inGrams: 110 },
        TOTAL_CARBOHYDRATE_TOTAL: { inGrams: 0 },
        CAFFEINE_TOTAL: { inMilligrams: 180 },
      },
    });
    expect(rows.map((r) => [r.type, r.value, r.sourceId])).toEqual([
      ['dietaryEnergy', 2150, 'daily:dietaryEnergy:2026-09-29'],
      ['protein', 110, 'daily:protein:2026-09-29'],
      ['caffeine', 180, 'daily:caffeine:2026-09-29'],
    ]);
  });
});

describe('Health Connect: tipi della build 1.40.0 e dati scritti da AlbA', () => {
  const base = { metadata: { id: 'r1', dataOrigin: 'com.example' } };
  it('legge i tipi nuovi', () => {
    const { normalizeHCRecord } = jest.requireActual(
      '../normalize/healthConnect',
    ) as typeof import('../normalize/healthConnect');
    const speed = normalizeHCRecord({
      ...base,
      recordType: 'Speed',
      startTime: '2026-11-20T08:00:00Z',
      endTime: '2026-11-20T08:30:00Z',
      samples: [
        { time: '2026-11-20T08:00:00Z', speed: { inMetersPerSecond: 1.2 } },
        { time: '2026-11-20T08:10:00Z', speed: { inMetersPerSecond: 1.4 } },
      ],
    });
    expect(speed.metrics[0]).toMatchObject({ type: 'speed', value: 1.3, unit: 'm/s' });
    const bone = normalizeHCRecord({
      ...base,
      recordType: 'BoneMass',
      time: '2026-11-20T08:00:00Z',
      mass: { inKilograms: 3.1 },
    });
    expect(bone.metrics[0]).toMatchObject({ type: 'boneMass', value: 3.1 });
  });

  it('salta i record di AlbA e li toglie dai totali del giorno', () => {
    const { normalizeHCRecord, ownContributions, subtractOwn } = jest.requireActual(
      '../normalize/healthConnect',
    ) as typeof import('../normalize/healthConnect');
    const own = {
      recordType: 'Weight',
      time: '2026-11-20T08:00:00Z',
      weight: { inKilograms: 76 },
      metadata: { id: 'w1', clientRecordId: 'alba-weight-1' },
    };
    expect(normalizeHCRecord(own).metrics).toHaveLength(0);
    const water = ownContributions({
      recordType: 'Hydration',
      startTime: '2026-11-20T10:00:00',
      endTime: '2026-11-20T10:01:00',
      volume: { inMilliliters: 500 },
      metadata: { id: 'h1', clientRecordId: 'alba-water-1' },
    });
    expect(water).toEqual([{ type: 'water', day: '2026-11-20', value: 500 }]);
    const day = new Date('2026-11-20T00:00:00').getTime();
    const rows = [
      {
        type: 'water' as const,
        value: 1500,
        unit: 'ml',
        startAt: day,
        endAt: day + 86_400_000,
        source: 'health_connect',
        sourceId: 'daily:water:2026-11-20',
      },
    ];
    expect(subtractOwn(rows, water)[0]!.value).toBe(1000);
    expect(subtractOwn(rows, [{ type: 'water', day: '2026-11-20', value: 1500 }])).toEqual([]);
  });
});
