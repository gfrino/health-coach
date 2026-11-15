import type { ProgramItem } from '@/db/repositories/programRepository';
import { localIsoDate } from '@/lib/dates';

import { isScheduled, weekdayOf } from './schedule';

/**
 * Settimana mostrata sopra le azioni di un programma: da lunedì a domenica, con quante azioni
 * erano previste e quante sono state fatte in ogni giorno. Serve per tornare ai giorni passati e
 * spuntare quello che si è fatto (anche le settimane prima, con le frecce).
 */

export interface WeekDay {
  day: string;
  /** Azioni previste quel giorno ("una volta" escluse: non sono legate a un giorno). */
  planned: number;
  done: number;
  /** Giorno selezionabile: dentro il programma e non nel futuro. */
  enabled: boolean;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localIsoDate(d);
}

/** Lunedì della settimana del giorno indicato. */
export const weekStart = (day: string) => addDays(day, 1 - weekdayOf(day));

/** Il giorno è dentro il programma (dal primo giorno a oggi, entro la durata)? */
export function dayInProgram(
  p: { startDay: string; durationDays: number | null },
  day: string,
  today: string,
): boolean {
  if (day < p.startDay || day > today) return false;
  return !p.durationDays || day <= addDays(p.startDay, p.durationDays - 1);
}

/** Giorno da mostrare spostandosi di una settimana: lo stesso giorno, ma dentro il programma. */
export function shiftWeek(
  p: { startDay: string; durationDays: number | null },
  day: string,
  today: string,
  dir: -1 | 1,
): string | null {
  const target = addDays(day, 7 * dir);
  const start = weekStart(target);
  if (dayInProgram(p, target, today)) return target;
  // Lo stesso giorno non c'è (prima dell'inizio o nel futuro): il giorno più vicino di quella settimana.
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) =>
    dayInProgram(p, d, today),
  );
  if (!days.length) return null;
  const dist = (d: string) => Math.abs(new Date(d).getTime() - new Date(target).getTime());
  return days.reduce((best, d) => (dist(d) < dist(best) ? d : best));
}

export function buildWeek(
  p: { startDay: string; durationDays: number | null; items: ProgramItem[] },
  day: string,
  today: string,
  checks: { itemId: string; day: string }[],
): WeekDay[] {
  const start = weekStart(day);
  const daily = p.items.filter((i) => i.frequency === 'daily');
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const planned = daily.filter((it) => isScheduled(it.days, d));
    const ids = new Set(planned.map((it) => it.id));
    return {
      day: d,
      planned: planned.length,
      done: new Set(checks.filter((c) => c.day === d && ids.has(c.itemId)).map((c) => c.itemId))
        .size,
      enabled: dayInProgram(p, d, today),
    };
  });
}
