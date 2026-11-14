import type { Migration } from './types';

/**
 * Obiettivo di peso: peso da raggiungere, data facoltativa e punto di partenza (peso e giorno in
 * cui l'obiettivo è stato fissato), per misurare il progresso.
 */
export const migration010: Migration = {
  version: 10,
  name: 'weight_goal',
  up: `ALTER TABLE profile ADD COLUMN target_weight_kg REAL;
ALTER TABLE profile ADD COLUMN target_date TEXT;
ALTER TABLE profile ADD COLUMN goal_start_weight_kg REAL;
ALTER TABLE profile ADD COLUMN goal_start_date TEXT;`,
};
