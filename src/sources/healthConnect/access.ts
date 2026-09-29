import { Linking } from 'react-native';
import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
  type RecordType,
} from 'react-native-health-connect';

import { permissionIdentifiers } from '../healthDataTypes';
import type { ConnectResult, HealthAvailability, ProfilePrefill } from '../types';

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

let initialized = false;

async function ensureInitialized(): Promise<boolean> {
  if (!initialized) initialized = await initialize();
  return initialized;
}

export async function getAvailability(): Promise<HealthAvailability> {
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    // Su Android < 14 significa anche "app Health Connect non installata".
    return 'needsInstall';
  }
  return 'unavailable';
}

/** Apre la scheda Play Store di Health Connect (Android 13 e precedenti). */
export async function openInstallPage(): Promise<void> {
  const market = `market://details?id=${HEALTH_CONNECT_PACKAGE}&url=healthconnect%3A%2F%2Fonboarding`;
  const web = `https://play.google.com/store/apps/details?id=${HEALTH_CONNECT_PACKAGE}`;
  await Linking.openURL(market).catch(() => Linking.openURL(web));
}

/**
 * Chiede la lettura per tutti i tipi del catalogo, più lettura in background
 * e dello storico (di default Health Connect consente solo i 30 giorni precedenti al consenso).
 */
export async function requestReadAccess(): Promise<ConnectResult> {
  if (!(await ensureInitialized())) return { completed: false };
  const permissions: Parameters<typeof requestPermission>[0] = [
    ...permissionIdentifiers('android').map((recordType): Permission => ({
      accessType: 'read',
      recordType: recordType as RecordType,
    })),
    { accessType: 'read', recordType: 'BackgroundAccessPermission' },
    { accessType: 'read', recordType: 'ReadHealthDataHistory' },
  ];
  const granted = await requestPermission(permissions);
  return { completed: true, grantedCount: granted.length };
}

export async function hasAnyReadPermission(): Promise<boolean> {
  if (!(await ensureInitialized())) return false;
  const granted = await getGrantedPermissions();
  return granted.some((p) => p.accessType === 'read');
}

export async function readProfilePrefill(): Promise<ProfilePrefill> {
  if (!(await ensureInitialized())) return {};
  const out: ProfilePrefill = {};
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
    endTime: new Date().toISOString(),
  };
  const [height, weight] = await Promise.allSettled([
    readRecords('Height', { timeRangeFilter, ascendingOrder: false, pageSize: 1 }),
    readRecords('Weight', { timeRangeFilter, ascendingOrder: false, pageSize: 1 }),
  ]);
  const h = height.status === 'fulfilled' ? height.value.records[0] : undefined;
  const w = weight.status === 'fulfilled' ? weight.value.records[0] : undefined;
  if (h) out.heightCm = Math.round(h.height.inMeters * 100);
  if (w) out.weightKg = Math.round(w.weight.inKilograms * 10) / 10;
  return out;
}
