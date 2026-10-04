import { migrate } from '@/db/migrate';
import * as foodRepository from '@/db/repositories/foodRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import { executeTool, parseLocalDateTime, setFoodHealthHooks } from '@/coach/tools';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({
  foodRepository: jest.requireActual('@/db/repositories/foodRepository'),
}));

const at = (day: string, hh: number) =>
  new Date(`${day}T${String(hh).padStart(2, '0')}:00:00`).getTime();

describe('diario alimentare', () => {
  it('salva, somma per giorno e pasto, aggiorna e cancella', async () => {
    const db = createTestDb();
    await migrate(db);
    const a = await foodRepository.createEntry(db, {
      name: '  Uova strapazzate ',
      quantity: '2 uova',
      calories: 182.4,
      protein: 12.55,
      meal: 'breakfast',
      eatenAt: at('2026-10-04', 8),
    });
    await foodRepository.createEntry(db, {
      name: 'Pane integrale',
      calories: 80,
      carbs: 15,
      fiber: 3.46,
      sodium: 520.4,
      eatenAt: at('2026-10-04', 8),
      meal: 'breakfast',
    });
    await foodRepository.createEntry(db, {
      name: 'Mela',
      calories: -5,
      eatenAt: at('2026-10-03', 16),
    });

    const today = await foodRepository.listDay(db, '2026-10-04');
    expect(today.map((e) => e.name)).toEqual(['Uova strapazzate', 'Pane integrale']);
    expect(today[0]).toMatchObject({
      calories: 182,
      protein: 12.6,
      source: 'user',
      meal: 'breakfast',
    });
    expect(foodRepository.totals(today)).toEqual({
      calories: 262,
      protein: 12.6,
      carbs: 15,
      fat: 0,
      fiber: 3.5,
      sugar: 0,
      saturatedFat: 0,
      sodium: 520,
      count: 2,
    });

    // Valore negativo scartato; pasto dall'ora (16:00 → spuntino).
    const yesterday = await foodRepository.listDay(db, '2026-10-03');
    expect(yesterday[0]).toMatchObject({ calories: null, meal: 'snack' });

    const days = await foodRepository.dailyTotals(db, '2026-10-01', '2026-10-04');
    expect(days.map((d) => [d.day, d.calories, d.count])).toEqual([
      ['2026-10-03', 0, 1],
      ['2026-10-04', 262, 2],
    ]);

    await foodRepository.updateEntry(db, a, { name: 'Uova', calories: 200, meal: 'lunch' });
    await foodRepository.setHealthSamples(db, a, {
      HKQuantityTypeIdentifierDietaryEnergyConsumed: 'u1',
    });
    const updated = (await foodRepository.getEntry(db, a))!;
    expect(updated).toMatchObject({ name: 'Uova', calories: 200, meal: 'lunch', quantity: null });
    expect(updated.healthSamples).toEqual({ HKQuantityTypeIdentifierDietaryEnergyConsumed: 'u1' });

    const recent = await foodRepository.recentFoods(db);
    expect(recent.map((e) => e.name)).toEqual(['Uova', 'Pane integrale', 'Mela']);

    await foodRepository.deleteEntry(db, a);
    expect(await foodRepository.getEntry(db, a)).toBeNull();
  });

  it('il coach registra i cibi, li legge e li cancella (anche in Apple Salute)', async () => {
    const db = createTestDb();
    await migrate(db);
    const logged: string[] = [];
    const deleted: string[] = [];
    setFoodHealthHooks({
      logged: async (id) => void logged.push(id),
      deleted: async (e) => void deleted.push(e.id),
    });
    const res = await executeTool(db, {
      id: 'l',
      name: 'log_food',
      arguments: {
        meal: 'dinner',
        items: [
          { name: 'Castagnaccio', quantity: '120 g', calories: 360, carbs: 50 },
          { name: 'Uova al burro con cipolla', quantity: '3 uova', calories: 380, protein: 20 },
          { quantity: 'senza nome', calories: 10 },
        ],
      },
    });
    const out = JSON.parse(res.content) as {
      logged: number;
      entry_ids: string[];
      day_total_kcal: number;
    };
    expect(res.isError).toBe(false);
    expect(out.logged).toBe(2);
    expect(out.day_total_kcal).toBe(740);
    expect(logged).toEqual(out.entry_ids);

    const log = await executeTool(db, { id: 'g', name: 'get_food_log', arguments: {} });
    const parsed = JSON.parse(log.content) as { days: { calories: number }[] };
    expect(parsed.days.at(-1)?.calories).toBe(740);

    await executeTool(db, {
      id: 'd',
      name: 'delete_food_entry',
      arguments: { entry_id: out.entry_ids[0] },
    });
    expect(deleted).toEqual([out.entry_ids[0]]);
    const bad = await executeTool(db, {
      id: 'x',
      name: 'delete_food_entry',
      arguments: { entry_id: 'nope' },
    });
    expect(bad.isError).toBe(true);
  });

  it("legge l'ora del pasto e rifiuta il futuro", () => {
    const now = new Date('2026-10-04T20:00:00').getTime();
    expect(parseLocalDateTime('2026-10-04 13:30', now)).toBe(
      new Date('2026-10-04T13:30:00').getTime(),
    );
    expect(parseLocalDateTime('2026-10-04T20:10', now)).toBe(now);
    expect(parseLocalDateTime('2026-10-05 08:00', now)).toBeNull();
    expect(parseLocalDateTime('ieri', now)).toBeNull();
  });
});
