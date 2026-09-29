import { useEffect } from 'react';

import { useSettingsStore } from '@/store/settingsStore';

import { enableHealthKitBackgroundDelivery, registerBackgroundSync } from './background';
import { startForegroundSync, syncHealthData } from './syncService';

/** Avvia la sincronizzazione (apertura, ritorno in primo piano, background) quando la sorgente è collegata. */
export function HealthSyncManager() {
  const connected = useSettingsStore(
    (s) => s.settings.onboardingCompleted && s.settings.healthSourceConnectedAt !== null,
  );

  useEffect(() => {
    if (!connected) return;
    const stopForeground = startForegroundSync();
    let stopHealthKit: () => void = () => undefined;
    void registerBackgroundSync();
    void enableHealthKitBackgroundDelivery(() => void syncHealthData({ force: true })).then(
      (stop) => {
        stopHealthKit = stop;
      },
    );
    return () => {
      stopForeground();
      stopHealthKit();
    };
  }, [connected]);

  return null;
}
