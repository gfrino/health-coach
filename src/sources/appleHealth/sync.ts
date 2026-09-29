import {
  queryCategorySamplesWithAnchor,
  queryQuantitySamplesWithAnchor,
  queryStatisticsCollectionForQuantity,
  queryWorkoutSamplesWithAnchor,
  type CategoryTypeIdentifier,
  type QuantityTypeIdentifier,
} from '@kingstinct/react-native-healthkit';

import { healthDataRepository, type Db } from '@/db';
import { DAY_MS } from '@/lib/dates';

import type { NormalizedMetric } from '../model';
import {
  HK_MENSTRUAL_FLOW,
  HK_MINDFUL,
  HK_QUANTITY,
  HK_SLEEP,
  normalizeDailyStatistic,
  normalizeMenstrualSample,
  normalizeMindfulSample,
  normalizeQuantitySample,
  normalizeSleepSample,
  normalizeWorkout,
  SOURCE_APPLE_HEALTH as SRC,
} from '../normalize/healthKit';
import { buildSleepSessions } from '../sleep';
import type { SyncProgress, SyncReport } from '../syncTypes';

/** Storico letto alla prima sincronizzazione. */
const INITIAL_DAYS = 365;
/** La frequenza cardiaca produce migliaia di campioni al giorno: storico più corto. */
const INITIAL_DAYS_HEART_RATE = 30;
/** Totali giornalieri ricalcolati a ogni sync (dati arrivati in ritardo dal Watch, modifiche). */
const RECENT_DAYS = 3;
/** Ricalcolo più ampio periodico dei totali giornalieri. */
const DEEP_REFRESH_DAYS = 30;
const DEEP_REFRESH_EVERY_MS = 7 * DAY_MS;
const PAGE = 5000;

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Query con anchor paginata: restituisce tutti i campioni nuovi, le cancellazioni e il nuovo anchor. */
async function anchored<T>(
  fetchPage: (
    anchor: string | undefined,
  ) => Promise<{ items: readonly T[]; deleted: readonly { uuid: string }[]; newAnchor: string }>,
  startAnchor: string | undefined,
) {
  let anchor = startAnchor;
  const items: T[] = [];
  const deleted: string[] = [];
  for (let page = 0; page < 200; page++) {
    const res = await fetchPage(anchor);
    items.push(...res.items);
    deleted.push(...res.deleted.map((d) => d.uuid));
    anchor = res.newAnchor;
    if (res.items.length < PAGE) break;
  }
  return { items, deleted, anchor };
}

