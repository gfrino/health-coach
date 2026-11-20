import {
  aggregateGroupByPeriod,
  getChanges,
  getGrantedPermissions,
  initialize,
  readRecords,
  type RecordType,
} from 'react-native-health-connect';

import Constants from 'expo-constants';

import { healthDataRepository, type Db } from '@/db';
import { DAY_MS } from '@/lib/dates';

import { mergeBatches, type NormalizedBatch } from '../model';
import {
  HC_DAILY_AGGREGATES,
  normalizeHCDailyGroup,
  ownContributions,
  subtractOwn,
  normalizeHCRecord,
  SOURCE_HEALTH_CONNECT as SRC,
} from '../normalize/healthConnect';
import type { SyncProgress, SyncReport } from '../syncTypes';

/** Senza il permesso "storico", Health Connect consente solo i 30 giorni precedenti al consenso. */
const HISTORY_DAYS = 365;
const DEFAULT_DAYS = 30;
const RECENT_DAYS = 3;
const TOKEN_KEY = 'changes';
/** Tipi coperti dal changes token: se ne arrivano di nuovi (aggiornamento o permessi) si leggono da capo. */
const TOKEN_TYPES_KEY = 'changes_types';

/** Record letti singolarmente (i cumulativi arrivano dagli aggregati giornalieri). */
const RECORD_TYPES: RecordType[] = [
  'HeartRate',
  'RestingHeartRate',
  'HeartRateVariabilityRmssd',
  'Vo2Max',
  'Weight',
  'Height',
  'BodyFat',
  'LeanBodyMass',
  'BloodPressure',
  'BloodGlucose',
  'OxygenSaturation',
  'RespiratoryRate',
  'BodyTemperature',
  'MenstruationFlow',
  'MenstruationPeriod',
  'MindfulnessSession',
  'ExerciseSession',
  'SleepSession',
  // Il resto di Health Connect (1.40.0)
  'BasalBodyTemperature',
  'BodyWaterMass',
  'BoneMass',
  'SkinTemperature',
  'Speed',
  'Power',
  'StepsCadence',
  'CyclingPedalingCadence',
  'CervicalMucus',
  'OvulationTest',
  'IntermenstrualBleeding',
  'SexualActivity',
];

/** Tipi letti fino alla 1.39 (il token di allora copriva solo questi). */
const LEGACY_TYPES = new Set<string>(
  RECORD_TYPES.slice(0, RECORD_TYPES.indexOf('BasalBodyTemperature')),
);

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

async function writeBatch(db: Db, batch: NormalizedBatch) {
  return (
    (await healthDataRepository.upsertMetrics(db, batch.metrics)) +
    (await healthDataRepository.upsertWorkouts(db, batch.workouts)) +
    (await healthDataRepository.upsertSleepSessions(db, batch.sleep))
  );
}

/** Record di AlbA (pasti, acqua) nel periodo: da togliere dai totali giornalieri di Health Connect. */
async function ownTotals(recordType: string, fromMs: number, toMs: number) {
  if (recordType !== 'Nutrition' && recordType !== 'Hydration') return [];
  const pkg = Constants.expoConfig?.android?.package;
  if (!pkg) return [];
  try {
    const out: ReturnType<typeof ownContributions> = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 50; page++) {
      const res = await readRecords(
        recordType as RecordType,
        {
          timeRangeFilter: {
            operator: 'between',
            startTime: new Date(fromMs).toISOString(),
            endTime: new Date(toMs).toISOString(),
          },
          dataOriginFilter: [pkg],
          pageSize: 1000,
          pageToken,
        } as Parameters<typeof readRecords>[1],
      );
      for (const r of res.records) out.push(...ownContributions(r as never));
      pageToken = res.pageToken;
      if (!pageToken) break;
    }
    return out;
  } catch {
    return []; // senza permesso di lettura dei propri record: niente da togliere
  }
}

