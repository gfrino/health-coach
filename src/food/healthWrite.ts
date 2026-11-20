import { Platform } from 'react-native';

import { setFoodHealthHooks } from '@/coach/tools';
import { foodRepository, getDb } from '@/db';
import type { FoodEntry } from '@/db/repositories/foodRepository';
import { HK_STATE_OF_MIND } from '@/sources/hkExtra';
import { FOOD_ENTRY_METADATA_KEY, FOOD_WRITE_TYPES } from '@/sources/normalize/healthKit';
import { HEALTH_CONNECT_FULL_VERSION, nativeAtLeast } from '@/config/env';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Le voci del diario alimentare finiscono anche in Apple Salute (calorie, proteine, carboidrati,
 * grassi), così le vedono anche le altre app. Restano sul telefono: Apple Salute è locale.
 * Ogni campione porta l'id della voce nei metadati: in lettura l'app li salta (non li conta due
 * volte) e quando la voce cambia o viene cancellata li sostituisce o li elimina.
 * Android (Health Connect, dalla build 1.40.0): stesse scritture in sources/healthConnect/write,
 * con un clientRecordId "alba-…" al posto dei metadati.
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

/** Valori in più del diario (Altri valori) che Apple Salute conosce: id del valore → tipo. */
const EXTRA_FIELDS: { type: FoodType; id: string; unit: string }[] = [
  { type: 'HKQuantityTypeIdentifierDietaryCaffeine', id: 'caffeine', unit: 'mg' },
  { type: 'HKQuantityTypeIdentifierDietaryCholesterol', id: 'cholesterol', unit: 'mg' },
  { type: 'HKQuantityTypeIdentifierDietaryPotassium', id: 'potassium', unit: 'mg' },
  { type: 'HKQuantityTypeIdentifierDietaryMagnesium', id: 'magnesium', unit: 'mg' },
  { type: 'HKQuantityTypeIdentifierDietaryCalcium', id: 'calcium', unit: 'mg' },
  { type: 'HKQuantityTypeIdentifierDietaryIron', id: 'iron', unit: 'mg' },
  { type: 'HKQuantityTypeIdentifierDietaryVitaminC', id: 'vitaminC', unit: 'mg' },
  // Nel diario in µg, in HealthKit "mcg".
  { type: 'HKQuantityTypeIdentifierDietaryVitaminD', id: 'vitaminD', unit: 'mcg' },
];

/** Tutto ciò che l'app può scrivere: i tipi quantità più lo stato d'animo (dal Journal). */
const SHARE_TYPES = [...FOOD_WRITE_TYPES, HK_STATE_OF_MIND] as const;
type ShareType = (typeof SHARE_TYPES)[number];

const isAndroid = Platform.OS === 'android';

/* eslint-disable @typescript-eslint/no-require-imports -- modulo nativo solo Android */
const hc = () =>
  require('@/sources/healthConnect/write') as typeof import('@/sources/healthConnect/write');
/* eslint-enable @typescript-eslint/no-require-imports */

/** Scrittura possibile su questa piattaforma (Android: solo dalla build con i permessi). */
export function canWriteToHealthHere(): boolean {
  if (Platform.OS === 'ios') return true;
  return isAndroid && nativeAtLeast(HEALTH_CONNECT_FULL_VERSION);
}