export async function syncAppleHealth(
  db: Db,
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncReport> {
  const now = Date.now();
  const report: SyncReport = { upserted: 0, deleted: 0, errors: [] };
  const quantityIds = Object.keys(HK_QUANTITY) as QuantityTypeIdentifier[];
  const steps = quantityIds.length + 4;
  let done = 0;
  const tick = (label: string) => onProgress?.({ done: ++done, total: steps, label });

  const guard = async (dataType: string, fn: () => Promise<void>) => {
    try {
      await fn();
      await healthDataRepository.setSyncState(db, SRC, dataType, {
        lastSyncedAt: Date.now(),
        lastError: null,
      });
    } catch (e) {
      // Tipo non autorizzato o non disponibile: si salta senza bloccare gli altri.
      const message = e instanceof Error ? e.message : String(e);
      report.errors.push({ dataType, message });
      await healthDataRepository.setSyncState(db, SRC, dataType, {
        lastError: message.slice(0, 300),
      });
    }
  };

  // 1) Quantità
  for (const id of quantityIds) {
    const mapping = HK_QUANTITY[id];
    if (!mapping) continue;
    await guard(id, async () => {
      const state = await healthDataRepository.getSyncState(db, SRC, id);

      if (mapping.cumulative) {
        // Totali giornalieri deduplicati da HealthKit (iPhone + Watch non vengono sommati due volte).
        const deep = !state?.anchor || now - Number(state.anchor) > DEEP_REFRESH_EVERY_MS;
        const days = !state?.lastSyncedAt ? INITIAL_DAYS : deep ? DEEP_REFRESH_DAYS : RECENT_DAYS;
        const from = startOfDay(now - (days - 1) * DAY_MS);
        const stats = await queryStatisticsCollectionForQuantity(
          id,
          ['cumulativeSum'],
          from,
          { day: 1 },
          {
            filter: { date: { startDate: from, endDate: new Date(now) } },
            unit: mapping.unit as never,
          },
        );
        const rows = stats
          .map((s) => normalizeDailyStatistic(id, s))
          .filter((m): m is NormalizedMetric => m !== null);
        report.upserted += await healthDataRepository.upsertMetrics(db, rows);
        if (deep || !state?.lastSyncedAt) {
          await healthDataRepository.setSyncState(db, SRC, id, { anchor: String(now) });
        }
        return;
      }

      const initialDays = mapping.type === 'heartRate' ? INITIAL_DAYS_HEART_RATE : INITIAL_DAYS;
      const res = await anchored(async (anchor) => {
        const r = await queryQuantitySamplesWithAnchor(id, {
          limit: PAGE,
          unit: mapping.unit as never,
          anchor,
          filter: anchor
            ? undefined
            : { date: { startDate: new Date(now - initialDays * DAY_MS) } },
        });
        return { items: r.samples, deleted: r.deletedSamples, newAnchor: r.newAnchor };
      }, state?.anchor ?? undefined);
      const rows = res.items
        .map((s) => normalizeQuantitySample(id, s))
        .filter((m): m is NormalizedMetric => m !== null);
      report.upserted += await healthDataRepository.upsertMetrics(db, rows);
      report.deleted += await healthDataRepository.deleteBySourceIds(db, SRC, res.deleted);
      await healthDataRepository.setSyncState(db, SRC, id, { anchor: res.anchor ?? null });
    });
    tick(mapping.type);
  }

  // 2) Sonno: fasi → notti ricostruite
  await guard(HK_SLEEP, async () => {
    const state = await healthDataRepository.getSyncState(db, SRC, HK_SLEEP);
    const res = await anchored(async (anchor) => {
      const r = await queryCategorySamplesWithAnchor(HK_SLEEP as CategoryTypeIdentifier, {
        limit: PAGE,
        anchor,
        filter: anchor ? undefined : { date: { startDate: new Date(now - INITIAL_DAYS * DAY_MS) } },
      });
      return { items: r.samples, deleted: r.deletedSamples, newAnchor: r.newAnchor };
    }, state?.anchor ?? undefined);
    const rows = res.items
      .map((s) => normalizeSleepSample({ ...s, value: Number(s.value) }))
      .filter((m): m is NormalizedMetric => m !== null);
    report.upserted += await healthDataRepository.upsertMetrics(db, rows);
    report.deleted += await healthDataRepository.deleteBySourceIds(db, SRC, res.deleted);
    if (rows.length || res.deleted.length) {
      const changedFrom = rows.length ? Math.min(...rows.map((r) => r.startAt)) : now - 2 * DAY_MS;
      const from = changedFrom - DAY_MS;
      const samples = await healthDataRepository.stageSamplesSince(db, SRC, from - DAY_MS);
      const sessions = buildSleepSessions(samples, SRC).filter((s) => s.endAt >= from);
      await healthDataRepository.replaceSleepSessions(db, SRC, from, sessions);
      report.upserted += sessions.length;
    }
    await healthDataRepository.setSyncState(db, SRC, HK_SLEEP, { anchor: res.anchor ?? null });
  });
  tick('sleep');

  // 3) Mindfulness e ciclo mestruale
  for (const [id, normalize] of [
    [HK_MINDFUL, (s: Parameters<typeof normalizeMindfulSample>[0]) => normalizeMindfulSample(s)],
    [
      HK_MENSTRUAL_FLOW,
      (s: Parameters<typeof normalizeMenstrualSample>[0]) => normalizeMenstrualSample(s),
    ],
  ] as const) {
    await guard(id, async () => {
      const state = await healthDataRepository.getSyncState(db, SRC, id);
      const res = await anchored(async (anchor) => {
        const r = await queryCategorySamplesWithAnchor(id as CategoryTypeIdentifier, {
          limit: PAGE,
          anchor,
          filter: anchor
            ? undefined
            : { date: { startDate: new Date(now - INITIAL_DAYS * DAY_MS) } },
        });
        return { items: r.samples, deleted: r.deletedSamples, newAnchor: r.newAnchor };
      }, state?.anchor ?? undefined);
      const rows = res.items
        .map((s) => normalize({ ...s, value: Number(s.value) }))
        .filter((m): m is NormalizedMetric => m !== null);
      report.upserted += await healthDataRepository.upsertMetrics(db, rows);
      report.deleted += await healthDataRepository.deleteBySourceIds(db, SRC, res.deleted);
      await healthDataRepository.setSyncState(db, SRC, id, { anchor: res.anchor ?? null });
    });
    tick(id === HK_MINDFUL ? 'mindfulness' : 'cycle');
  }

  // 4) Allenamenti
  await guard('workouts', async () => {
    const state = await healthDataRepository.getSyncState(db, SRC, 'workouts');
    const res = await anchored(async (anchor) => {
      const r = await queryWorkoutSamplesWithAnchor({
        limit: PAGE,
        anchor,
        filter: anchor ? undefined : { date: { startDate: new Date(now - INITIAL_DAYS * DAY_MS) } },
      });
      return { items: r.workouts, deleted: r.deletedSamples, newAnchor: r.newAnchor };
    }, state?.anchor ?? undefined);
    const rows = res.items.map((w) => normalizeWorkout(w.toJSON()));
    report.upserted += await healthDataRepository.upsertWorkouts(db, rows);
    report.deleted += await healthDataRepository.deleteBySourceIds(db, SRC, res.deleted);
    await healthDataRepository.setSyncState(db, SRC, 'workouts', { anchor: res.anchor ?? null });
  });
  tick('workouts');

  return report;
}
