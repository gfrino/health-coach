import { Platform } from 'react-native';

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

export const requestHealthReadAccess = () => access().requestReadAccess();

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
