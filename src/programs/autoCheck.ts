import { healthDataRepository, healthQueries, programRepository, type Db } from '@/db';
import { DAY_MS, localIsoDate } from '@/lib/dates';

import { ruleSatisfied, type DayActivity } from './schedule';

const startOfDay = (day: string) => new Date(`${day}T00:00:00`).getTime();

async function dayActivity(db: Db, day: string): Promise<DayActivity> {
  const from = startOfDay(day);
  const to = from + DAY_MS;
  const [workouts, steps] = await Promise.all([
    healthDataRepository.workoutsBetween(db, from, to, 50),
    healthQueries.dailyMetric(db, 'steps', from, to),
  ]);
  return { workouts, steps: steps.days.find((d) => d.day === day)?.value ?? null };
}

/**
 * Spunta da sola le azioni dei programmi attivi soddisfatte dai dati di salute di oggi e di ieri
 * (un allenamento di Apple Fitness / Health Connect, i passi). Non tocca mai le spunte messe o
 * tolte dall'utente. Restituisce quante azioni ha spuntato.
 */
export async function autoCheckPrograms(db: Db, now = new Date()): Promise<number> {
  const today = localIsoDate(now);
  const yesterday = localIsoDate(new Date(now.getTime() - DAY_MS));
  const programs = await programRepository.listPrograms(db, 'active');
  const items = programs.flatMap((p) =>
    p.items.filter((i) => i.auto && i.frequency === 'daily').map((i) => ({ p, i })),
  );
  if (!items.length) return 0;

  let ticked = 0;
  for (const day of [yesterday, today]) {
    const relevant = items.filter(
      ({ p, i }) =>
        day >= p.startDay &&
        (!p.durationDays || programRepository.programDay(p, day) <= p.durationDays) &&
        programRepository.itemScheduled(i, day),
    );
    if (!relevant.length) continue;
    const activity = await dayActivity(db, day);
    for (const { i } of relevant) {
      if (i.auto && ruleSatisfied(i.auto, activity)) {
        if (await programRepository.setItemAutoDone(db, i.id, day)) ticked++;
      }
    }
  }
  return ticked;
}
