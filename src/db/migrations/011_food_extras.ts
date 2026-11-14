import type { Migration } from './types';

/** Diario alimentare: valori in più scelti dall'utente (fruttosio, caffeina…), JSON {id: valore}. */
export const migration011: Migration = {
  version: 11,
  name: 'food_extras',
  up: `ALTER TABLE food_entries ADD COLUMN extras TEXT;`,
};
