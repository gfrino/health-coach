import {
  aggregateGroupByPeriod,
  getChanges,
  getGrantedPermissions,
  initialize,
  readRecords,
  type RecordType,
} from 'react-native-health-connect';

import { healthDataRepository, type Db } from '@/db';
import { DAY_MS } from '@/lib/dates';

import { mergeBatches, type NormalizedBatch } from '../model';
import {
  HC_DAILY_AGGREGATES,
  normalizeHCDailyGroup,
  normalizeHCRecord,
  SOURCE_HEALTH_CONNECT as SRC,
} from '../normalize/healthConnect';
import type { SyncProgress, SyncReport } from '../syncTypes';

/** Senza il permesso "storico", Health Connect consente solo i 30 giorni precedenti al consenso. */
const HISTORY_DAYS = 365;
const DEFAULT_DAYS = 30;
const RECENT_DAYS = 3;
const TOKEN_KEY = 'changes';

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
];

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
    }
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
      const rows = groups.flatMap((g) => normalizeHCDailyGroup(a.recordType, g as never));
      report.upserted += await healthDataRepository.upsertMetrics(db, rows);
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
