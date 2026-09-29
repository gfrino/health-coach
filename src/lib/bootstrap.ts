import { getDb } from '@/db';
import { deviceRegion, initI18n } from '@/i18n';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Avvio dell'app: i18n subito (per poter mostrare eventuali errori tradotti),
 * poi apertura del DB cifrato + migrazioni, poi idratazione delle impostazioni.
 */
export async function bootstrap(): Promise<void> {
  await initI18n('system');
  await getDb();
  await useSettingsStore.getState().hydrate(deviceRegion());
}

/** Avvio senza interfaccia (task in background): stesso ordine, idempotente se l'app è già aperta. */
export async function bootstrapHeadless(): Promise<void> {
  if (useSettingsStore.getState().hydrated) return;
  await bootstrap();
}
