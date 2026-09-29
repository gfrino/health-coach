import { migration001 } from './001_initial';
import type { Migration } from './types';

/**
 * Elenco ordinato delle migrazioni. Regole:
 * - non modificare mai una migrazione già rilasciata: aggiungine una nuova;
 * - versioni contigue a partire da 1 (verificato nei test).
 */
export const migrations: readonly Migration[] = [migration001];

export type { Migration } from './types';
