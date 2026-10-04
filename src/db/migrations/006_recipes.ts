import type { Migration } from './types';

/** Ricette create dal coach o dall'utente (ingredienti e passaggi come JSON di stringhe). */
export const migration006: Migration = {
  version: 6,
  name: 'recipes',
  up: `CREATE TABLE recipes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  meal TEXT NOT NULL DEFAULT 'any',
  servings INTEGER,
  prep_minutes INTEGER,
  ingredients TEXT NOT NULL DEFAULT '[]',
  steps TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  favorite INTEGER NOT NULL DEFAULT 0,
  cooked_count INTEGER NOT NULL DEFAULT 0,
  last_cooked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_recipes_updated ON recipes (updated_at);`,
};
