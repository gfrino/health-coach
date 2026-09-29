/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';

import type { BindParams, Db, RunResult } from '@/db/types';

/**
 * Implementazione di `Db` su node:sqlite per i test (stesso motore SQLite, senza SQLCipher).
 * Permette di testare migrazioni e repository con SQL reale, senza dispositivo.
 */
export function createTestDb(): Db & { close: () => void } {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const norm = (params: BindParams) =>
    params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p)) as (
      string | number | null | Uint8Array
    )[];

  return {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, params): Promise<RunResult> {
      const r = db.prepare(source).run(...norm(params));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getFirstAsync<T>(source: string, params: BindParams) {
      return (db.prepare(source).get(...norm(params)) as T | undefined) ?? null;
    },
    async getAllAsync<T>(source: string, params: BindParams) {
      return db.prepare(source).all(...norm(params)) as T[];
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close: () => db.close(),
  };
}
