import { migration001 } from './001_initial';
import { migration002 } from './002_journal_source';
import { migration003 } from './003_message_attachments';
import { migration004 } from './004_notification_log';
import { migration005 } from './005_programs';
import { migration006 } from './006_recipes';
import { migration007 } from './007_food_log';
import { migration008 } from './008_food_details';
import type { Migration } from './types';

/**
 * Elenco ordinato delle migrazioni. Regole:
 * - non modificare mai una migrazione già rilasciata: aggiungine una nuova;
 * - versioni contigue a partire da 1 (verificato nei test).
 */
export const migrations: readonly Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
];

export type { Migration } from './types';
