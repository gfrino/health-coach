import type {
  MetricType,
  NormalizedMetric,
  NormalizedSleepSession,
  NormalizedWorkout,
  StageInterval,
} from '@/sources/model';

import { newId } from '../ids';
import type { Db } from '../types';

/**
 * Scrittura e lettura dei dati di salute normalizzati. Tutte le scritture sono
 * idempotenti: UNIQUE(source, source_id) + upsert = nessun duplicato tra sincronizzazioni.
 */

const CHUNK = 400;

/** Righe per INSERT multiplo: 9 parametri × 100 = 900, sotto il limite di SQLite (999). */
const ROWS_PER_INSERT = 100;

export async function upsertMetrics(db: Db, rows: NormalizedMetric[]): Promise<number> {
  if (!rows.length) return 0;
  // Nello stesso INSERT una riga non può aggiornarsi due volte: si tiene l'ultima per source_id.
  const unique = [...new Map(rows.map((m) => [`${m.source}\u0000${m.sourceId}`, m])).values()];
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < unique.length; i += ROWS_PER_INSERT) {
      const chunk = unique.slice(i, i + ROWS_PER_INSERT);
      await db.runAsync(
        `INSERT INTO metrics (id, type, value, unit, start_at, end_at, source, source_id, metadata)
         VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
         ON CONFLICT (source, source_id) DO UPDATE SET type = excluded.type, value = excluded.value,
           unit = excluded.unit, start_at = excluded.start_at, end_at = excluded.end_at, metadata = excluded.metadata`,
        chunk.flatMap((m) => [
          newId(),
          m.type,
          m.value,
          m.unit,
          m.startAt,
          m.endAt,
          m.source,
          m.sourceId,
          m.metadata ? JSON.stringify(m.metadata) : null,
        ]),
      );
    }
  });
  return unique.length;
}

export async function upsertWorkouts(db: Db, rows: NormalizedWorkout[]): Promise<number> {
  if (!rows.length) return 0;
  await db.withTransactionAsync(async () => {
    for (const w of rows) {
      await db.runAsync(
        `INSERT INTO workouts (id, activity_type, start_at, end_at, duration_s, energy_kcal, distance_m, source, source_id, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source, source_id) DO UPDATE SET activity_type = excluded.activity_type,
           start_at = excluded.start_at, end_at = excluded.end_at, duration_s = excluded.duration_s,
           energy_kcal = excluded.energy_kcal, distance_m = excluded.distance_m, metadata = excluded.metadata`,
        [
          newId(),
          w.activityType,
          w.startAt,
          w.endAt,
          w.durationS,
          w.energyKcal,
          w.distanceM,
          w.source,
          w.sourceId,
          w.metadata ? JSON.stringify(w.metadata) : null,
        ],
      );
    }
  });
  return rows.length;
}

export async function upsertSleepSessions(db: Db, rows: NormalizedSleepSession[]): Promise<number> {
  if (!rows.length) return 0;
  await db.withTransactionAsync(async () => {
    for (const s of rows) {
      await db.runAsync(
        `INSERT INTO sleep_sessions (id, start_at, end_at, in_bed_s, asleep_s, stages, source, source_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source, source_id) DO UPDATE SET start_at = excluded.start_at, end_at = excluded.end_at,
           in_bed_s = excluded.in_bed_s, asleep_s = excluded.asleep_s, stages = excluded.stages`,
        [
          newId(),
          s.startAt,
          s.endAt,
          s.inBedS,
          s.asleepS,
          JSON.stringify(s.stages),
          s.source,
          s.sourceId,
        ],
      );
    }
  });
  return rows.length;
}

/** Sostituisce le notti ricostruite di una sorgente da una certa data in poi (i confini cambiano con nuovi campioni). */
export async function replaceSleepSessions(
  db: Db,
  source: string,
  fromMs: number,
  rows: NormalizedSleepSession[],
) {
  await db.runAsync('DELETE FROM sleep_sessions WHERE source = ? AND end_at >= ?', [
    source,
    fromMs,
  ]);
  await upsertSleepSessions(db, rows);
}

/** Elimina i campioni cancellati nella sorgente (dalle 3 tabelle: l'id può essere di qualunque tipo). */
export async function deleteBySourceIds(
  db: Db,
  source: string,
  sourceIds: string[],
): Promise<number> {
  if (!sourceIds.length) return 0;
  let deleted = 0;
  for (let i = 0; i < sourceIds.length; i += CHUNK) {
    const chunk = sourceIds.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(',');
    for (const table of ['metrics', 'workouts', 'sleep_sessions']) {
      const r = await db.runAsync(
        `DELETE FROM ${table} WHERE source = ? AND source_id IN (${placeholders})`,
        [source, ...chunk],
      );
      deleted += r.changes;
    }
    // Health Connect: una misura multipla (es. pressione "id:sys"/"id:dia") ha id con suffisso.
    for (const id of chunk) {
      const r = await db.runAsync(
        "DELETE FROM metrics WHERE source = ? AND source_id LIKE ? ESCAPE '\\'",
        [source, `${id.replace(/[\\%_]/g, (c) => `\\${c}`)}:%`],
      );
      deleted += r.changes;
    }
  }
  return deleted;
}

export async function stageSamplesSince(
  db: Db,
  source: string,
  fromMs: number,
): Promise<StageInterval[]> {
  const rows = await db.getAllAsync<{ value: number; start_at: number; end_at: number }>(
    "SELECT value, start_at, end_at FROM metrics WHERE source = ? AND type = 'sleepStage' AND end_at >= ? ORDER BY start_at",
    [source, fromMs],
  );
  return rows.map((r) => ({ stage: r.value, startAt: r.start_at, endAt: r.end_at }));
}

