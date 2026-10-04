import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { getDb, healthDataRepository } from '@/db';
import { runProactiveCheck } from '@/proactive/notifier';
import { useSettingsStore } from '@/store/settingsStore';

import { generateDemoData, SOURCE_DEMO } from './demo/demoData';
import { setTodayTotalsAt } from './freshness';
import { platformHealthSource } from './platformHealth';
import type { SyncProgress, SyncReport } from './syncTypes';

/**
 * Orchestrazione della sincronizzazione della sorgente di piattaforma:
 * all'apertura dell'app (con limite di frequenza), manuale, in background e prima dei riepiloghi.
 */
/** All'apertura e al ritorno nell'app si sincronizza se l'ultima sync ha più di 2 minuti. */
const MIN_INTERVAL_MS = 2 * 60 * 1000;

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

async function compactOldHeartRate(): Promise<void> {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - healthDataRepository.HEART_RATE_RAW_DAYS);
  const days = await healthDataRepository.compactHeartRate(await getDb(), cutoff.getTime());
  if (__DEV__ && days) console.warn(`[sync] frequenza cardiaca compattata: ${days} giorni`);
}

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
    .then(async (report) => {
      // Arrivati i dati veri, i dati di esempio (sviluppo) non devono mescolarsi con loro.
      if (report.upserted > 0) await clearDemoData().catch(() => undefined);
      useSyncStore.setState({ lastSyncAt: Date.now(), lastReport: report });
      // Frequenza cardiaca: oltre 30 giorni basta un riassunto per giorno (il DB non cresce senza limite).
      await compactOldHeartRate().catch(() => undefined);
      // Dati aggiornati: c'è qualcosa di utile da segnalare? (notifica locale, vedi proactive/)
      // Atteso: in background iOS sospende l'app appena finisce il task.
      await runProactiveCheck(await getDb());
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

let refreshingToday: Promise<void> | null = null;

/**
 * Totali di oggi e di ieri letti subito dalla sorgente (pochi decimi di secondo), senza la
 * sincronizzazione completa: prima di ogni risposta del coach i passi devono essere quelli veri.
 */
export function refreshTodayTotals(): Promise<void> {
  const { settings } = useSettingsStore.getState();
  if (settings.healthSourceConnectedAt === null) return Promise.resolve();
  if (refreshingToday) return refreshingToday;
  refreshingToday = (async () => {
    const db = await getDb();
    /* eslint-disable @typescript-eslint/no-require-imports -- moduli nativi caricati solo sulla loro piattaforma */
    if (Platform.OS === 'ios') {
      const { refreshTodayAppleHealth } =
        require('./appleHealth/sync') as typeof import('./appleHealth/sync');
      await refreshTodayAppleHealth(db);
    } else {
      const { refreshTodayHealthConnect } =
        require('./healthConnect/sync') as typeof import('./healthConnect/sync');
      await refreshTodayHealthConnect(db);
    }
    /* eslint-enable @typescript-eslint/no-require-imports */
    setTodayTotalsAt(Date.now());
  })()
    .catch(() => undefined)
    .finally(() => {
      refreshingToday = null;
    });
  return refreshingToday;
}
