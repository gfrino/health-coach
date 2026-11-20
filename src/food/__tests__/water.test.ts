import { migrate } from '@/db/migrate';
import * as healthDataRepository from '@/db/repositories/healthDataRepository';
import * as healthQueries from '@/db/repositories/healthQueries';
import { createTestDb } from '@/test/nodeSqliteDb';

import { addWater, defaultWaterTarget, undoLastWater, waterOfDay, waterTime } from '../water';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `w-${++mockSeq}` }));
jest.mock('@/db', () => ({
  healthDataRepository: jest.requireActual('@/db/repositories/healthDataRepository'),
}));

const at = (day: string, hh: number) =>
  new Date(`${day}T${String(hh).padStart(2, '0')}:00:00`).getTime();

describe('acqua aggiunta dal diario', () => {
  it('somma con quella di Apple Salute, si annulla e conta per il coach', async () => {
    const db = createTestDb();
    await migrate(db);
    // 300 ml letti da Apple Salute.
    await healthDataRepository.upsertMetrics(db, [
      {
        type: 'water',
        value: 300,
        unit: 'ml',
        startAt: at('2026-11-20', 8),
        endAt: at('2026-11-20', 8),
        source: 'apple_health',
        sourceId: 'hk-1',
      },
    ]);
    await addWater(db, 200, at('2026-11-20', 10));
    await addWater(db, 500, at('2026-11-20', 13));
    await addWater(db, 250, at('2026-11-19', 12)); // altro giorno
    expect(await waterOfDay(db, '2026-11-20')).toEqual({ total: 1000, manual: 700 });

    // Annulla l'ultima aggiunta a mano (500 ml), mai quella di Apple Salute.
    expect(await undoLastWater(db, '2026-11-20')).toBe(true);
    expect(await waterOfDay(db, '2026-11-20')).toEqual({ total: 500, manual: 200 });
    expect(await undoLastWater(db, '2026-11-20')).toBe(true);
    expect(await undoLastWater(db, '2026-11-20')).toBe(false);
    expect(await waterOfDay(db, '2026-11-20')).toEqual({ total: 300, manual: 0 });

    // Stessa misura delle altre: il totale del giorno lo vedono anche coach e Oggi.
    const days = await healthQueries.dailyMetric(
      db,
      'water',
      at('2026-11-19', 0),
      at('2026-11-21', 0),
    );
    expect(days.days).toEqual([
      { day: '2026-11-19', value: 250 },
      { day: '2026-11-20', value: 300 },
    ]);
  });

  it('oggi usa l’ora attuale, un giorno passato mezzogiorno', () => {
    const now = new Date(at('2026-11-20', 9) + 15 * 60_000);
    expect(waterTime('2026-11-20', now)).toBe(now.getTime());
    expect(waterTime('2026-11-18', now)).toBe(at('2026-11-18', 12));
  });
});

describe("obiettivo dell'acqua", () => {
  it("EFSA: circa l'80% dell'acqua totale arriva dalle bevande", () => {
    expect(defaultWaterTarget('female')).toBe(1600);
    expect(defaultWaterTarget('male')).toBe(2000);
    expect(defaultWaterTarget(null)).toBe(2000);
  });
});
