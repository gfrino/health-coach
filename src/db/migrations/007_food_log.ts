import type { Migration } from './types';

/**
 * Diario alimentare: cosa ha mangiato l'utente (scritto da lui o dal coach), con calorie e
 * macronutrienti stimati. `health_samples`: id dei campioni salvati in Apple Salute (JSON),
 * per aggiornarli o cancellarli quando la voce cambia.
 */
export const migration007: Migration = {
  version: 7,
  name: 'food_log',
  up: `CREATE TABLE food_entries (
  id TEXT PRIMARY KEY NOT NULL,
  day TEXT NOT NULL,
  eaten_at INTEGER NOT NULL,
  meal TEXT NOT NULL DEFAULT 'snack',
  name TEXT NOT NULL,
  quantity TEXT,
  calories REAL,
  protein REAL,
  carbs REAL,
  fat REAL,
  source TEXT NOT NULL DEFAULT 'user',
  recipe_id TEXT,
  health_samples TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_food_entries_day ON food_entries (day, eaten_at);`,
};
