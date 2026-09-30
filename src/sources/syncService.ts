import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { getDb, healthDataRepository } from '@/db';
import { useSettingsStore } from '@/store/settingsStore';

import { generateDemoData, SOURCE_DEMO } from './demo/demoData';
import { platformHealthSource } from './platformHealth';
import type { SyncProgress, SyncReport } from './syncTypes';

/**
 * Orchestrazione della sincronizzazione della sorgente di piattaforma:
 * all'apertura dell'app (con limite di frequenza), manuale, in background e prima dei riepiloghi.
 */
const MIN_INTERVAL_MS = 10 * 60 * 1000;

interface SyncState {
  syncing: boolean;
  /** Avviata dall'utente (tira per aggiornare / "Sincronizza ora"): solo allora si mostra lo spinner. */
  manual: boolean;
  progress: SyncProgress | null;
  lastSyncAt: number | null;
  lastReport: SyncReport | null;
  error: string | null;
}

export const useSyncStore = create<SyncState>(() => ({
  syncing: false,
  manual: false,
  progress: null,
  lastSyncAt: null,
  lastReport: null,
  error: null,
}));

let running: Promise<SyncReport | null> | null = null;

async function runPlatformSync(onProgress: (p: SyncProgress) => void): Promise<SyncReport> {
  const db = await getDb();
  /* eslint-disable @typescript-eslint/no-require-imports -- moduli nativi caricati solo sulla loro piattaforma */
  if (Platform.OS === 'ios') {
    const { syncAppleHealth } =
      require('./appleHealth/sync') as typeof import('./appleHealth/sync');
    return syncAppleHealth(db, onProgress);
  }
  const { syncHealthConnect } =
    require('./healthConnect/sync') as typeof import('./healthConnect/sync');
  return syncHealthConnect(db, onProgress);
  /* eslint-enable @typescript-eslint/no-require-imports */
}

/**
 * Avvia una sincronizzazione (una sola alla volta).
 * - `force`: ignora il limite di frequenza;
 * - `minIntervalMs`: limite personalizzato (es. aggiornamenti da HealthKit);
 * - `manual`: richiesta dall'utente, mostra lo spinner.
 */
export function syncHealthData(
  opts: { force?: boolean; manual?: boolean; minIntervalMs?: number } = {},
): Promise<SyncReport | null> {
  if (running) {
    if (opts.manual) useSyncStore.setState({ manual: true });
    return running;
  }
  const { settings } = useSettingsStore.getState();
  if (settings.healthSourceConnectedAt === null) return Promise.resolve(null);
  const last = useSyncStore.getState().lastSyncAt;
  const minInterval = opts.minIntervalMs ?? MIN_INTERVAL_MS;
  if (!opts.force && last && Date.now() - last < minInterval) return Promise.resolve(null);

  const startedAt = Date.now();
  useSyncStore.setState({ syncing: true, manual: !!opts.manual, progress: null, error: null });
  running = runPlatformSync((progress) => useSyncStore.setState({ progress }))
    .then((report) => {
      useSyncStore.setState({ lastSyncAt: Date.now(), lastReport: report });
      if (__DEV__) {
        console.warn(
          `[sync] ${Date.now() - startedAt} ms · ${report.upserted} scritti · ${report.deleted} eliminati · ${report.errors.length} tipi non disponibili`,
        );
      }
      return report;
    })
    .catch((e: unknown) => {
      useSyncStore.setState({ error: e instanceof Error ? e.message : String(e) });
      return null;
    })
    .finally(() => {
      useSyncStore.setState({ syncing: false, manual: false, progress: null });
      running = null;
    });
  return running;
}

/** Legge l'ora dell'ultima sincronizzazione salvata (dopo un riavvio dell'app). */
export async function loadLastSync(): Promise<void> {
  const db = await getDb();
  const at = await healthDataRepository.lastSyncAt(db, platformHealthSource);
  useSyncStore.setState({ lastSyncAt: at });
}

/** Sincronizza a ogni ritorno in primo piano. Restituisce la funzione per smettere di ascoltare. */
export function startForegroundSync(): () => void {
  void loadLastSync().then(() => syncHealthData());
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncHealthData();
  });
  return () => sub.remove();
}

// ---- Dati di esempio (sviluppo) ----

export async function loadDemoData(): Promise<void> {
  const db = await getDb();
  await healthDataRepository.clearSource(db, SOURCE_DEMO);
  const batch = generateDemoData();
  await healthDataRepository.upsertMetrics(db, batch.metrics);
  await healthDataRepository.upsertWorkouts(db, batch.workouts);
  await healthDataRepository.upsertSleepSessions(db, batch.sleep);
}

export async function clearDemoData(): Promise<void> {
  const db = await getDb();
  await healthDataRepository.clearSource(db, SOURCE_DEMO);
}
