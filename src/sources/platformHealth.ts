import { Platform } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';

import { HEALTH_CONNECT_FULL_VERSION, nativeAtLeast } from '@/config/env';

import { HC_EXTRA_RECORD_TYPES, permissionIdentifiers } from './healthDataTypes';

import type { ConnectResult, HealthAvailability, ProfilePrefill } from './types';

/**
 * Facciata sulla sorgente di salute della piattaforma: Apple Health su iOS, Health Connect su Android.
 * I moduli nativi vengono caricati solo sulla piattaforma giusta.
 */
export type PlatformHealthSource = 'apple_health' | 'health_connect';

export const platformHealthSource: PlatformHealthSource =
  Platform.OS === 'ios' ? 'apple_health' : 'health_connect';

interface Access {
  getAvailability(): Promise<HealthAvailability>;
  requestReadAccess(): Promise<ConnectResult>;
  readProfilePrefill(): Promise<ProfilePrefill>;
  openInstallPage?: () => Promise<void>;
}

function access(): Access {
  /* eslint-disable @typescript-eslint/no-require-imports */
  return Platform.OS === 'ios'
    ? (require('./appleHealth/access') as Access)
    : (require('./healthConnect/access') as Access);
  /* eslint-enable @typescript-eslint/no-require-imports */
}

export async function getHealthAvailability(): Promise<HealthAvailability> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unavailable';
  try {
    return await access().getAvailability();
  } catch {
    return 'unavailable';
  }
}

export async function requestHealthReadAccess(): Promise<ConnectResult> {
  const res = await access().requestReadAccess();
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    await useSettingsStore.getState().update({ healthReadAsked: readTypesCount() });
  }
  return res;
}

/** Tipi di lettura chiesti su questa piattaforma (su Android dipende dai permessi della build). */
export function readTypesCount(): number {
  if (Platform.OS === 'ios') return permissionIdentifiers('ios').length;
  return androidReadTypes().length;
}

/** Record type Health Connect da chiedere: i nuovi solo dalla build che li dichiara nel manifest. */
export function androidReadTypes(): string[] {
  const all = permissionIdentifiers('android');
  if (nativeAtLeast(HEALTH_CONNECT_FULL_VERSION)) return all;
  const extra = new Set(HC_EXTRA_RECORD_TYPES);
  return all.filter((t) => !extra.has(t));
}

/**
 * Sorgente già collegata e l'app ora legge tipi nuovi: si chiede una volta il permesso per quelli
 * (iOS e Health Connect mostrano le voci nuove). Restituisce true se la richiesta è stata fatta.
 */
export async function ensureNewHealthReadAccess(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  const s = useSettingsStore.getState().settings;
  if (s.healthSourceConnectedAt === null) return false;
  // Android: chi ha collegato Health Connect prima della 1.40.0 ha healthReadAsked = 0, ma il
  // numero di allora non conta: si chiede solo dalla build con i permessi nuovi.
  if (Platform.OS === 'android' && !nativeAtLeast(HEALTH_CONNECT_FULL_VERSION)) return false;
  if ((s.healthReadAsked ?? 0) >= readTypesCount()) return false;
  try {
    await requestHealthReadAccess();
    return true;
  } catch {
    return false;
  }
}

export async function readHealthProfilePrefill(): Promise<ProfilePrefill> {
  try {
    return await access().readProfilePrefill();
  } catch {
    return {};
  }
}

export async function openHealthInstallPage(): Promise<void> {
  await access().openInstallPage?.();
}
