import {
  ASLEEP_STAGES,
  SleepStage,
  type NormalizedSleepSession,
  type StageInterval,
} from './model';

/**
 * Ricostruisce le notti di sonno dai campioni di fase (Apple Health registra fasi separate,
 * spesso sovrapposte tra iPhone e Watch).
 * - campioni separati da più di SESSION_GAP appartengono a notti diverse;
 * - il tempo di sonno è l'UNIONE degli intervalli "addormentato" (niente doppi conteggi tra dispositivi);
 * - se ci sono fasi dettagliate (core/deep/REM), gli "asleep" generici sovrapposti vengono ignorati;
 * - se più app/dispositivi registrano la stessa notte (Watch, app del sonno, tappetino…), come fa
 *   Apple Salute si usa UNA sola fonte: quella con le fasi dettagliate, preferendo Apple (Watch),
 *   poi la più completa. Sommare fonti diverse gonfierebbe il sonno e le fasi.
 */
const SESSION_GAP_MS = 3 * 60 * 60 * 1000;
const MIN_SESSION_ASLEEP_MS = 30 * 60 * 1000;

const isDetailed = (s: StageInterval) =>
  s.stage === SleepStage.Light || s.stage === SleepStage.Deep || s.stage === SleepStage.REM;

/** Campioni della fonte migliore della notte (senza origine: tutti, come un'unica fonte). */
export function pickSleepSource(group: StageInterval[]): StageInterval[] {
  const bySource = new Map<string, StageInterval[]>();
  for (const s of group) {
    if (s.stage === SleepStage.InBed) continue;
    const key = s.origin ?? '';
    bySource.set(key, [...(bySource.get(key) ?? []), s]);
  }
  if (bySource.size <= 1) return group.filter((s) => s.stage !== SleepStage.InBed);
  const score = ([origin, samples]: [string, StageInterval[]]) =>
    (samples.some(isDetailed) ? 1e12 : 0) +
    (/^com\.apple\./i.test(origin) ? 1e11 : 0) +
    unionDuration(samples.filter((x) => ASLEEP_STAGES.has(x.stage)));
  return [...bySource.entries()].sort((a, b) => score(b) - score(a))[0]?.[1] ?? [];
}

export function unionDuration(intervals: { startAt: number; endAt: number }[]): number {
  const sorted = [...intervals]
    .filter((i) => i.endAt > i.startAt)
    .sort((a, b) => a.startAt - b.startAt);
  let total = 0;
  let curStart = -Infinity;
  let curEnd = -Infinity;
  for (const i of sorted) {
    if (i.startAt > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = i.startAt;
      curEnd = i.endAt;
    } else if (i.endAt > curEnd) {
      curEnd = i.endAt;
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

export function buildSleepSessions(
  samples: StageInterval[],
  source: string,
): NormalizedSleepSession[] {
  const sorted = [...samples]
    .filter((s) => s.endAt > s.startAt)
    .sort((a, b) => a.startAt - b.startAt);
  const groups: StageInterval[][] = [];
  let groupEnd = -Infinity;
  for (const s of sorted) {
    if (!groups.length || s.startAt - groupEnd > SESSION_GAP_MS) {
      groups.push([s]);
    } else {
      groups[groups.length - 1]?.push(s);
    }
    groupEnd = Math.max(groupEnd, s.endAt);
  }

  const sessions: NormalizedSleepSession[] = [];
  for (const g of groups) {
    const chosen = pickSleepSource(g);
    const detailed = chosen.some(isDetailed);
    const asleep = chosen.filter(
      (s) => ASLEEP_STAGES.has(s.stage) && (!detailed || s.stage !== SleepStage.Asleep),
    );
    const asleepMs = unionDuration(asleep);
    if (asleepMs < MIN_SESSION_ASLEEP_MS) continue;
    const inBed = g.filter((s) => s.stage === SleepStage.InBed);
    const span = [...chosen, ...inBed];
    const startAt = Math.min(...span.map((s) => s.startAt));
    const endAt = Math.max(...span.map((s) => s.endAt));
    sessions.push({
      startAt,
      endAt,
      inBedS: Math.round((inBed.length ? unionDuration(inBed) : endAt - startAt) / 1000),
      asleepS: Math.round(asleepMs / 1000),
      stages: (detailed ? chosen.filter((s) => s.stage !== SleepStage.Asleep) : asleep).map(
        (s) => ({
          stage: s.stage,
          startAt: s.startAt,
          endAt: s.endAt,
        }),
      ),
      source,
      // Chiave stabile per la notte: data locale del risveglio.
      sourceId: `night:${new Date(endAt).toISOString().slice(0, 10)}:${startAt}`,
    });
  }
  return sessions;
}

/** Minuti per fase in una notte (per la dashboard e il coach). */
export function stageMinutes(stages: StageInterval[]): Partial<Record<SleepStage, number>> {
  const out: Partial<Record<SleepStage, number>> = {};
  for (const stage of new Set(stages.map((s) => s.stage))) {
    out[stage] = Math.round(unionDuration(stages.filter((s) => s.stage === stage)) / 60000);
  }
  return out;
}