export function canWriteFoodToHealth(): boolean {
  const s = useSettingsStore.getState().settings;
  return canWriteToHealthHere() && s.food.writeToHealth && s.healthSourceConnectedAt !== null;
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
async function writableTypes(): Promise<Set<ShareType>> {
  const hk = healthKit();
  const store = useSettingsStore.getState();
  const food = store.settings.food;
  // Si richiede anche quando l'app scrive tipi nuovi (prima versione: 4 tipi), una volta sola.
  const asked = food.healthAskedAt ? (food.healthAskedTypes ?? 4) : 0;
  if (asked < SHARE_TYPES.length) {
    await store.update({
      food: { ...food, healthAskedAt: Date.now(), healthAskedTypes: SHARE_TYPES.length },
    });
    await hk.requestAuthorization({ toShare: SHARE_TYPES as never });
  }
  return new Set(
    SHARE_TYPES.filter((t) => {
      try {
        return Number(hk.authorizationStatusFor(t as never)) === SHARING_AUTHORIZED;
      } catch {
        return false; // tipo che questa versione di iOS non conosce (stato d'animo prima di iOS 18)
      }
    }),
  );
}

async function removeSamples(ids: Record<string, string> | null) {
  if (!ids) return;
  const { deleteObjects } = healthKit();
  for (const [type, uuid] of Object.entries(ids)) {
    if (uuid) await deleteObjects(type as FoodType, { uuid }).catch(() => 0);
  }
}

/** Scrive (o riscrive) la voce in Apple Salute. Silenzioso: il diario funziona anche senza. */
export async function syncFoodEntryToHealth(entryId: string): Promise<void> {
  if (!canWriteFoodToHealth()) return;
  if (isAndroid) {
    try {
      const entry = await foodRepository.getEntry(await getDb(), entryId);
      if (entry) await hc().writeFoodEntry(entry);
    } catch (e) {
      console.warn(`[cibo] Health Connect non aggiornato: ${String(e)}`);
    }
    return;
  }
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
    for (const f of EXTRA_FIELDS) {
      const value = entry.extras?.[f.id];
      if (value == null || value <= 0 || !allowed.has(f.type)) continue;
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
 * Peso o altezza scritti a mano nel profilo: anche in Apple Salute. Nei metadati l'id della misura
 * (già nell'app), così in lettura non si conta due volte.
 */
export async function writeBodyToHealth(
  kind: 'weight' | 'height',
  sourceId: string,
  value: number,
  at: number,
): Promise<void> {
  if (!canWriteFoodToHealth()) return;
  if (isAndroid) {
    await hc()
      .writeBody(kind, sourceId, value, at)
      .catch((e: unknown) => console.warn(`[profilo] Health Connect non aggiornato: ${String(e)}`));
    return;
  }
  const type =
    kind === 'weight' ? 'HKQuantityTypeIdentifierBodyMass' : 'HKQuantityTypeIdentifierHeight';
  try {
    const allowed = await writableTypes();
    if (!allowed.has(type)) return;
    const when = new Date(at);
    await healthKit().saveQuantitySample(
      type,
      (kind === 'weight' ? 'kg' : 'cm') as never,
      value,
      when,
      when,
      {
        [FOOD_ENTRY_METADATA_KEY]: sourceId,
      } as never,
    );
  } catch (e) {
    console.warn(`[profilo] Apple Salute non aggiornata: ${String(e)}`);
  }
}

/** Umore del Journal (1–5) → valenza di Apple (-1 … +1). */
export const moodToValence = (mood: number) => Math.max(-1, Math.min(1, (mood - 3) / 2));

/**
 * Umore di una nuova nota del Journal → "Stato d'animo" di Apple Salute (iOS 18), come umore del
 * giorno. Nei metadati l'id della nota: in lettura si salta.
 */
export async function writeMoodToHealth(
  journalId: string,
  mood: number,
  at: number,
): Promise<void> {
  if (!canWriteFoodToHealth()) return;
  // Health Connect non ha lo stato d'animo.
  if (isAndroid) return;
  try {
    const allowed = await writableTypes();
    if (!allowed.has(HK_STATE_OF_MIND)) return;
    // StateOfMindKind.dailyMood = 2
    await healthKit().saveStateOfMindSample(new Date(at), 2 as never, moodToValence(mood), [], [], {
      [FOOD_ENTRY_METADATA_KEY]: journalId,
    } as never);
  } catch (e) {
    console.warn(`[journal] Apple Salute non aggiornata: ${String(e)}`);
  }
}

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
  if (isAndroid) {
    return hc()
      .writeWater(sourceId, ml, at)
      .catch(() => null);
  }
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
  if (isAndroid) {
    if (canWriteToHealthHere())
      await hc()
        .deleteWater(uuid)
        .catch(() => undefined);
    return;
  }
  if (Platform.OS !== 'ios') return;
  try {
    await healthKit().deleteObjects(WATER_TYPE, { uuid });
  } catch {
    // campione già cancellato in Apple Salute
  }
}

/** Da chiamare prima di cancellare la voce dal DB. */
export async function removeFoodEntryFromHealth(entry: FoodEntry): Promise<void> {
  if (isAndroid) {
    if (canWriteToHealthHere())
      await hc()
        .deleteFoodEntry(entry.id)
        .catch(() => undefined);
    return;
  }
  if (Platform.OS !== 'ios' || !entry.healthSamples) return;
  try {
    await removeSamples(entry.healthSamples);
  } catch {
    // Campioni già cancellati dall'utente in Apple Salute.
  }
}

// Le voci registrate dal coach in chat vanno in Apple Salute come quelle scritte a mano.
setFoodHealthHooks({
  logged: syncFoodEntryToHealth,
  deleted: removeFoodEntryFromHealth,
  mood: writeMoodToHealth,
});
