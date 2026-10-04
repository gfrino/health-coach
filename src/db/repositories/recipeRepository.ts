import { newId } from '../ids';
import type { Db } from '../types';

/** Ricette: create dal coach (rispettando allergie, dieta e gusti) o scritte dall'utente. */

export const RECIPE_MEALS = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'any'] as const;
export type RecipeMeal = (typeof RECIPE_MEALS)[number];

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  meal: RecipeMeal;
  servings: number | null;
  prepMinutes: number | null;
  ingredients: string[];
  steps: string[];
  tags: string[];
  notes: string | null;
  source: 'user' | 'coach';
  favorite: boolean;
  cookedCount: number;
  lastCookedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RecipeInput {
  title: string;
  description?: string | null;
  meal?: RecipeMeal;
  servings?: number | null;
  prepMinutes?: number | null;
  ingredients?: string[];
  steps?: string[];
  tags?: string[];
  notes?: string | null;
}

interface Row {
  id: string;
  title: string;
  description: string | null;
  meal: string;
  servings: number | null;
  prep_minutes: number | null;
  ingredients: string;
  steps: string;
  tags: string;
  notes: string | null;
  source: string;
  favorite: number;
  cooked_count: number;
  last_cooked_at: number | null;
  created_at: number;
  updated_at: number;
}

export const asMeal = (v: unknown): RecipeMeal =>
  RECIPE_MEALS.includes(v as RecipeMeal) ? (v as RecipeMeal) : 'any';

const list = (raw: string): string[] => {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** Righe pulite: niente vuote, lunghezza limitata, al massimo `max`. */
export const cleanLines = (xs: unknown, max = 40, len = 300): string[] =>
  (Array.isArray(xs) ? xs : [])
    .filter((x): x is string => typeof x === 'string')
    .map((x) =>
      x
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')
        .trim()
        .slice(0, len),
    )
    .filter(Boolean)
    .slice(0, max);

const posInt = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, Math.round(v)) : null;

const toRecipe = (r: Row): Recipe => ({
  id: r.id,
  title: r.title,
  description: r.description,
  meal: asMeal(r.meal),
  servings: r.servings,
  prepMinutes: r.prep_minutes,
  ingredients: list(r.ingredients),
  steps: list(r.steps),
  tags: list(r.tags),
  notes: r.notes,
  source: r.source === 'coach' ? 'coach' : 'user',
  favorite: r.favorite === 1,
  cookedCount: r.cooked_count,
  lastCookedAt: r.last_cooked_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function listRecipes(db: Db): Promise<Recipe[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM recipes ORDER BY favorite DESC, updated_at DESC',
    [],
  );
  return rows.map(toRecipe);
}

export async function getRecipe(db: Db, id: string): Promise<Recipe | null> {
  const r = await db.getFirstAsync<Row>('SELECT * FROM recipes WHERE id = ?', [id]);
  return r ? toRecipe(r) : null;
}

export async function createRecipe(
  db: Db,
  input: RecipeInput,
  source: 'user' | 'coach' = 'user',
): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO recipes (id, title, description, meal, servings, prep_minutes, ingredients, steps, tags, notes, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title.trim().slice(0, 120),
      input.description?.trim() || null,
      input.meal ?? 'any',
      posInt(input.servings, 50),
      posInt(input.prepMinutes, 24 * 60),
      JSON.stringify(cleanLines(input.ingredients)),
      JSON.stringify(cleanLines(input.steps, 40, 600)),
      JSON.stringify(cleanLines(input.tags, 10, 40)),
      input.notes?.trim() || null,
      source,
      now,
      now,
    ],
  );
  return id;
}

export async function updateRecipe(
  db: Db,
  id: string,
  patch: Partial<RecipeInput> & { favorite?: boolean },
): Promise<boolean> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const col = (c: string, v: string | number | null) => {
    sets.push(`${c} = ?`);
    args.push(v);
  };
  if (patch.title !== undefined && patch.title.trim())
    col('title', patch.title.trim().slice(0, 120));
  if (patch.description !== undefined) col('description', patch.description?.trim() || null);
  if (patch.meal !== undefined) col('meal', asMeal(patch.meal));
  if (patch.servings !== undefined) col('servings', posInt(patch.servings, 50));
  if (patch.prepMinutes !== undefined) col('prep_minutes', posInt(patch.prepMinutes, 24 * 60));
  if (patch.ingredients !== undefined)
    col('ingredients', JSON.stringify(cleanLines(patch.ingredients)));
  if (patch.steps !== undefined) col('steps', JSON.stringify(cleanLines(patch.steps, 40, 600)));
  if (patch.tags !== undefined) col('tags', JSON.stringify(cleanLines(patch.tags, 10, 40)));
  if (patch.notes !== undefined) col('notes', patch.notes?.trim() || null);
  if (patch.favorite !== undefined) col('favorite', patch.favorite ? 1 : 0);
  col('updated_at', Date.now());
  const res = await db.runAsync(`UPDATE recipes SET ${sets.join(', ')} WHERE id = ?`, [
    ...args,
    id,
  ]);
  return res.changes > 0;
}

/** "L'ho cucinata": conta le volte e la data, utile al coach per i suggerimenti. */
export async function markCooked(db: Db, id: string): Promise<void> {
  await db.runAsync(
    'UPDATE recipes SET cooked_count = cooked_count + 1, last_cooked_at = ?, updated_at = ? WHERE id = ?',
    [Date.now(), Date.now(), id],
  );
}

export async function deleteRecipe(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM recipes WHERE id = ?', [id]);
}
