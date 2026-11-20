import {
  deleteRecordsByUuids,
  getGrantedPermissions,
  initialize,
  insertRecords,
  requestPermission,
  type HealthConnectRecord,
  type Permission,
  type RecordType,
} from 'react-native-health-connect';

import type { FoodEntry, FoodMeal } from '@/db/repositories/foodRepository';
import { useSettingsStore } from '@/store/settingsStore';

import { OWN_CLIENT_ID_PREFIX } from '../normalize/healthConnect';

/**
 * Scrittura in Health Connect (Android, dalla build 1.40.0): pasti del diario, acqua, peso e
 * altezza inseriti a mano. Ogni record ha un clientRecordId "alba-…": così si aggiorna o si
 * cancella senza salvare gli id di Health Connect, e in lettura si salta (è già nell'app).
 */

export const WRITE_TYPES = ['Nutrition', 'Hydration', 'Weight', 'Height'] as const;
type WriteType = (typeof WRITE_TYPES)[number];

const foodId = (id: string) => `${OWN_CLIENT_ID_PREFIX}food-${id}`;
const waterId = (id: string) => `${OWN_CLIENT_ID_PREFIX}${id}`;
const bodyId = (id: string) => `${OWN_CLIENT_ID_PREFIX}${id}`;

const MEAL: Record<FoodMeal, number> = { breakfast: 1, lunch: 2, dinner: 3, snack: 4 };

/** Permesso di scrittura: chiesto una volta (e di nuovo se l'app scrive tipi nuovi). */
async function writable(): Promise<Set<string>> {
  if (!(await initialize())) return new Set();
  const store = useSettingsStore.getState();
  const food = store.settings.food;
  if ((food.healthAskedTypes ?? 0) < WRITE_TYPES.length || !food.healthAskedAt) {
    await store.update({
      food: { ...food, healthAskedAt: Date.now(), healthAskedTypes: WRITE_TYPES.length },
    });
    await requestPermission(
      WRITE_TYPES.map((recordType): Permission => ({ accessType: 'write', recordType })),
    );
  }
  const granted = await getGrantedPermissions();
  return new Set(granted.filter((p) => p.accessType === 'write').map((p) => p.recordType));
}

async function insert(type: WriteType, record: HealthConnectRecord): Promise<boolean> {
  const allowed = await writable();
  if (!allowed.has(type)) return false;
  await insertRecords([record]);
  return true;
}

const g = (value: number | null | undefined) =>
  value != null && value > 0 ? { unit: 'grams' as const, value } : undefined;
const mg = (value: number | null | undefined) =>
  value != null && value > 0 ? { unit: 'milligrams' as const, value } : undefined;
const mcg = (value: number | null | undefined) =>
  value != null && value > 0 ? { unit: 'micrograms' as const, value } : undefined;

/** Voce del diario → NutritionRecord (riscritta con lo stesso id se la voce cambia). */
export async function writeFoodEntry(entry: FoodEntry): Promise<void> {
  const start = new Date(entry.eatenAt);
  const end = new Date(entry.eatenAt + 60 * 1000);
  const x = entry.extras ?? {};
  await insert('Nutrition', {
    recordType: 'Nutrition',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    name: entry.name,
    mealType: MEAL[entry.meal] ?? 0,
    energy:
      entry.calories != null && entry.calories > 0
        ? { unit: 'kilocalories', value: entry.calories }
        : undefined,
    protein: g(entry.protein),
    totalCarbohydrate: g(entry.carbs),
    totalFat: g(entry.fat),
    dietaryFiber: g(entry.fiber),
    sugar: g(entry.sugar),
    saturatedFat: g(entry.saturatedFat),
    sodium: mg(entry.sodium),
    caffeine: mg(x.caffeine),
    cholesterol: mg(x.cholesterol),
    potassium: mg(x.potassium),
    magnesium: mg(x.magnesium),
    calcium: mg(x.calcium),
    iron: mg(x.iron),
    vitaminC: mg(x.vitaminC),
    vitaminD: mcg(x.vitaminD),
    metadata: { clientRecordId: foodId(entry.id), clientRecordVersion: Date.now() },
  } as HealthConnectRecord);
}

export async function deleteFoodEntry(entryId: string): Promise<void> {
  if (!(await initialize())) return;
  await deleteRecordsByUuids('Nutrition', [], [foodId(entryId)]);
}

/** Acqua: restituisce il clientRecordId (per l'annullamento), o null se non scritta. */
export async function writeWater(sourceId: string, ml: number, at: number): Promise<string | null> {
  const clientRecordId = waterId(sourceId);
  const ok = await insert('Hydration', {
    recordType: 'Hydration',
    startTime: new Date(at).toISOString(),
    endTime: new Date(at + 60 * 1000).toISOString(),
    volume: { unit: 'milliliters', value: ml },
    metadata: { clientRecordId, clientRecordVersion: 1 },
  } as HealthConnectRecord);
  return ok ? clientRecordId : null;
}

export async function deleteWater(clientRecordId: string): Promise<void> {
  if (!(await initialize())) return;
  await deleteRecordsByUuids('Hydration', [], [clientRecordId]);
}

export async function writeBody(
  kind: 'weight' | 'height',
  sourceId: string,
  value: number,
  at: number,
): Promise<void> {
  const metadata = { clientRecordId: bodyId(sourceId), clientRecordVersion: 1 };
  const time = new Date(at).toISOString();
  if (kind === 'weight') {
    await insert('Weight', {
      recordType: 'Weight',
      time,
      weight: { unit: 'kilograms', value },
      metadata,
    } as HealthConnectRecord);
  } else {
    await insert('Height', {
      recordType: 'Height',
      time,
      height: { unit: 'meters', value: value / 100 },
      metadata,
    } as HealthConnectRecord);
  }
}

/** Per i test e per i totali: i record scritti da AlbA. */
export const isOwnClientId = (id: string | undefined) => !!id?.startsWith(OWN_CLIENT_ID_PREFIX);
export type { RecordType };
