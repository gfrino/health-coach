import { Platform } from 'react-native';

import { useSettingsStore } from '@/store/settingsStore';

import { permissionIdentifiers } from './healthDataTypes';

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
  if (Platform.OS === 'ios') {
    await useSettingsStore
      .getState()
      .update({ healthReadAsked: permissionIdentifiers('ios').length });
  }
  return res;
}

/**
 * Apple Salute già collegata e l'app ora legge tipi nuovi: si chiede una volta il permesso per
 * quelli (iOS mostra solo le voci nuove). Restituisce true se la richiesta è stata fatta.
 */
export async function ensureNewHealthReadAccess(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const s = useSettingsStore.getState().settings;
  if (s.healthSourceConnectedAt === null) return false;
  if ((s.healthReadAsked ?? 0) >= permissionIdentifiers('ios').length) return false;
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
