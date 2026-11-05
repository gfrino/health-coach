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
  FOOD_ENTRY_METADATA_KEY,
  FOOD_WRITE_TYPES,
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

const ownFood = (id: string) => (FOOD_WRITE_TYPES as readonly string[]).includes(id);

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
/** Letture da HealthKit in parallelo (le scritture nel DB restano una alla volta). */
const READ_CONCURRENCY = 4;
/** Versione del calcolo delle notti: se cambia, alla sync successiva si ricostruiscono tutte. */
const SLEEP_ALGORITHM = '2';

/**
 * Tempo massimo per una singola query a HealthKit. Se iOS sospende l'app mentre una query è in
 * corso (sync in background), la risposta può non arrivare mai: senza limite la sincronizzazione
 * resterebbe appesa e ogni "Sincronizza ora" successivo aspetterebbe lei, rotellina per sempre.
 */
export const HK_TIMEOUT_MS = 60 * 1000;

/** Query HealthKit con limite di tempo: oltre `HK_TIMEOUT_MS` fallisce e il tipo viene saltato. */
export function hk<T>(query: Promise<T>, what: string, ms = HK_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`HealthKit timeout: ${what}`)), ms);
  });
  return Promise.race([query, timeout]).finally(() => clearTimeout(timer));
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Esegue `fn` su tutti gli elementi con al massimo `limit` chiamate contemporanee, in ordine. */
async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>) {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

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

/**
 * Sonno: legge le nuove fasi e ricostruisce le notti cambiate. Veloce (query con anchor), per
 * questo si fa per primo nella sincronizzazione e anche prima delle risposte del coach: la mattina
 * conta avere la notte appena finita appena Apple Salute la riceve dal Watch.
 */
export async function syncAppleHealthSleep(db: Db, now = Date.now()): Promise<number> {
  const state = await healthDataRepository.getSyncState(db, SRC, HK_SLEEP);
  const res = await anchored(async (anchor) => {
    const r = await hk(
      queryCategorySamplesWithAnchor(HK_SLEEP as CategoryTypeIdentifier, {
        limit: PAGE,
        anchor,
        filter: anchor ? undefined : { date: { startDate: new Date(now - INITIAL_DAYS * DAY_MS) } },
      }),
      HK_SLEEP,
    );
    return { items: r.samples, deleted: r.deletedSamples, newAnchor: r.newAnchor };
  }, state?.anchor ?? undefined);
  const rows = res.items
    .map((s) => normalizeSleepSample({ ...s, value: Number(s.value) }))
    .filter((m): m is NormalizedMetric => m !== null);
  let written = await healthDataRepository.upsertMetrics(db, rows);
  await healthDataRepository.deleteBySourceIds(db, SRC, res.deleted);
  const algo = await healthDataRepository.getSyncState(db, SRC, 'sleep_algorithm');
  const rebuildAll = algo?.anchor !== SLEEP_ALGORITHM;
  if (rows.length || res.deleted.length || rebuildAll) {
    const changedFrom = rebuildAll
      ? now - INITIAL_DAYS * DAY_MS
      : rows.length
        ? Math.min(...rows.map((r) => r.startAt))
        : now - 2 * DAY_MS;
    const from = changedFrom - DAY_MS;
    const samples = await healthDataRepository.stageSamplesSince(db, SRC, from - DAY_MS);
    const sessions = buildSleepSessions(samples, SRC).filter((s) => s.endAt >= from);
    await healthDataRepository.replaceSleepSessions(db, SRC, from, sessions);
    written += sessions.length;
    if (rebuildAll) {
      await healthDataRepository.setSyncState(db, SRC, 'sleep_algorithm', {
        anchor: SLEEP_ALGORITHM,
      });
    }
  }
  await healthDataRepository.setSyncState(db, SRC, HK_SLEEP, {
    anchor: res.anchor ?? null,
    lastSyncedAt: Date.now(),
    lastError: null,
  });
  return written;
}

export async function syncAppleHealth(
  db: Db,
  onProgress?: (p: SyncProgress) => void,
  signal?: AbortSignal,
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

  // 1) Sonno per primo: la mattina è il dato che serve subito.
  await guard(HK_SLEEP, async () => {
    report.upserted += await syncAppleHealthSleep(db, now);
  });
  tick('sleep');

  // 2a) Totali giornalieri (passi, calorie…): letture veloci da HealthKit in parallelo, scritture
  //     nel DB una alla volta.
  const ids = quantityIds.filter((id) => HK_QUANTITY[id]);
  const cumulativeIds = ids.filter((id) => HK_QUANTITY[id]!.cumulative);
  const reads = await mapPool(cumulativeIds, READ_CONCURRENCY, async (id) => {
    const mapping = HK_QUANTITY[id]!;
    try {
      const state = await healthDataRepository.getSyncState(db, SRC, id);
      // Totali giornalieri deduplicati da HealthKit (iPhone + Watch non vengono sommati due volte).
      const deep = !state?.anchor || now - Number(state.anchor) > DEEP_REFRESH_EVERY_MS;
      const days = !state?.lastSyncedAt ? INITIAL_DAYS : deep ? DEEP_REFRESH_DAYS : RECENT_DAYS;
      const from = startOfDay(now - (days - 1) * DAY_MS);
      const stats = await hk(
        queryStatisticsCollectionForQuantity(
          id,
          ['cumulativeSum'],
          from,
          { day: 1 },
          {
            filter: {
              date: { startDate: from, endDate: new Date(now) },
              // Le voci del diario alimentare scritte dall'app sono già nel DB: non si contano due volte.
              ...(ownFood(id)
                ? { NOT: [{ metadata: { withMetadataKey: FOOD_ENTRY_METADATA_KEY } }] }
                : {}),
            },
            unit: mapping.unit as never,
          },
        ),
        id,
      );
      const rows = stats
        .map((x) => normalizeDailyStatistic(id, x))
        .filter((m): m is NormalizedMetric => m !== null);
      const anchor = deep || !state?.lastSyncedAt ? String(now) : undefined;
      return { id, rows, anchor, error: null };
    } catch (e) {
      return { id, rows: [], anchor: undefined, error: e };
    }
  });
  for (const r of reads) {
    await guard(r.id, async () => {
      if (r.error) throw r.error;
      report.upserted += await healthDataRepository.upsertMetrics(db, r.rows);
      if (r.anchor !== undefined) {
        await healthDataRepository.setSyncState(db, SRC, r.id, { anchor: r.anchor });
      }
    });
    tick(HK_QUANTITY[r.id]!.type);
  }

  // 2b) Campioni singoli (frequenza cardiaca, peso, pressione…): pagina per pagina, salvando
  //     l'anchor dopo ogni pagina. Se la sincronizzazione si interrompe (app chiusa, sospesa da iOS),
  //     la volta dopo riparte da lì invece di rileggere e riscrivere tutto da capo.
  for (const id of ids.filter((x) => !HK_QUANTITY[x]!.cumulative)) {
    const mapping = HK_QUANTITY[id]!;
    await guard(id, async () => {
      const state = await healthDataRepository.getSyncState(db, SRC, id);
      const initialDays = mapping.type === 'heartRate' ? INITIAL_DAYS_HEART_RATE : INITIAL_DAYS;
      let anchor = state?.anchor ?? undefined;
      for (let page = 0; page < 200; page++) {
        if (signal?.aborted) throw new Error('sync aborted');
        const r = await hk(
          queryQuantitySamplesWithAnchor(id, {
            limit: PAGE,
            unit: mapping.unit as never,
            anchor,
            filter: anchor
              ? undefined
              : { date: { startDate: new Date(now - initialDays * DAY_MS) } },
          }),
          id,
        );
        const rows = r.samples
          .map((x) => normalizeQuantitySample(id, x))
          .filter((m): m is NormalizedMetric => m !== null);
        report.upserted += await healthDataRepository.upsertMetrics(db, rows);
        report.deleted += await healthDataRepository.deleteBySourceIds(
          db,
          SRC,
          r.deletedSamples.map((d) => d.uuid),
        );
        anchor = r.newAnchor;
        await healthDataRepository.setSyncState(db, SRC, id, { anchor: anchor ?? null });
        // Segno di vita per il controllo dei blocchi (la sync sta andando avanti).
        onProgress?.({ done, total: steps, label: mapping.type });
        if (r.samples.length < PAGE) break;
      }
    });
    tick(mapping.type);
  }

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
        const r = await hk(
          queryCategorySamplesWithAnchor(id as CategoryTypeIdentifier, {
            limit: PAGE,
            anchor,
            filter: anchor
              ? undefined
              : { date: { startDate: new Date(now - INITIAL_DAYS * DAY_MS) } },
          }),
          id,
        );
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
      const r = await hk(
        queryWorkoutSamplesWithAnchor({
          limit: PAGE,
          anchor,
          filter: anchor
            ? undefined
            : { date: { startDate: new Date(now - INITIAL_DAYS * DAY_MS) } },
        }),
        'workouts',
      );
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

/**
 * Aggiornamento rapido dei totali di oggi e di ieri (passi, calorie, distanza, piani…): una
 * query di statistiche per tipo, in parallelo. Usato prima di ogni risposta del coach, perché
 * la sincronizzazione completa è più lenta e i passi cambiano di continuo.
 */
export async function refreshTodayAppleHealth(db: Db): Promise<number> {
  const now = Date.now();
  const from = startOfDay(now - DAY_MS);
  const ids = (Object.keys(HK_QUANTITY) as QuantityTypeIdentifier[]).filter(
    (id) => HK_QUANTITY[id]?.cumulative,
  );
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const stats = await hk(
          queryStatisticsCollectionForQuantity(
            id,
            ['cumulativeSum'],
            from,
            { day: 1 },
            {
              filter: {
                date: { startDate: from, endDate: new Date(now) },
                ...(ownFood(id)
                  ? { NOT: [{ metadata: { withMetadataKey: FOOD_ENTRY_METADATA_KEY } }] }
                  : {}),
              },
              unit: HK_QUANTITY[id]!.unit as never,
            },
          ),
          id,
          15 * 1000,
        );
        return stats
          .map((s) => normalizeDailyStatistic(id, s))
          .filter((m): m is NormalizedMetric => m !== null);
      } catch {
        return []; // tipo non autorizzato
      }
    }),
  );
  return healthDataRepository.upsertMetrics(db, results.flat());
}
