/**
 * Contratto comune per tutte le sorgenti di dati (Apple Health, Health Connect e integrazioni future).
 * Gli adapter normalizzano sempre nel modello unico del DB (vedi src/db/migrations/001_initial.ts).
 */
export type SourceId = string; // es. 'apple_health', 'health_connect', 'withings'

export type Platform = 'ios' | 'android';

export interface SourceCapabilities {
  /** Tipi di dato normalizzati che la sorgente può fornire su questa piattaforma. */
  dataTypes: readonly string[];
  backgroundSync: boolean;
  incrementalSync: boolean;
}

export interface SyncResult {
  inserted: number;
  updated: number;
  deleted: number;
  errors: { dataType: string; message: string }[];
}

export interface SourceAdapter {
  readonly id: SourceId;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  sync(since?: Date): Promise<SyncResult>;
  getCapabilities(): SourceCapabilities;
}

/** Stato della sorgente di piattaforma sul dispositivo. */
export type HealthAvailability =
  | 'available'
  | 'unavailable' // es. iPad senza Salute, Android senza Health Connect installabile
  | 'needsInstall' // Android < 14: installare Health Connect dal Play Store
  | 'needsUpdate'; // Health Connect presente ma da aggiornare

export interface ConnectResult {
  /** La richiesta è stata mostrata/completata. Su iOS non si sa quali tipi l'utente ha concesso (privacy). */
  completed: boolean;
  /** Solo Android: numero di tipi concessi. */
  grantedCount?: number;
}

/** Dati di profilo leggibili dalla sorgente (tutti opzionali). */
export interface ProfilePrefill {
  sex?: 'female' | 'male' | 'other';
  birthDate?: string; // YYYY-MM-DD
  heightCm?: number;
  weightKg?: number;
}
