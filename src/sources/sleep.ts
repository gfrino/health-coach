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
 * - se ci sono fasi dettagliate (core/deep/REM), gli "asleep" generici sovrapposti vengono ignorati.
 */
const SESSION_GAP_MS = 3 * 60 * 60 * 1000;
const MIN_SESSION_ASLEEP_MS = 30 * 60 * 1000;

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
    const detailed = g.some(
      (s) =>
        s.stage === SleepStage.Light || s.stage === SleepStage.Deep || s.stage === SleepStage.REM,
    );
    const asleep = g.filter(
      (s) => ASLEEP_STAGES.has(s.stage) && (!detailed || s.stage !== SleepStage.Asleep),
    );
    const asleepMs = unionDuration(asleep);
    if (asleepMs < MIN_SESSION_ASLEEP_MS) continue;
    const startAt = Math.min(...g.map((s) => s.startAt));
    const endAt = Math.max(...g.map((s) => s.endAt));
    const inBed = g.filter((s) => s.stage === SleepStage.InBed);
    sessions.push({
      startAt,
      endAt,
      inBedS: Math.round((inBed.length ? unionDuration(inBed) : endAt - startAt) / 1000),
      asleepS: Math.round(asleepMs / 1000),
      stages: (detailed
        ? g.filter((s) => s.stage !== SleepStage.Asleep && s.stage !== SleepStage.InBed)
        : asleep
      ).map((s) => ({ stage: s.stage, startAt: s.startAt, endAt: s.endAt })),
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
