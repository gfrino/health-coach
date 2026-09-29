import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'hc.db.key.v1';

/**
 * Accessibilità del Keychain: disponibile dopo il primo sblocco (serve ai task in
 * background, es. riepilogo serale) e MAI sincronizzata/migrata su altri dispositivi o iCloud.
 */
const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** Chiave raw a 256 bit, in esadecimale (64 caratteri). */
export async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME, STORE_OPTIONS);
  if (existing && isValidHexKey(existing)) return existing;

  const bytes = Crypto.getRandomBytes(32);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, hex, STORE_OPTIONS);
  return hex;
}

export async function deleteDatabaseKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_NAME, STORE_OPTIONS);
}

export function isValidHexKey(key: string): boolean {
  return /^[0-9a-f]{64}$/.test(key);
}
