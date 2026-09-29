export interface Migration {
  /** Intero crescente e contiguo, salvato in PRAGMA user_version. */
  version: number;
  name: string;
  up: string;
}
