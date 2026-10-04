import { migrate } from '@/db/migrate';
import * as repo from '@/db/repositories/healthDataRepository';
import * as healthQueries from '@/db/repositories/healthQueries';
import { createTestDb } from '@/test/nodeSqliteDb';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));

const hr = (day: number, hour: number, value: number, id: string) => {
  const t = new Date(2026, 8, day, hour, 0).getTime();
  return {
    type: 'heartRate' as const,
    value,
    unit: 'bpm',
    startAt: t,
    endAt: t,
    source: 'apple_health',
    sourceId: id,
  };
};

describe('compattazione della frequenza cardiaca', () => {
  it('sostituisce i campioni vecchi con un riassunto per giorno, medie invariate', async () => {
    const db = createTestDb();
    await migrate(db);
    await repo.upsertMetrics(db, [
      hr(1, 8, 60, 'a'),
      hr(1, 12, 80, 'b'),
      hr(1, 20, 100, 'c'),
      hr(2, 9, 70, 'd'),
      hr(20, 9, 65, 'e'), // recente: resta com'è
    ]);
    const before = new Date(2026, 8, 10).getTime();
    const from = new Date(2026, 8, 1).getTime();
    const to = new Date(2026, 8, 21).getTime();
    const avgBefore = await healthQueries.dailyMetric(db, 'heartRate', from, to);

    expect(await repo.compactHeartRate(db, before)).toBe(2);
    const rows = await db.getAllAsync<{ source: string; value: number; metadata: string | null }>(
      "SELECT source, value, metadata FROM metrics WHERE type = 'heartRate' ORDER BY start_at",
      [],
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ source: repo.SOURCE_DAILY_SUMMARY, value: 80 });
    expect(JSON.parse(rows[0]!.metadata!)).toEqual({ min: 60, max: 100, n: 3 });
    expect(rows[2]?.source).toBe('apple_health');
    expect(await healthQueries.dailyMetric(db, 'heartRate', from, to)).toEqual(avgBefore);

    // Campione arrivato in ritardo per un giorno già compattato: si unisce al riassunto.
    await repo.upsertMetrics(db, [hr(1, 22, 40, 'f')]);
    expect(await repo.compactHeartRate(db, before)).toBe(1);
    const day1 = await db.getFirstAsync<{ value: number; metadata: string }>(
      "SELECT value, metadata FROM metrics WHERE source_id = 'heartRate:2026-09-01'",
      [],
    );
    expect(day1?.value).toBe(70);
    expect(JSON.parse(day1!.metadata)).toEqual({ min: 40, max: 100, n: 4 });
    expect(await repo.compactHeartRate(db, before)).toBe(0);
  });
});
