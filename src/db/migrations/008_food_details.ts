import type { Migration } from './types';

/** Diario alimentare: fibre, zuccheri, grassi saturi (g) e sodio (mg), stimati come i macro. */
export const migration008: Migration = {
  version: 8,
  name: 'food_details',
  up: `ALTER TABLE food_entries ADD COLUMN fiber REAL;
ALTER TABLE food_entries ADD COLUMN sugar REAL;
ALTER TABLE food_entries ADD COLUMN saturated_fat REAL;
ALTER TABLE food_entries ADD COLUMN sodium REAL;`,
};
