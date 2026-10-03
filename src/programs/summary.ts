import { programRepository, type Db } from '@/db';
import type { Program } from '@/db/repositories/programRepository';
import { localIsoDate } from '@/lib/dates';
import type { ProgramContext } from '@/coach/context';

const DAY = 86_400_000;

/** Percentuale di azioni quotidiane spuntate negli ultimi 7 giorni (oggi escluso se a metà). */
export function adherence(
  p: Program,
  checks: { itemId: string; day: string }[],
  today: string,
): number | null {
  const daily = p.items.filter((i) => i.frequency === 'daily');
  if (!daily.length) return null;
  const ids = new Set(daily.map((i) => i.id));
  const days: string[] = [];
  for (let k = 1; k <= 7; k++) {
    const d = localIsoDate(new Date(new Date(`${today}T12:00:00`).getTime() - k * DAY));
    if (d >= p.startDay) days.push(d);
  }
  if (!days.length) return null;
  const set = new Set(days);
  const done = checks.filter((c) => ids.has(c.itemId) && set.has(c.day)).length;
  return Math.round((done / (days.length * daily.length)) * 100);
}

/** Programmi attivi per il prompt del coach e per le notifiche. */
export async function loadProgramContext(db: Db, now: Date): Promise<ProgramContext[]> {
  const today = localIsoDate(now);
  const from = localIsoDate(new Date(now.getTime() - 7 * DAY));
  const programs = await programRepository.listPrograms(db, 'active');
  return Promise.all(
    programs.map(async (p) => {
      const done = await programRepository.doneItemIds(db, p.items, today);
      const checks = await programRepository.checksBetween(db, p.items, from, today);
      return {
        id: p.id,
        title: p.title,
        goal: p.goal,
        day: programRepository.programDay(p, today),
        durationDays: p.durationDays,
        adherence7: adherence(p, checks, today),
        items: p.items.map((i) => ({
          id: i.id,
          title: i.title,
          frequency: i.frequency,
          done: done.has(i.id),
        })),
      };
    }),
  );
}
