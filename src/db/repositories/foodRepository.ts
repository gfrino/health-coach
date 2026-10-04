import { localIsoDate } from '@/lib/dates';

import { newId } from '../ids';
import type { Db } from '../types';

/**
 * Diario alimentare: una riga per alimento mangiato, con calorie e macronutrienti (stime).
 * Scritto dall'utente nella scheda Cibo o dal coach in chat. Solo sul telefono, nel DB cifrato
 * (e, se l'utente lo vuole, anche in Apple Salute: vedi src/food/healthWrite.ts).
 */

export const FOOD_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type FoodMeal = (typeof FOOD_MEALS)[number];

export interface FoodEntry {
  id: string;
  /** Giorno locale YYYY-MM-DD. */
  day: string;
  eatenAt: number;
  meal: FoodMeal;
  name: string;
  quantity: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  source: 'user' | 'coach';
  recipeId: string | null;
  /** Id dei campioni scritti in Apple Salute, per tipo. */
  healthSamples: Record<string, string> | null;
  createdAt: number;
  updatedAt: number;
}

export interface FoodInput {
  name: string;
  meal?: FoodMeal;
  eatenAt?: number;
  quantity?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  recipeId?: string | null;
}

export interface FoodTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  count: number;
}

interface Row {
  id: string;
  day: string;
  eaten_at: number;
  meal: string;
  name: string;
  quantity: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  source: string;
  recipe_id: string | null;
  health_samples: string | null;
  created_at: number;
  updated_at: number;
}

export const asFoodMeal = (v: unknown): FoodMeal =>
  FOOD_MEALS.includes(v as FoodMeal) ? (v as FoodMeal) : 'snack';

/** Pasto più probabile dall'ora (quando né l'utente né il coach lo indicano). */
export function mealForTime(d: Date): FoodMeal {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 18 && h < 23) return 'dinner';
  return 'snack';
}

/** Numero non negativo e plausibile, arrotondato (calorie all'unità, grammi al decimo). */
const amount = (v: unknown, max: number, decimals: number): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
  const f = 10 ** decimals;
  return Math.round(Math.min(v, max) * f) / f;
};

const samples = (raw: string | null): Record<string, string> | null => {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as Record<string, string>) : null;
  } catch {
    return null;
  }
};

const toEntry = (r: Row): FoodEntry => ({
  id: r.id,
  day: r.day,
  eatenAt: r.eaten_at,
  meal: asFoodMeal(r.meal),
  name: r.name,
  quantity: r.quantity,
  calories: r.calories,
  protein: r.protein,
  carbs: r.carbs,
  fat: r.fat,
  source: r.source === 'coach' ? 'coach' : 'user',
  recipeId: r.recipe_id,
  healthSamples: samples(r.health_samples),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function clean(input: FoodInput) {
  return {
    name: input.name.trim().slice(0, 120),
    quantity: input.quantity?.trim().slice(0, 60) || null,
    calories: amount(input.calories, 10000, 0),
    protein: amount(input.protein, 1000, 1),
    carbs: amount(input.carbs, 1000, 1),
    fat: amount(input.fat, 1000, 1),
  };
}

export async function createEntry(
  db: Db,
  input: FoodInput,
  source: 'user' | 'coach' = 'user',
): Promise<string> {
  const c = clean(input);
  if (!c.name) throw new Error('food name required');
  const now = Date.now();
  const eatenAt = input.eatenAt ?? now;
  const id = newId();
  await db.runAsync(
    `INSERT INTO food_entries (id, day, eaten_at, meal, name, quantity, calories, protein, carbs, fat,
       source, recipe_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      localIsoDate(new Date(eatenAt)),
      eatenAt,
      input.meal ?? mealForTime(new Date(eatenAt)),
      c.name,
      c.quantity,
      c.calories,
      c.protein,
      c.carbs,
      c.fat,
      source,
      input.recipeId ?? null,
      now,
      now,
    ],
  );
  return id;
}

export async function updateEntry(db: Db, id: string, input: FoodInput): Promise<void> {
  const c = clean(input);
  if (!c.name) throw new Error('food name required');
  const current = await getEntry(db, id);
  if (!current) return;
  const eatenAt = input.eatenAt ?? current.eatenAt;
  await db.runAsync(
    `UPDATE food_entries SET day = ?, eaten_at = ?, meal = ?, name = ?, quantity = ?, calories = ?,
       protein = ?, carbs = ?, fat = ?, updated_at = ? WHERE id = ?`,
    [
      localIsoDate(new Date(eatenAt)),
      eatenAt,
      input.meal ?? current.meal,
      c.name,
      c.quantity,
      c.calories,
      c.protein,
      c.carbs,
      c.fat,
      Date.now(),
      id,
    ],
  );
}

export async function setHealthSamples(
  db: Db,
  id: string,
  ids: Record<string, string> | null,
): Promise<void> {
  await db.runAsync('UPDATE food_entries SET health_samples = ? WHERE id = ?', [
    ids && Object.keys(ids).length ? JSON.stringify(ids) : null,
    id,
  ]);
}

export async function deleteEntry(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM food_entries WHERE id = ?', [id]);
}

export async function getEntry(db: Db, id: string): Promise<FoodEntry | null> {
  const r = await db.getFirstAsync<Row>('SELECT * FROM food_entries WHERE id = ?', [id]);
  return r ? toEntry(r) : null;
}

export async function listDay(db: Db, day: string): Promise<FoodEntry[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM food_entries WHERE day = ? ORDER BY eaten_at, created_at',
    [day],
  );
  return rows.map(toEntry);
}

export function totals(entries: Pick<FoodEntry, 'calories' | 'protein' | 'carbs' | 'fat'>[]) {
  const sum = (k: 'calories' | 'protein' | 'carbs' | 'fat') =>
    Math.round(entries.reduce((a, e) => a + (e[k] ?? 0), 0) * 10) / 10;
  return {
    calories: Math.round(sum('calories')),
    protein: sum('protein'),
    carbs: sum('carbs'),
    fat: sum('fat'),
    count: entries.length,
  } satisfies FoodTotals;
}

/** Totali per giorno tra due date (incluse), solo i giorni con almeno una voce. */
export async function dailyTotals(
  db: Db,
  fromDay: string,
  toDay: string,
): Promise<({ day: string } & FoodTotals)[]> {
  const rows = await db.getAllAsync<{
    day: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    n: number;
  }>(
    `SELECT day, SUM(calories) AS calories, SUM(protein) AS protein, SUM(carbs) AS carbs,
       SUM(fat) AS fat, COUNT(*) AS n
     FROM food_entries WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day`,
    [fromDay, toDay],
  );
  const r1 = (v: number | null) => Math.round((v ?? 0) * 10) / 10;
  return rows.map((r) => ({
    day: r.day,
    calories: Math.round(r.calories ?? 0),
    protein: r1(r.protein),
    carbs: r1(r.carbs),
    fat: r1(r.fat),
    count: r.n,
  }));
}

/** Alimenti usati di recente (nomi distinti, l'ultima versione di ciascuno), per riaggiungerli. */
export async function recentFoods(db: Db, limit = 12): Promise<FoodEntry[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT f.* FROM food_entries f
     JOIN (SELECT lower(name) AS k, MAX(eaten_at) AS last FROM food_entries GROUP BY lower(name)) x
       ON lower(f.name) = x.k AND f.eaten_at = x.last
     ORDER BY f.eaten_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toEntry);
}
