import { healthDataRepository, healthQueries, programRepository, type Db } from '@/db';
import { DAY_MS, localIsoDate } from '@/lib/dates';

import { ruleSatisfied, type DayActivity } from './schedule';
import { addDays } from './week';

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

/** Giorni controllati: l'orologio può sincronizzare un allenamento anche giorni dopo. */
const DAYS_BACK = 7;

/**
 * Spunta da sola le azioni dei programmi attivi soddisfatte dai dati di salute degli ultimi
 * 7 giorni (un allenamento di Apple Fitness / Health Connect, i passi). Non tocca mai le spunte
 * messe o tolte dall'utente. Restituisce quante azioni ha spuntato.
 */
export async function autoCheckPrograms(db: Db, now = new Date()): Promise<number> {
  const today = localIsoDate(now);
  const days = Array.from({ length: DAYS_BACK }, (_, i) => addDays(today, i - DAYS_BACK + 1));
  const programs = await programRepository.listPrograms(db, 'active');
  const items = programs.flatMap((p) =>
    p.items.filter((i) => i.auto && i.frequency === 'daily').map((i) => ({ p, i })),
  );
  if (!items.length) return 0;

  let ticked = 0;
  for (const day of days) {
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
