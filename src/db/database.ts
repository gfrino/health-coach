import * as SQLite from 'expo-sqlite';

import { deleteDatabaseKey, getOrCreateDatabaseKey, isValidHexKey } from './key';
import { migrate } from './migrate';

export const DATABASE_NAME = 'healthcoach.db';

export class DatabaseUnlockError extends Error {
  constructor(cause: unknown) {
    super('Impossibile sbloccare il database cifrato');
    this.name = 'DatabaseUnlockError';
    this.cause = cause;
  }
}

export interface DatabaseInfo {
  schemaVersion: number;
  /** Versione di SQLCipher; `null` significa che il DB NON è cifrato (build senza SQLCipher). */
  cipherVersion: string | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let info: DatabaseInfo | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const key = await getOrCreateDatabaseKey();
  if (!isValidHexKey(key)) throw new DatabaseUnlockError(new Error('Chiave non valida'));

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
  try {
    // La chiave deve essere la prima istruzione dopo l'apertura. Formato raw x'…' (256 bit, niente KDF);
    // `key` è validata come 64 caratteri esadecimali, quindi l'interpolazione è sicura.
    await db.execAsync(`PRAGMA key = "x'${key}'"`);
    // Con una chiave errata SQLCipher fallisce alla prima lettura: la facciamo subito.
    await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master');
  } catch (e) {
    await db.closeAsync().catch(() => undefined);
    throw new DatabaseUnlockError(e);
  }

  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const cipher = await db.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  const schemaVersion = await migrate(db);
  info = { schemaVersion, cipherVersion: cipher?.cipher_version ?? null };

  if (!info.cipherVersion) {
    // Non deve mai succedere in una build configurata con useSQLCipher.
    console.warn('[db] SQLCipher non attivo: il database NON è cifrato.');
  }
  return db;
}

/** Connessione unica condivisa dall'app (e dai task in background nello stesso processo JS). */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = open().catch((e: unknown) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export function getDatabaseInfo(): DatabaseInfo | null {
  return info;
}

/**
 * Cancella DEFINITIVAMENTE il database e la sua chiave.
 * Usato dalla "cancellazione totale dei dati" e per il recupero da un DB non più apribile.
 */
export async function destroyDatabase(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  info = null;
  if (pending) {
    const db = await pending.catch(() => null);
    await db?.closeAsync().catch(() => undefined);
  }
  await SQLite.deleteDatabaseAsync(DATABASE_NAME).catch(() => undefined);
  await deleteDatabaseKey();
}
