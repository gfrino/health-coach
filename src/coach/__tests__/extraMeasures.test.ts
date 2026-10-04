import { migrate } from '@/db/migrate';
import * as repo from '@/db/repositories/healthDataRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import { loadCycle, loadExtraMeasures } from '../extraMeasures';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({ healthQueries: jest.requireActual('@/db/repositories/healthQueries') }));

const m = (type: string, day: number, value: number, unit: string) => {
  const t = new Date(2026, 8, day, 9).getTime();
  return {
    type,
    value,
    unit,
    startAt: t,
    endAt: t,
    source: 'apple_health',
    sourceId: `${type}-${day}-${mockSeq++}`,
  };
};

describe('altre misure', () => {
  it('ultimo valore e medie solo delle misure presenti; inizi del ciclo', async () => {
    const db = createTestDb();
    await migrate(db);
    await repo.upsertMetrics(db, [
      m('vo2max', 10, 40, 'ml/kg/min'),
      m('vo2max', 25, 42, 'ml/kg/min'),
      m('water', 28, 1000, 'ml'),
      m('water', 28, 500, 'ml'),
      m('water', 29, 2000, 'ml'),
      ...[2, 3, 4, 30].map((d) => m('menstrualFlow', d, 2, 'level')),
    ] as never);
    const now = new Date(2026, 8, 30, 12);
    const extras = await loadExtraMeasures(db, now);
    expect(extras.map((e) => e.type)).toEqual(['vo2max', 'water']);
    expect(extras[0]).toMatchObject({
      latest: 42,
      latestDay: '2026-09-25',
      daily: false,
      avg30: 41,
    });
    expect(extras[1]).toMatchObject({ latest: 2000, daily: true, avg7: 1750 });
    expect(await loadCycle(db, now)).toEqual({ lastStart: '2026-09-30', avgLength: 28 });
  });
});
