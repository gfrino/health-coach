import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

/**
 * Sincronizzazione in background:
 * - task periodico di sistema (Android: WorkManager; iOS: BGTaskScheduler), a discrezione del sistema;
 * - iOS: HealthKit background delivery, che risveglia l'app quando arrivano nuovi dati.
 * Il task deve essere definito nello scope globale (import dall'entry point).
 */
export const HEALTH_SYNC_TASK = 'health-coach-sync';

TaskManager.defineTask(HEALTH_SYNC_TASK, async () => {
  try {
    const { bootstrapHeadless } = await import('@/lib/bootstrap');
    await bootstrapHeadless();
    const { syncHealthData } = await import('./syncService');
    await syncHealthData({ force: true, background: true });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (!(await TaskManager.isTaskRegisteredAsync(HEALTH_SYNC_TASK))) {
      await BackgroundTask.registerTaskAsync(HEALTH_SYNC_TASK, { minimumInterval: 60 });
    }
  } catch {
    // background non disponibile (simulatore, restrizioni): la sync avviene all'apertura
  }
}

/** HealthKit: consegna in background dei nuovi campioni per i tipi principali. */
export async function enableHealthKitBackgroundDelivery(onChange: () => void): Promise<() => void> {
  if (Platform.OS !== 'ios') return () => undefined;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const hk =
    require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
  /* eslint-enable @typescript-eslint/no-require-imports */
  // Il sonno arriva dal Watch una volta, dopo il risveglio: "immediato" fa entrare la notte appena
  // finita prima che l'utente apra l'app (iOS può comunque raggruppare gli avvisi). Gli altri tipi
  // cambiano di continuo: basta una volta all'ora.
  const types = [
    ['HKQuantityTypeIdentifierStepCount', hk.UpdateFrequency.hourly],
    ['HKQuantityTypeIdentifierRestingHeartRate', hk.UpdateFrequency.hourly],
    ['HKQuantityTypeIdentifierBodyMass', hk.UpdateFrequency.hourly],
    ['HKCategoryTypeIdentifierSleepAnalysis', hk.UpdateFrequency.immediate],
    ['HKWorkoutTypeIdentifier', hk.UpdateFrequency.hourly],
  ] as const;
  const subs: { remove: () => void }[] = [];
  for (const [t, frequency] of types) {
    try {
      await hk.enableBackgroundDelivery(t, frequency);
      // HealthKit chiama l'observer anche subito dopo l'iscrizione: quel primo avviso si ignora
      // (la sincronizzazione all'apertura c'è già).
      let first = true;
      subs.push(
        hk.subscribeToChanges(t, () => {
          if (first) {
            first = false;
            return;
          }
          onChange();
        }),
      );
    } catch {
      // tipo non autorizzato: ignorato
    }
  }
  return () => subs.forEach((s) => s.remove());
}
