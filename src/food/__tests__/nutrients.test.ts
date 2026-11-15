import type { DailyFoodTotals } from '@/db/repositories/foodRepository';
import { foodSection } from '@/coach/context';

import { buildNutrientReport, nutrientLines } from '../nutrientReport';
import { ageFrom, nutrientReference, refStatus } from '../references';
import { catalogueTracker } from '../trackers';

const day = (
  d: string,
  kcal: number,
  extras: Record<string, number>,
  base = {},
): DailyFoodTotals => ({
  day: d,
  calories: kcal,
  protein: 80,
  carbs: 200,
  fat: 70,
  fiber: 20,
  sugar: 40,
  saturatedFat: 20,
  sodium: 2500,
  extras,
  count: 6,
  ...base,
});

describe('valori di riferimento', () => {
  it('adatta i fabbisogni a sesso, età e calorie', () => {
    expect(ageFrom('1980-11-16', '2026-11-15')).toBe(45);
    expect(ageFrom('1980-11-15', '2026-11-15')).toBe(46);
    expect(ageFrom(null, '2026-11-15')).toBeNull();
    const woman = { sex: 'female' as const, age: 35, kcal: 1800 };
    const man = { sex: 'male' as const, age: 35, kcal: 2500 };
    expect(nutrientReference('iron', woman)?.value).toBe(16);
    expect(nutrientReference('iron', { ...woman, age: 55 })?.value).toBe(11);
    expect(nutrientReference('iron', man)?.value).toBe(11);
    expect(nutrientReference('iron', { sex: null, age: null, kcal: null })?.value).toBe(16);
    expect(nutrientReference('vitaminC', man)?.value).toBe(110);
    expect(nutrientReference('addedSugar', woman)).toMatchObject({ kind: 'max', value: 45 });
    expect(nutrientReference('saturatedFat', man)).toMatchObject({ kind: 'max', value: 28 });
    expect(nutrientReference('alcohol', man)?.kind).toBe('avoid');
    expect(nutrientReference('fructose', man)).toBeNull();
    expect(nutrientReference('c_istamina', man)).toBeNull();
  });

  it('valuta carenze ed eccessi', () => {
    const iron = nutrientReference('iron', { sex: 'female', age: 30, kcal: 2000 });
    expect(refStatus(9, iron)).toBe('low');
    expect(refStatus(14, iron)).toBe('below');
    expect(refStatus(16, iron)).toBe('ok');
    const sodium = nutrientReference('sodium', { sex: 'male', age: 30, kcal: 2000 });
    expect(refStatus(2500, sodium)).toBe('high');
    expect(refStatus(5, nutrientReference('alcohol', { sex: 'male', age: 30, kcal: 2000 }))).toBe(
      'high',
    );
    expect(refStatus(5, null)).toBe('none');
  });
});

describe('controllo dei nutrienti per il coach', () => {
  const trackers = [
    catalogueTracker('iron'),
    catalogueTracker('vitaminD'),
    catalogueTracker('fructose'),
  ];
  const profile = { sex: 'female' as const, age: 40, kcal: 2000 };

  it('fa le medie solo sui giorni completi e con il nutriente stimato', () => {
    const days = [
      day('2026-11-08', 1900, { iron: 9, vitaminD: 3 }),
      day('2026-11-10', 2100, { iron: 10, vitaminD: 4 }),
      day('2026-11-12', 1800, { iron: 8 }), // vitamina D non stimata quel giorno
      day('2026-11-13', 400, { iron: 1, vitaminD: 0 }), // diario scarno: escluso
      day('2026-11-14', 2000, { iron: 11, vitaminD: 5 }),
      day('2026-11-15', 900, { iron: 4 }), // oggi: non conta
    ];
    const r = buildNutrientReport(days, trackers, profile, '2026-11-15');
    expect(r.logged).toEqual({ day: 1, week: 4, month: 4, year: 4 });
    expect(r.incomplete).toBe(1);
    const iron = r.trends.find((t) => t.id === 'iron')!;
    expect(iron.ref.value).toBe(16);
    expect(iron.periods.map((p) => [p.key, p.days, p.avg, p.pct, p.status])).toEqual([
      ['day', 1, 11, 69, 'low'],
      ['week', 4, 9.5, 59, 'low'],
    ]);
    const vitD = r.trends.find((t) => t.id === 'vitaminD')!;
    expect(vitD.periods.find((p) => p.key === 'week')).toMatchObject({ days: 3, avg: 4 });
    // Sodio sopra il limite OMS, fruttosio senza riferimento.
    expect(r.trends.find((t) => t.id === 'sodium')!.periods[0]!.status).toBe('high');
    expect(r.trends.some((t) => t.id === 'fructose')).toBe(false);

    const full = nutrientLines(r)!;
    expect(full).toContain('NUTRIENT CHECK');
    expect(full).toContain(
      '- iron (EFSA need 16 mg/day): yesterday 11 mg (69%, low) · 7 days 9.5 mg (59%, low)',
    );
    expect(full).toContain('- sodium (WHO limit 2000 mg/day)');
    expect(full).toContain('1 sparse days left out');
    const compact = nutrientLines(r, true)!;
    expect(compact).toContain('- iron (EFSA need 16 mg/day): yesterday 69% low · 7 days 59% low');
    expect(compact).not.toContain('fiber (');
  });

  it('entra nella sezione del cibo del prompt', () => {
    const r = buildNutrientReport(
      [day('2026-11-14', 2000, { iron: 7 })],
      trackers,
      profile,
      '2026-11-15',
    );
    const text = foodSection({
      today: [],
      todayTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      avg7: null,
      target: null,
      nutrients: r,
    })!;
    expect(text).toContain('NUTRIENT CHECK');
    expect(text).toContain('iron (EFSA need 16 mg/day): yesterday 7 mg (44%, low)');
  });
});

describe('zuccheri totali', () => {
  it('usa i 90 g di riferimento UE e segna il superamento', () => {
    const ref = nutrientReference('sugar', { sex: null, age: null, kcal: 2050 })!;
    expect(ref).toEqual({ kind: 'max', value: 90, unit: 'g', source: 'EU' });
    expect(refStatus(95, ref)).toBe('high');
    expect(refStatus(31, ref)).toBe('ok');
  });
});
