import { migrate } from '@/db/migrate';
import * as repo from '@/db/repositories/healthDataRepository';
import { generateDemoData } from '@/sources/demo/demoData';
import { createTestDb } from '@/test/nodeSqliteDb';

import { loadToday } from '../loadToday';

jest.mock('@/db', () => ({
  healthQueries: jest.requireActual('@/db/repositories/healthQueries'),
  healthDataRepository: jest.requireActual('@/db/repositories/healthDataRepository'),
}));
jest.mock('@/db/ids', () => {
  let n = 0;
  return { newId: () => `id-${++n}` };
});

describe('loadToday', () => {
  it('senza dati: nessuna metrica', async () => {
    const db = createTestDb();
    await migrate(db);
    const d = await loadToday(db, new Date(2026, 8, 29, 18));
    expect(d.hasData).toBe(false);
    expect(d.steps).toBeNull();
    expect(d.series.steps.values).toEqual([null, null, null, null, null, null, null]);
  });

  it('con i dati di esempio: oggi, notte scorsa e serie a 7 giorni', async () => {
    const db = createTestDb();
    await migrate(db);
    const now = new Date(2026, 8, 29, 18);
    const b = generateDemoData(30, now.getTime());
    await repo.upsertMetrics(db, b.metrics);
    await repo.upsertWorkouts(db, b.workouts);
    await repo.upsertSleepSessions(db, b.sleep);
    const d = await loadToday(db, now);
    expect(d.hasData).toBe(true);
    expect(d.steps).toBeGreaterThan(1000);
    expect(d.sleep?.asleepMin).toBeGreaterThan(200);
    expect(d.sleep?.deepMin).toBeGreaterThan(0);
    expect(d.series.steps.values).toHaveLength(7);
    expect(d.series.steps.values.every((v) => v !== null)).toBe(true);
    expect(d.restingHeartRate?.value).toBeGreaterThan(40);
    expect(d.workouts.length).toBeGreaterThan(0);
  });
});
