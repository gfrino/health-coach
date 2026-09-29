export interface SyncProgress {
  done: number;
  total: number;
  /** Tipo di dato in corso (per l'UI). */
  label: string;
}

export interface SyncReport {
  upserted: number;
  deleted: number;
  errors: { dataType: string; message: string }[];
}
