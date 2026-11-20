import { healthDataRepository, profileRepository, type Db } from '@/db';
import { newId } from '@/db/ids';
import { METRIC_UNITS } from '@/sources/model';

/**
 * Peso e altezza del profilo seguono l'ultima misura (Apple Salute, Health Connect o inserita a
 * mano): il profilo, le calorie e il coach usano lo stesso valore. Il valore scritto a mano nel
 * profilo diventa una misura (fonte "manual"), così vale come una pesata.
 */

export const MANUAL_SOURCE = 'manual';

export interface LatestBody {
  value: number;
  at: number;
  source: string;
}

export async function latestBody(db: Db, type: 'weight' | 'height'): Promise<LatestBody | null> {
  const r = await db.getFirstAsync<{ value: number; end_at: number; source: string }>(
    'SELECT value, end_at, source FROM metrics WHERE type = ? ORDER BY end_at DESC LIMIT 1',
    [type],
  );
  return r ? { value: r.value, at: r.end_at, source: r.source } : null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Dopo ogni sincronizzazione: il profilo prende l'ultima pesata e l'ultima altezza. */
export async function syncProfileBody(db: Db): Promise<boolean> {
  const [p, w, h] = await Promise.all([
    profileRepository.getProfile(db),
    latestBody(db, 'weight'),
    latestBody(db, 'height'),
  ]);
  const patch: { weightKg?: number; heightCm?: number } = {};
  if (w && r1(w.value) !== p.weightKg) patch.weightKg = r1(w.value);
  if (h && Math.round(h.value) !== p.heightCm) patch.heightCm = Math.round(h.value);
  if (!Object.keys(patch).length) return false;
  await profileRepository.saveProfile(db, patch);
  return true;
}

/** Peso o altezza scritti a mano: diventano una misura di adesso. Restituisce l'id della voce. */
export async function recordManualBody(
  db: Db,
  type: 'weight' | 'height',
  value: number,
  at = Date.now(),
): Promise<string> {
  const sourceId = `${type}-${newId()}`;
  await healthDataRepository.upsertMetrics(db, [
    {
      type,
      value,
      unit: METRIC_UNITS[type],
      startAt: at,
      endAt: at,
      source: MANUAL_SOURCE,
      sourceId,
    },
  ]);
  return sourceId;
}
