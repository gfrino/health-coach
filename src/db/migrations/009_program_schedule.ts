import type { Migration } from './types';

/**
 * Programmi: giorni della settimana di ogni azione (`days`, JSON [1..7], NULL = tutti i giorni) e
 * spunta automatica dai dati di salute (`auto_rule`, JSON o "off"). Le spunte ricordano chi le ha
 * messe (`source`: 'user', 'auto' = da un allenamento, 'skip' = spunta automatica tolta
 * dall'utente, da non rimettere).
 */
export const migration009: Migration = {
  version: 9,
  name: 'program_schedule',
  up: `ALTER TABLE program_items ADD COLUMN days TEXT;
ALTER TABLE program_items ADD COLUMN auto_rule TEXT;
ALTER TABLE program_checks ADD COLUMN source TEXT NOT NULL DEFAULT 'user';`,
};
