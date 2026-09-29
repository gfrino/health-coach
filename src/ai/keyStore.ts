import * as SecureStore from 'expo-secure-store';

import type { AIProviderId } from '@/config/settingsSchema';

/**
 * Le chiavi API vivono solo nel portachiavi del dispositivo (mai nel DB, mai nei backup, mai su iCloud).
 * AFTER_FIRST_UNLOCK: servono anche ai task in background (riepilogo serale).
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};
const keyName = (provider: AIProviderId) => `hc.ai.key.${provider}`;

export const getApiKey = (provider: AIProviderId) =>
  SecureStore.getItemAsync(keyName(provider), OPTIONS);

export const saveApiKey = (provider: AIProviderId, key: string) =>
  SecureStore.setItemAsync(keyName(provider), key.trim(), OPTIONS);

export const deleteApiKey = (provider: AIProviderId) =>
  SecureStore.deleteItemAsync(keyName(provider), OPTIONS);

/** Mostra solo le ultime cifre, per l'UI. */
export function maskKey(key: string): string {
  const k = key.trim();
  return k.length <= 8 ? '••••' : `${k.slice(0, 4)}••••${k.slice(-4)}`;
}