// ---- Stato della sincronizzazione (anchor HealthKit / changes token Health Connect) ----

export interface SyncState {
  anchor: string | null;
  lastSyncedAt: number | null;
  lastError: string | null;
}

export async function getSyncState(
  db: Db,
  source: string,
  dataType: string,
): Promise<SyncState | null> {
  const r = await db.getFirstAsync<{
    anchor: string | null;
    last_synced_at: number | null;
    last_error: string | null;
  }>(
    'SELECT anchor, last_synced_at, last_error FROM sync_state WHERE source = ? AND data_type = ?',
    [source, dataType],
  );
  return r ? { anchor: r.anchor, lastSyncedAt: r.last_synced_at, lastError: r.last_error } : null;
}

export async function setSyncState(
  db: Db,
  source: string,
  dataType: string,
  patch: Partial<SyncState>,
) {
  const cur = (await getSyncState(db, source, dataType)) ?? {
    anchor: null,
    lastSyncedAt: null,
    lastError: null,
  };
  const next = { ...cur, ...patch };
  await db.runAsync(
    `INSERT INTO sync_state (source, data_type, anchor, last_synced_at, last_error) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (source, data_type) DO UPDATE SET anchor = excluded.anchor, last_synced_at = excluded.last_synced_at,
       last_error = excluded.last_error`,
    [source, dataType, next.anchor, next.lastSyncedAt, next.lastError],
  );
}

export async function lastSyncAt(db: Db, source: string): Promise<number | null> {
  const r = await db.getFirstAsync<{ t: number | null }>(
    'SELECT MAX(last_synced_at) AS t FROM sync_state WHERE source = ?',
    [source],
  );
  return r?.t ?? null;
}

export async function clearSource(db: Db, source: string) {
  await db.withTransactionAsync(async () => {
    for (const table of ['metrics', 'workouts', 'sleep_sessions']) {
      await db.runAsync(`DELETE FROM ${table} WHERE source = ?`, [source]);
    }
    await db.runAsync('DELETE FROM sync_state WHERE source = ?', [source]);
  });
}

// ---- Letture per dashboard e coach ----

export async function latestMetric(
  db: Db,
  type: MetricType,
): Promise<{ value: number; at: number } | null> {
  const r = await db.getFirstAsync<{ value: number; end_at: number }>(
    'SELECT value, end_at FROM metrics WHERE type = ? ORDER BY end_at DESC LIMIT 1',
    [type],
  );
  return r ? { value: r.value, at: r.end_at } : null;
}

export interface NightSummary {
  day: string;
  startAt: number;
  endAt: number;
  asleepMin: number;
  inBedMin: number | null;
  stages: StageInterval[];
}

/** Una notte per giorno di risveglio: se ci sono più sessioni/sorgenti, si tiene la più lunga. */
export async function nightsBetween(db: Db, fromMs: number, toMs: number): Promise<NightSummary[]> {
  const rows = await db.getAllAsync<{
    start_at: number;
    end_at: number;
    asleep_s: number;
    in_bed_s: number | null;
    stages: string | null;
    day: string;
  }>(
    `SELECT start_at, end_at, asleep_s, in_bed_s, stages, date(end_at / 1000, 'unixepoch', 'localtime') AS day
     FROM sleep_sessions WHERE end_at >= ? AND end_at < ? ORDER BY day, asleep_s DESC`,
    [fromMs, toMs],
  );
  const byDay = new Map<string, NightSummary>();
  for (const r of rows) {
    if (byDay.has(r.day)) continue;
    let stages: StageInterval[] = [];
    try {
      stages = r.stages ? (JSON.parse(r.stages) as StageInterval[]) : [];
    } catch {
      stages = [];
    }
    byDay.set(r.day, {
      day: r.day,
      startAt: r.start_at,
      endAt: r.end_at,
      asleepMin: Math.round(r.asleep_s / 60),
      inBedMin: r.in_bed_s != null ? Math.round(r.in_bed_s / 60) : null,
      stages,
    });
  }
  return [...byDay.values()];
}

export interface WorkoutRow {
  activityType: string;
  startAt: number;
  durationMin: number | null;
  energyKcal: number | null;
  distanceKm: number | null;
}

export async function workoutsBetween(
  db: Db,
  fromMs: number,
  toMs: number,
  limit = 50,
): Promise<WorkoutRow[]> {
  const rows = await db.getAllAsync<{
    activity_type: string;
    start_at: number;
    duration_s: number | null;
    energy_kcal: number | null;
    distance_m: number | null;
  }>(
    'SELECT activity_type, start_at, duration_s, energy_kcal, distance_m FROM workouts WHERE start_at >= ? AND start_at < ? ORDER BY start_at DESC LIMIT ?',
    [fromMs, toMs, limit],
  );
  return rows.map((r) => ({
    activityType: r.activity_type,
    startAt: r.start_at,
    durationMin: r.duration_s != null ? Math.round(r.duration_s / 60) : null,
    energyKcal: r.energy_kcal != null ? Math.round(r.energy_kcal) : null,
    distanceKm: r.distance_m != null ? Math.round(r.distance_m / 10) / 100 : null,
  }));
}

export async function hasAnyHealthData(db: Db): Promise<boolean> {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT (SELECT COUNT(*) FROM metrics) + (SELECT COUNT(*) FROM sleep_sessions) + (SELECT COUNT(*) FROM workouts) AS n',
    [],
  );
  return (r?.n ?? 0) > 0;
}
