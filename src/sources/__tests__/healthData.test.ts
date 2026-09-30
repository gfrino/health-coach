import { migrate } from '@/db/migrate';
import * as repo from '@/db/repositories/healthDataRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import { generateDemoData } from '../demo/demoData';

jest.mock('@/db/ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

async function setup() {
  const db = createTestDb();
  await migrate(db);
  return db;
}

describe('dati di salute (repository)', () => {
  it('scrive a blocchi (oltre 100 righe) e tiene l’ultima riga per source_id duplicato', async () => {
    const db = await setup();
    const rows = Array.from({ length: 250 }, (_, i) => ({
      type: 'heartRate' as const,
      value: 60 + (i % 10),
      unit: 'bpm',
      startAt: i * 1000,
      endAt: i * 1000,
      source: 'apple_health',
      sourceId: `hr-${i}`,
    }));
    rows.push({ ...rows[0]!, value: 99 });
    expect(await repo.upsertMetrics(db, rows)).toBe(250);
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM metrics', []);
    expect(count?.n).toBe(250);
    const first = await db.getFirstAsync<{ value: number }>(
      "SELECT value FROM metrics WHERE source_id = 'hr-0'",
      [],
    );
    expect(first?.value).toBe(99);
  });

  it('upsert idempotente: risincronizzare non crea duplicati', async () => {
    const db = await setup();
    const row = {
      type: 'steps' as const,
      value: 100,
      unit: 'count',
      startAt: 0,
      endAt: 1,
      source: 'apple_health',
      sourceId: 'daily:x:2026-09-29',
    };
    await repo.upsertMetrics(db, [row]);
    await repo.upsertMetrics(db, [{ ...row, value: 250 }]);
    const r = await db.getAllAsync<{ value: number }>('SELECT value FROM metrics', []);
    expect(r).toEqual([{ value: 250 }]);
  });

  it('cancellazioni dalla sorgente, anche per id con suffisso (pressione)', async () => {
    const db = await setup();
    const m = (sourceId: string) => ({
      type: 'bloodPressureSystolic' as const,
      value: 1,
      unit: 'mmHg',
      startAt: 0,
      endAt: 0,
      source: 'health_connect',
      sourceId,
    });
    await repo.upsertMetrics(db, [m('bp1:sys'), m('bp1:dia'), m('bp2:sys'), m('bp_1%x')]);
    await repo.deleteBySourceIds(db, 'health_connect', ['bp1', 'bp_1%x']);
    const r = await db.getAllAsync<{ source_id: string }>(
      'SELECT source_id FROM metrics ORDER BY source_id',
      [],
    );
    expect(r.map((x) => x.source_id)).toEqual(['bp2:sys']);
  });

  it('stato della sincronizzazione (anchor / token)', async () => {
    const db = await setup();
    await repo.setSyncState(db, 'apple_health', 'HKQuantityTypeIdentifierHeartRate', {
      anchor: 'A1',
      lastSyncedAt: 10,
    });
    await repo.setSyncState(db, 'apple_health', 'HKQuantityTypeIdentifierHeartRate', {
      lastError: 'boom',
    });
    expect(
      await repo.getSyncState(db, 'apple_health', 'HKQuantityTypeIdentifierHeartRate'),
    ).toEqual({ anchor: 'A1', lastSyncedAt: 10, lastError: 'boom' });
    expect(await repo.lastSyncAt(db, 'apple_health')).toBe(10);
  });

  it('dati di esempio: notti, allenamenti e metriche coerenti', async () => {
    const db = await setup();
    const now = new Date(2026, 8, 29, 18, 0).getTime();
    const batch = generateDemoData(30, now);
    await repo.upsertMetrics(db, batch.metrics);
    await repo.upsertWorkouts(db, batch.workouts);
    await repo.upsertSleepSessions(db, batch.sleep);
    const nights = await repo.nightsBetween(db, now - 7 * 86400000, now);
    expect(nights.length).toBeGreaterThanOrEqual(6);
    for (const n of nights) {
      expect(n.asleepMin).toBeGreaterThan(200);
      expect(n.asleepMin).toBeLessThan(600);
    }
    expect((await repo.workoutsBetween(db, now - 7 * 86400000, now)).length).toBeGreaterThan(0);
    expect(await repo.latestMetric(db, 'weight')).not.toBeNull();
    // Stesso seed, stessi dati; risincronizzare non duplica.
    await repo.upsertSleepSessions(db, generateDemoData(30, now).sleep);
    const count = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM sleep_sessions',
      [],
    );
    expect(count?.n).toBe(batch.sleep.length);
  });
});
