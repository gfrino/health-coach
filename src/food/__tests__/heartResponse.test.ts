import { migrate } from '@/db/migrate';
import { createEntry, listBetween, type FoodEntry } from '@/db/repositories/foodRepository';
import { upsertMetrics } from '@/db/repositories/healthDataRepository';
import { metricSamples } from '@/db/repositories/healthQueries';
import { parseTime } from '@/lib/time';
import { createTestDb } from '@/test/nodeSqliteDb';

import { atTime, timeOf } from '../days';

import {
  analyzeHeartMeals,
  groupMeals,
  heartMealsCsv,
  mealResponse,
  MIN,
  pearson,
  type Sample,
} from '../heartResponse';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));

const T0 = new Date('2026-11-20T12:00:00').getTime();

const entry = (id: string, at: number, over: Partial<FoodEntry> = {}): FoodEntry => ({
  id,
  day: '2026-11-20',
  eatenAt: at,
  meal: 'lunch',
  name: id,
  quantity: null,
  calories: 500,
  protein: 20,
  carbs: 60,
  fat: 15,
  fiber: null,
  sugar: 10,
  saturatedFat: null,
  sodium: null,
  extras: null,
  source: 'user',
  recipeId: null,
  healthSamples: null,
  createdAt: at,
  updatedAt: at,
  ...over,
});

/** Frequenza cardiaca ogni 5 minuti: `before` prima del pasto, `after` da 10 minuti dopo. */
function hrAround(at: number, before: number, after: number): Sample[] {
  const out: Sample[] = [];
  for (let m = -90; m <= 180; m += 5)
    out.push({ at: at + m * MIN, value: m < 10 ? before : after });
  return out;
}

describe('risposta del cuore ai pasti', () => {
  it('raggruppa le voci a meno di 30 minuti in un pasto e somma i nutrienti', () => {
    const g = groupMeals([
      entry('pasta', T0, { carbs: 70 }),
      entry('insalata', T0 + 10 * MIN, { carbs: 5 }),
      entry('caffè', T0 + 3 * 60 * MIN, { carbs: 0 }),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0]!.names).toEqual(['pasta', 'insalata']);
    expect(g[0]!.carbs).toBe(75);
  });

  it('calcola prima, dopo e variazione', () => {
    const ev = groupMeals([entry('a', T0)])[0]!;
    const r = mealResponse(ev, hrAround(T0, 64, 74), []);
    expect(r.hrBefore).toBe(64);
    expect(r.hrAfter).toBe(74);
    expect(r.hrDelta).toBe(10);
    expect(r.skip).toBeNull();
  });

  it('esclude i pasti senza dati, con un altro pasto vicino o con attività fisica', () => {
    const ev = groupMeals([entry('a', T0)])[0]!;
    expect(mealResponse(ev, [], []).skip).toBe('noHeartData');
    expect(mealResponse(ev, hrAround(T0, 64, 74), [], [T0, T0 + 90 * MIN]).skip).toBe(
      'otherMealNear',
    );
    expect(mealResponse(ev, hrAround(T0, 64, 130), []).skip).toBe('activity');
  });

  it('Pearson con intervallo di confidenza', () => {
    const p = pearson([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [2, 4, 5, 8, 10, 12, 13, 16, 18, 20]);
    expect(p.r).toBeGreaterThan(0.99);
    expect(p.low!).toBeGreaterThan(0.9);
    expect(pearson([1, 2, 3], [1, 2, 3]).r).toBeNull();
    expect(pearson([1, 1, 1, 1], [1, 2, 3, 4]).r).toBeNull();
  });

  it('correlazione chiara solo con abbastanza pasti', () => {
    const day = 24 * 60 * MIN;
    const entries: FoodEntry[] = [];
    let hr: Sample[] = [];
    for (let i = 0; i < 10; i++) {
      const at = T0 + i * day;
      const carbs = 20 + i * 10;
      entries.push(entry(`m${i}`, at, { carbs }));
      hr = hr.concat(hrAround(at, 62, 62 + carbs / 10));
    }
    const a = analyzeHeartMeals(entries, hr, []);
    expect(a.used).toBe(10);
    const carbsHr = a.correlations.find((c) => c.nutrient === 'carbs' && c.target === 'hr')!;
    expect(carbsHr.confidence).toBe('clear');
    expect(carbsHr.r).toBeGreaterThan(0.9);
    const few = analyzeHeartMeals(entries.slice(0, 5), hr, []);
    expect(few.correlations.every((c) => c.confidence === 'insufficient')).toBe(true);
  });

  it('CSV con una riga per campione intorno al pasto', () => {
    const events = groupMeals([entry('pasta, al pomodoro', T0)]);
    const csv = heartMealsCsv(events, hrAround(T0, 64, 74), [{ at: T0 + 60 * MIN, value: 42 }]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('minutes_from_meal');
    expect(lines.some((l) => l.includes('"pasta, al pomodoro"'))).toBe(true);
    expect(lines.filter((l) => l.includes('hrv_ms'))).toHaveLength(1);
  });

  it('query: campioni grezzi e voci in un intervallo', async () => {
    const db = createTestDb();
    await migrate(db);
    await upsertMetrics(db, [
      {
        type: 'heartRate',
        value: 70,
        unit: 'count/min',
        startAt: T0 - 10 * MIN,
        endAt: T0 - 10 * MIN,
        source: 'apple_health',
        sourceId: 'hr1',
      },
      {
        type: 'heartRate',
        value: 65,
        unit: 'count/min',
        startAt: T0,
        endAt: T0,
        source: 'daily_summary',
        sourceId: 'heartRate:2026-11-20',
      },
    ]);
    const s = await metricSamples(db, 'heartRate', T0 - 60 * MIN, T0 + 60 * MIN);
    expect(s).toEqual([{ at: T0 - 10 * MIN, value: 70 }]);
    await createEntry(db, { name: 'pane', eatenAt: T0 });
    await createEntry(db, { name: 'cena', eatenAt: T0 + 8 * 60 * MIN });
    expect((await listBetween(db, T0 - MIN, T0 + MIN)).map((e) => e.name)).toEqual(['pane']);
    db.close();
  });
});

describe('ora del pasto', () => {
  it('parseTime, timeOf e atTime', () => {
    expect(parseTime('7', '5')).toBe('07:05');
    expect(parseTime('24', '00')).toBeNull();
    expect(parseTime('12', '60')).toBeNull();
    const at = atTime('2026-11-20', '13:45');
    expect(timeOf(at)).toBe('13:45');
    expect(new Date(at).getDate()).toBe(20);
  });
});
