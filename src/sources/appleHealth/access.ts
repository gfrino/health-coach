import {
  BiologicalSex,
  getBiologicalSexAsync,
  getDateOfBirthAsync,
  getMostRecentQuantitySample,
  isHealthDataAvailableAsync,
  requestAuthorization,
  type ObjectTypeIdentifier,
} from '@kingstinct/react-native-healthkit';

import { HEALTHKIT_CHARACTERISTICS, permissionIdentifiers } from '../healthDataTypes';
import type { ConnectResult, HealthAvailability, ProfilePrefill } from '../types';

export async function getAvailability(): Promise<HealthAvailability> {
  return (await isHealthDataAvailableAsync()) ? 'available' : 'unavailable';
}

/**
 * Chiede il permesso di SOLA LETTURA per tutti i tipi del catalogo.
 * HealthKit non rivela quali tipi di lettura l'utente ha concesso: il sync saprà solo se arrivano dati.
 */
export async function requestReadAccess(): Promise<ConnectResult> {
  const toRead = [
    ...permissionIdentifiers('ios'),
    ...HEALTHKIT_CHARACTERISTICS,
  ] as unknown as readonly ObjectTypeIdentifier[];
  const completed = await requestAuthorization({ toRead });
  return { completed };
}

export async function readProfilePrefill(): Promise<ProfilePrefill> {
  const out: ProfilePrefill = {};
  const [sex, birth, height, weight] = await Promise.allSettled([
    getBiologicalSexAsync(),
    getDateOfBirthAsync(),
    getMostRecentQuantitySample('HKQuantityTypeIdentifierHeight', 'cm'),
    getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg'),
  ]);
  if (sex.status === 'fulfilled') {
    if (sex.value === BiologicalSex.female) out.sex = 'female';
    else if (sex.value === BiologicalSex.male) out.sex = 'male';
    else if (sex.value === BiologicalSex.other) out.sex = 'other';
  }
  if (birth.status === 'fulfilled' && birth.value) {
    out.birthDate = birth.value.toISOString().slice(0, 10);
  }
  if (height.status === 'fulfilled' && height.value)
    out.heightCm = Math.round(height.value.quantity);
  if (weight.status === 'fulfilled' && weight.value) {
    out.weightKg = Math.round(weight.value.quantity * 10) / 10;
  }
  return out;
}
