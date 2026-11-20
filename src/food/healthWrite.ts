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

const FIELDS: {
  type: FoodType;
  key: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'saturatedFat' | 'sodium';
  unit: string;
}[] = [
  { type: 'HKQuantityTypeIdentifierDietaryEnergyConsumed', key: 'calories', unit: 'kcal' },
  { type: 'HKQuantityTypeIdentifierDietaryProtein', key: 'protein', unit: 'g' },
  { type: 'HKQuantityTypeIdentifierDietaryCarbohydrates', key: 'carbs', unit: 'g' },
  { type: 'HKQuantityTypeIdentifierDietaryFatTotal', key: 'fat', unit: 'g' },
  { type: 'HKQuantityTypeIdentifierDietaryFiber', key: 'fiber', unit: 'g' },
  { type: 'HKQuantityTypeIdentifierDietarySugar', key: 'sugar', unit: 'g' },
  { type: 'HKQuantityTypeIdentifierDietaryFatSaturated', key: 'saturatedFat', unit: 'g' },
  { type: 'HKQuantityTypeIdentifierDietarySodium', key: 'sodium', unit: 'mg' },
];

export function canWriteFoodToHealth(): boolean {
  const s = useSettingsStore.getState().settings;
  return Platform.OS === 'ios' && s.food.writeToHealth && s.healthSourceConnectedAt !== null;
}

/* eslint-disable @typescript-eslint/no-require-imports -- modulo nativo solo iOS */
const healthKit = () =>
  require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit');
/* eslint-enable @typescript-eslint/no-require-imports */

const SHARING_AUTHORIZED = 2; // AuthorizationStatus.sharingAuthorized

/**
 * Permesso di scrittura: iOS mostra la sua schermata solo la prima volta, e l'app la chiede
 * una volta sola (ricordandolo nelle impostazioni), mai a ogni avvio. Per farla ricomparire
 * basta spegnere e riaccendere "Salva anche in Apple Salute" nella scheda Cibo.
 * Ritorna i tipi che l'utente ha permesso di scrivere.
 */
async function writableTypes(): Promise<Set<FoodType>> {
  const hk = healthKit();
  const store = useSettingsStore.getState();
  const food = store.settings.food;
  // Si richiede anche quando l'app scrive tipi nuovi (prima versione: 4 tipi), una volta sola.
  const asked = food.healthAskedAt ? (food.healthAskedTypes ?? 4) : 0;
  if (asked < FOOD_WRITE_TYPES.length) {
    await store.update({
      food: { ...food, healthAskedAt: Date.now(), healthAskedTypes: FOOD_WRITE_TYPES.length },
    });
    await hk.requestAuthorization({ toShare: FOOD_WRITE_TYPES });
  }
  return new Set(
    FOOD_WRITE_TYPES.filter((t) => Number(hk.authorizationStatusFor(t)) === SHARING_AUTHORIZED),
  );
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
    const allowed = await writableTypes();
    await removeSamples(entry.healthSamples);
    if (!allowed.size) {
      await foodRepository.setHealthSamples(db, entry.id, null);
      return;
    }
    const { saveQuantitySample } = healthKit();
    const at = new Date(entry.eatenAt);
    const saved: Record<string, string> = {};
    for (const f of FIELDS) {
      const value = entry[f.key];
      if (value === null || value <= 0 || !allowed.has(f.type)) continue;
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

const WATER_TYPE = 'HKQuantityTypeIdentifierDietaryWater';

/**
 * Acqua aggiunta con la goccia: va anche in Apple Salute (se "Salva anche in Apple Salute" è
 * acceso), con l'id della voce nei metadati così in lettura non si conta due volte.
 * Restituisce l'uuid del campione, o null. Silenzioso: l'acqua resta comunque nell'app.
 */
export async function writeWaterToHealth(
  sourceId: string,
  ml: number,
  at: number,
): Promise<string | null> {
  if (!canWriteFoodToHealth()) return null;
  try {
    const allowed = await writableTypes();
    if (!allowed.has(WATER_TYPE)) return null;
    const { saveQuantitySample } = healthKit();
    const when = new Date(at);
    const sample = await saveQuantitySample(WATER_TYPE, 'mL' as never, ml, when, when, {
      [FOOD_ENTRY_METADATA_KEY]: sourceId,
    } as never);
    return sample?.uuid ?? null;
  } catch (e) {
    console.warn(`[acqua] Apple Salute non aggiornata: ${String(e)}`);
    return null;
  }
}

export async function removeWaterFromHealth(uuid: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    await healthKit().deleteObjects(WATER_TYPE, { uuid });
  } catch {
    // campione già cancellato in Apple Salute
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
