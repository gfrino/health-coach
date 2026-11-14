import { programRepository, type Db } from '@/db';
import type { Program } from '@/db/repositories/programRepository';
import { localIsoDate } from '@/lib/dates';
import type { ProgramContext } from '@/coach/context';

import { autoCheckPrograms } from './autoCheck';
import { describeRule, WEEKDAY_KEYS, type Weekday } from './schedule';

const DAY = 86_400_000;

/** Ultimi 7 giorni completi (oggi escluso), dal più vecchio, non prima dell'inizio del programma. */
export function lastDays(p: Pick<Program, 'startDay'>, today: string): string[] {
  const days: string[] = [];
  for (let k = 7; k >= 1; k--) {
    const d = localIsoDate(new Date(new Date(`${today}T12:00:00`).getTime() - k * DAY));
    if (d >= p.startDay) days.push(d);
  }
  return days;
}

/**
 * Percentuale di azioni quotidiane fatte negli ultimi 7 giorni (oggi escluso se a metà),
 * contando solo i giorni in cui ogni azione era prevista.
 */
export function adherence(
  p: Program,
  checks: { itemId: string; day: string }[],
  today: string,
): number | null {
  const daily = p.items.filter((i) => i.frequency === 'daily');
  const days = lastDays(p, today);
  let expected = 0;
  let done = 0;
  const set = new Set(checks.map((c) => `${c.itemId}|${c.day}`));
  for (const i of daily) {
    for (const d of days) {
      if (!programRepository.itemScheduled(i, d)) continue;
      expected++;
      if (set.has(`${i.id}|${d}`)) done++;
    }
  }
  return expected ? Math.round((done / expected) * 100) : null;
}

const daysLabel = (days: Weekday[] | null) =>
  days ? days.map((d) => WEEKDAY_KEYS[d - 1]).join(', ') : null;

/** Programmi attivi per il prompt del coach e per le notifiche (con le spunte automatiche). */
export async function loadProgramContext(db: Db, now: Date): Promise<ProgramContext[]> {
  await autoCheckPrograms(db, now).catch(() => 0);
  const today = localIsoDate(now);
  const from = localIsoDate(new Date(now.getTime() - 7 * DAY));
  const programs = await programRepository.listPrograms(db, 'active');
  return Promise.all(
    programs.map(async (p) => {
      const todayChecks = await programRepository.dayChecks(db, p.items, today);
      const checks = await programRepository.checksBetween(db, p.items, from, today);
      const window = lastDays(p, today);
      return {
        id: p.id,
        title: p.title,
        goal: p.goal,
        day: programRepository.programDay(p, today),
        durationDays: p.durationDays,
        adherence7: adherence(p, checks, today),
        items: p.items.map((i) => {
          const mine = checks.filter((c) => c.itemId === i.id);
          const scheduled = window.filter((d) => programRepository.itemScheduled(i, d));
          const doneDays = scheduled.filter((d) => mine.some((c) => c.day === d));
          const last =
            mine
              .map((c) => c.day)
              .sort()
              .at(-1) ?? null;
          return {
            id: i.id,
            title: i.title,
            frequency: i.frequency,
            done: todayChecks.has(i.id),
            doneBy: todayChecks.get(i.id) ?? null,
            scheduledToday: programRepository.itemScheduled(i, today),
            days: daysLabel(i.days),
            auto: i.auto ? describeRule(i.auto) : null,
            recent:
              i.frequency === 'daily' && scheduled.length
                ? { done: doneDays.length, scheduled: scheduled.length }
                : null,
            lastDone: last,
          };
        }),
      };
    }),
  );
}
