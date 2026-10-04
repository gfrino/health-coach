import { Platform } from 'react-native';

import { setFoodHealthHooks } from '@/coach/tools';
import { foodRepository, getDb } from '@/db';
import type { FoodEntry } from '@/db/repositories/foodRepository';
import { FOOD_ENTRY_METADATA_KEY, FOOD_WRITE_TYPES } from '@/sources/normalize/healthKit';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Le voci del diario alimentare finiscono anche in Apple Salute (calorie, proteine, carboidrati,
 * grassi), così le vedono anche le altre app. Restano sul telefono: Apple Salute è locale.
 * Ogni campione porta l'id della voce nei metadati: in lettura l'app li salta (non li conta due
 * volte) e quando la voce cambia o viene cancellata li sostituisce o li elimina.
 * Android (Health Connect): richiede un permesso nativo, arriverà con la prossima build.
 */

type FoodType = (typeof FOOD_WRITE_TYPES)[number];

const FIELDS: { type: FoodType; key: 'calories' | 'protein' | 'carbs' | 'fat'; unit: string }[] = [
  { type: 'HKQuantityTypeIdentifierDietaryEnergyConsumed', key: 'calories', unit: 'kcal' },
  { type: 'HKQuantityTypeIdentifierDietaryProtein', key: 'protein', unit: 'g' },
  { type: 'HKQuantityTypeIdentifierDietaryCarbohydrates', key: 'carbs', unit: 'g' },
  { type: 'HKQuantityTypeIdentifierDietaryFatTotal', key: 'fat', unit: 'g' },
];

export function canWriteFoodToHealth(): boolean {
  const s = useSettingsStore.getState().settings;
  return Platform.OS === 'ios' && s.food.writeToHealth && s.healthSourceConnectedAt !== null;
}

/* eslint-disable @typescript-eslint/no-require-imports -- modulo nativo solo iOS */
const healthKit = () =>
  require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
/* eslint-enable @typescript-eslint/no-require-imports */

let authorized = false;

async function ensureAuthorization(): Promise<void> {
  if (authorized) return;
  // Il primo salvataggio chiede il permesso di scrittura (una volta sola: poi iOS non chiede più).
  await healthKit().requestAuthorization({ toShare: FOOD_WRITE_TYPES });
  authorized = true;
}

async function removeSamples(ids: Record<string, string> | null) {
  if (!ids) return;
  const { deleteObjects } = healthKit();
  for (const f of FIELDS) {
    const uuid = ids[f.type];
    if (uuid) await deleteObjects(f.type, { uuid }).catch(() => 0);
  }
}

/** Scrive (o riscrive) la voce in Apple Salute. Silenzioso: il diario funziona anche senza. */
export async function syncFoodEntryToHealth(entryId: string): Promise<void> {
  if (!canWriteFoodToHealth()) return;
  try {
    const db = await getDb();
    const entry = await foodRepository.getEntry(db, entryId);
    if (!entry) return;
    await ensureAuthorization();
    await removeSamples(entry.healthSamples);
    const { saveQuantitySample } = healthKit();
    const at = new Date(entry.eatenAt);
    const saved: Record<string, string> = {};
    for (const f of FIELDS) {
      const value = entry[f.key];
      if (value === null || value <= 0) continue;
      const sample = await saveQuantitySample(f.type, f.unit as never, value, at, at, {
        HKFoodType: entry.name,
        [FOOD_ENTRY_METADATA_KEY]: entry.id,
      } as never);
      if (sample?.uuid) saved[f.type] = sample.uuid;
    }
    await foodRepository.setHealthSamples(db, entry.id, saved);
  } catch (e) {
    console.warn(`[cibo] Apple Salute non aggiornata: ${String(e)}`);
  }
}

/** Da chiamare prima di cancellare la voce dal DB. */
export async function removeFoodEntryFromHealth(entry: FoodEntry): Promise<void> {
  if (Platform.OS !== 'ios' || !entry.healthSamples) return;
  try {
    await removeSamples(entry.healthSamples);
  } catch {
    // Campioni già cancellati dall'utente in Apple Salute.
  }
}

// Le voci registrate dal coach in chat vanno in Apple Salute come quelle scritte a mano.
setFoodHealthHooks({ logged: syncFoodEntryToHealth, deleted: removeFoodEntryFromHealth });
