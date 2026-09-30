import type { Migration } from './types';

/** Diario: chi ha scritto la voce ("user" o "coach", quando la annota l'AI durante la chat). */
export const migration002: Migration = {
  version: 2,
  name: 'journal_source',
  up: `ALTER TABLE journal_entries ADD COLUMN source TEXT NOT NULL DEFAULT 'user';`,
};
