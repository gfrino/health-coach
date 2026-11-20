import { healthDataRepository, type Db } from '@/db';
import { newId } from '@/db/ids';
import { METRIC_UNITS } from '@/sources/model';

/**
 * Acqua bevuta, aggiunta con un tocco dal diario (pulsante a goccia). Si salva come misura "water"
 * con fonte "manual", accanto a quella letta da Apple Salute / Health Connect: il totale del giorno
 * le somma tutte e il coach la vede come le altre misure. Resta sul telefono.
 */

export const WATER_SOURCE = 'manual';

/** Quantità rapide in ml, con l'icona e la chiave del testo. */
export const WATER_PRESETS = [
  { key: 'glass', ml: 200 },
  { key: 'cup', ml: 250 },
  { key: 'can', ml: 330 },
  { key: 'half', ml: 500 },
  { key: 'bottle', ml: 750 },
  { key: 'liter', ml: 1000 },
] as const;
export type WaterPresetKey = (typeof WATER_PRESETS)[number]['key'];

/**
 * Obiettivo di acqua da bere se l'utente non l'ha scelto. L'EFSA (2010, tema "hydration" delle
 * fonti) indica un'assunzione adeguata di acqua totale di 2,0 L per le donne e 2,5 L per gli uomini;
 * circa l'80% arriva dalle bevande, il resto dal cibo: 1,6 L e 2,0 L da bere. Senza sesso: 2,0 L.
 */
export function defaultWaterTarget(sex: 'female' | 'male' | 'other' | null): number {
  return sex === 'female' ? 1600 : 2000;
}

const dayStart = (day: string) => new Date(`${day}T00:00:00`).getTime();
const nextDayStart = (day: string) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.getTime();
};

/** Momento della voce: adesso se il giorno è oggi, altrimenti mezzogiorno del giorno mostrato. */
export function waterTime(day: string, now: Date): number {
  const noon = new Date(`${day}T12:00:00`).getTime();
  return dayStart(day) <= now.getTime() && now.getTime() < nextDayStart(day) ? now.getTime() : noon;
}

export async function addWater(db: Db, ml: number, at: number): Promise<void> {
  if (!(ml > 0)) return;
  await healthDataRepository.upsertMetrics(db, [
    {
      type: 'water',
      value: Math.round(ml),
      unit: METRIC_UNITS.water,
      startAt: at,
      endAt: at,
      source: WATER_SOURCE,
      sourceId: `water-${newId()}`,
    },
  ]);
}

/** Acqua del giorno: totale (tutte le fonti) e quanta aggiunta a mano (annullabile). */
export async function waterOfDay(db: Db, day: string): Promise<{ total: number; manual: number }> {
  const row = await db.getFirstAsync<{ total: number | null; manual: number | null }>(
    `SELECT SUM(value) AS total, SUM(CASE WHEN source = ? THEN value ELSE 0 END) AS manual
     FROM metrics WHERE type = 'water' AND start_at >= ? AND start_at < ?`,
    [WATER_SOURCE, dayStart(day), nextDayStart(day)],
  );
  return { total: Math.round(row?.total ?? 0), manual: Math.round(row?.manual ?? 0) };
}

/** Toglie l'ultima aggiunta a mano del giorno (per un tocco sbagliato). */
export async function undoLastWater(db: Db, day: string): Promise<boolean> {
  const last = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM metrics WHERE type = 'water' AND source = ? AND start_at >= ? AND start_at < ?
     ORDER BY start_at DESC, rowid DESC LIMIT 1`,
    [WATER_SOURCE, dayStart(day), nextDayStart(day)],
  );
  if (!last) return false;
  await db.runAsync('DELETE FROM metrics WHERE id = ?', [last.id]);
  return true;
}