async function readAll(recordType: RecordType, fromMs: number, toMs: number) {
  const batches: NormalizedBatch[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 500; page++) {
    const res = await readRecords(recordType, {
      timeRangeFilter: {
        operator: 'between',
        startTime: new Date(fromMs).toISOString(),
        endTime: new Date(toMs).toISOString(),
      },
      pageSize: 1000,
      pageToken,
    } as Parameters<typeof readRecords>[1]);
    for (const r of res.records) batches.push(normalizeHCRecord(r as never));
    pageToken = res.pageToken;
    if (!pageToken) break;
  }
  return mergeBatches(batches);
}

export async function syncHealthConnect(
  db: Db,
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncReport> {
  const report: SyncReport = { upserted: 0, deleted: 0, errors: [] };
  if (!(await initialize())) throw new Error('Health Connect non disponibile');

  const now = Date.now();
  const granted = await getGrantedPermissions();
  const readable = new Set(
    granted.filter((p) => p.accessType === 'read').map((p) => p.recordType as string),
  );
  const hasHistory = readable.has('ReadHealthDataHistory');
  const tokenState = await healthDataRepository.getSyncState(db, SRC, TOKEN_KEY);
  const firstSync = !tokenState?.anchor;

  const types = RECORD_TYPES.filter((t) => readable.has(t));
  const tokenTypes = await healthDataRepository.getSyncState(db, SRC, TOKEN_TYPES_KEY);
  const known = new Set<string>(
    tokenTypes?.anchor ? (JSON.parse(tokenTypes.anchor) as string[]) : [],
  );
  // Tipi nuovi rispetto al token (prima build con questi permessi o permesso dato dopo): storico
  // completo solo per loro, poi un token nuovo per tutti.
  const newTypes = firstSync || !tokenTypes?.anchor ? [] : types.filter((t) => !known.has(t));
  const aggregates = HC_DAILY_AGGREGATES.filter((a) => readable.has(a.recordType));
  const total = (firstSync ? types.length : 1) + aggregates.length;
  let done = 0;
  const tick = (label: string) => onProgress?.({ done: ++done, total, label });

  const fail = (dataType: string, e: unknown) =>
    report.errors.push({ dataType, message: e instanceof Error ? e.message : String(e) });

  if (firstSync || tokenState?.lastError === 'expired') {
    // Prima sincronizzazione (o token scaduto): lettura dello storico, poi un nuovo changes token.
    const from = now - (hasHistory ? HISTORY_DAYS : DEFAULT_DAYS) * DAY_MS;
    for (const t of types) {
      try {
        report.upserted += await writeBatch(db, await readAll(t, from, now));
      } catch (e) {
        fail(t, e);
      }
      tick(t);
    }
    if (types.length) {
      const { nextChangesToken } = await getChanges({ recordTypes: types });
      await healthDataRepository.setSyncState(db, SRC, TOKEN_KEY, {
        anchor: nextChangesToken,
        lastSyncedAt: now,
        lastError: null,
      });
      await healthDataRepository.setSyncState(db, SRC, TOKEN_TYPES_KEY, {
        anchor: JSON.stringify(types),
      });
    }
  } else if (newTypes.length) {
    // Prima le modifiche dei tipi già noti, poi lo storico dei nuovi e un token per tutti.
    const from = now - (hasHistory ? HISTORY_DAYS : DEFAULT_DAYS) * DAY_MS;
    for (const t of newTypes) {
      try {
        report.upserted += await writeBatch(db, await readAll(t, from, now));
      } catch (e) {
        fail(t, e);
      }
      tick(t);
    }
    const { nextChangesToken } = await getChanges({ recordTypes: types });
    // Le modifiche dei tipi già noti dall'ultimo token si recuperano con la rilettura recente.
    for (const t of types.filter((x) => known.has(x))) {
      try {
        report.upserted += await writeBatch(db, await readAll(t, now - RECENT_DAYS * DAY_MS, now));
      } catch (e) {
        fail(t, e);
      }
    }
    await healthDataRepository.setSyncState(db, SRC, TOKEN_KEY, {
      anchor: nextChangesToken,
      lastSyncedAt: now,
      lastError: null,
    });
    await healthDataRepository.setSyncState(db, SRC, TOKEN_TYPES_KEY, {
      anchor: JSON.stringify(types),
    });
  } else if (types.length) {
    // Incrementale: solo le modifiche dall'ultimo token.
    try {
      let token = tokenState.anchor ?? undefined;
      for (let page = 0; page < 200; page++) {
        const res = await getChanges({ changesToken: token });
        if (res.changesTokenExpired) {
          await healthDataRepository.setSyncState(db, SRC, TOKEN_KEY, { lastError: 'expired' });
          break;
        }
        const batch = mergeBatches(
          res.upsertionChanges.map((c) => normalizeHCRecord(c.record as never)),
        );
        report.upserted += await writeBatch(db, batch);
        report.deleted += await healthDataRepository.deleteBySourceIds(
          db,
          SRC,
          res.deletionChanges.map((d) => d.recordId),
        );
        token = res.nextChangesToken;
        if (!res.hasMore) break;
      }
      await healthDataRepository.setSyncState(db, SRC, TOKEN_KEY, {
        anchor: token ?? null,
        lastSyncedAt: now,
        lastError: null,
      });
      // Token creato prima della 1.40.0 (senza elenco dei tipi): era fatto con i tipi di allora.
      if (!tokenTypes?.anchor) {
        await healthDataRepository.setSyncState(db, SRC, TOKEN_TYPES_KEY, {
          anchor: JSON.stringify(types.filter((t) => LEGACY_TYPES.has(t))),
        });
      }
    } catch (e) {
      fail(TOKEN_KEY, e);
    }
    tick('changes');
  }

  // Totali giornalieri deduplicati tra app (passi, distanza, calorie, acqua, nutrizione).
  const aggDays = firstSync ? (hasHistory ? HISTORY_DAYS : DEFAULT_DAYS) : RECENT_DAYS;
  const aggFrom = startOfDay(now - (aggDays - 1) * DAY_MS);
  for (const a of aggregates) {
    try {
      const groups = await aggregateGroupByPeriod({
        recordType: a.recordType as never,
        timeRangeFilter: {
          operator: 'between',
          startTime: new Date(aggFrom).toISOString(),
          endTime: new Date(now).toISOString(),
        },
        timeRangeSlicer: { period: 'DAYS', length: 1 },
      });
      const all = groups.flatMap((g) => normalizeHCDailyGroup(a.recordType, g as never));
      const rows = subtractOwn(all, await ownTotals(a.recordType, aggFrom, now));
      report.upserted += await healthDataRepository.upsertMetrics(db, rows);
      // Giorni in cui c'era solo ciò che ha scritto AlbA: la riga del totale non serve più.
      const kept = new Set(rows.map((r) => r.sourceId));
      const dropped = all.filter((r) => !kept.has(r.sourceId)).map((r) => r.sourceId);
      if (dropped.length) await healthDataRepository.deleteBySourceIds(db, SRC, dropped);
      await healthDataRepository.setSyncState(db, SRC, `daily:${a.recordType}`, {
        lastSyncedAt: now,
        lastError: null,
      });
    } catch (e) {
      fail(a.recordType, e);
    }
    tick(a.recordType);
  }

  return report;
}

/** Aggiornamento rapido dei totali di oggi e di ieri, prima di ogni risposta del coach. */
export async function refreshTodayHealthConnect(db: Db): Promise<number> {
  if (!(await initialize())) return 0;
  const now = Date.now();
  const readable = new Set(
    (await getGrantedPermissions())
      .filter((p) => p.accessType === 'read')
      .map((p) => p.recordType as string),
  );
  const from = startOfDay(now - DAY_MS);
  const results = await Promise.all(
    HC_DAILY_AGGREGATES.filter((a) => readable.has(a.recordType)).map(async (a) => {
      try {
        const groups = await aggregateGroupByPeriod({
          recordType: a.recordType as never,
          timeRangeFilter: {
            operator: 'between',
            startTime: new Date(from).toISOString(),
            endTime: new Date(now).toISOString(),
          },
          timeRangeSlicer: { period: 'DAYS', length: 1 },
        });
        return subtractOwn(
          groups.flatMap((g) => normalizeHCDailyGroup(a.recordType, g as never)),
          await ownTotals(a.recordType, from, now),
        );
      } catch {
        return [];
      }
    }),
  );
  return healthDataRepository.upsertMetrics(db, results.flat());
}
