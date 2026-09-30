import { useEffect } from 'react';

import { useSettingsStore } from '@/store/settingsStore';

import { enableHealthKitBackgroundDelivery, registerBackgroundSync } from './background';
import { startForegroundSync, syncHealthData } from './syncService';

/** Gli aggiornamenti di HealthKit arrivano a raffica (il Watch scrive spesso): si raggruppano. */
const HEALTHKIT_DEBOUNCE_MS = 30 * 1000;
const HEALTHKIT_MIN_INTERVAL_MS = 3 * 60 * 1000;

/** Avvia la sincronizzazione (apertura, ritorno in primo piano, background) quando la sorgente è collegata. */
export function HealthSyncManager() {
  const connected = useSettingsStore(
    (s) => s.settings.onboardingCompleted && s.settings.healthSourceConnectedAt !== null,
  );

  useEffect(() => {
    if (!connected) return;
    const stopForeground = startForegroundSync();
    let stopHealthKit: () => void = () => undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onHealthKitChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void syncHealthData({ minIntervalMs: HEALTHKIT_MIN_INTERVAL_MS });
      }, HEALTHKIT_DEBOUNCE_MS);
    };
    void registerBackgroundSync();
    void enableHealthKitBackgroundDelivery(onHealthKitChange).then((stop) => {
      stopHealthKit = stop;
    });
    return () => {
      if (timer) clearTimeout(timer);
      stopForeground();
      stopHealthKit();
    };
  }, [connected]);

  return null;
}
