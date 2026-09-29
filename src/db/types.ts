/**
 * Sottoinsieme dell'API di expo-sqlite usato da migrazioni e repository.
 * `SQLiteDatabase` lo soddisfa; nei test lo implementa un adapter su `node:sqlite`.
 */
export type BindValue = string | number | null | boolean | Uint8Array;
export type BindParams = BindValue[];

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: BindParams): Promise<RunResult>;
  getFirstAsync<T>(source: string, params: BindParams): Promise<T | null>;
  getAllAsync<T>(source: string, params: BindParams): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}
