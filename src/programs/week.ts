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

/** Ultimo giorno del programma (la fine, o oggi se non è ancora finito). */
export function lastProgramDay(
  p: { startDay: string; durationDays: number | null },
  today: string,
): string {
  const end = p.durationDays ? addDays(p.startDay, p.durationDays - 1) : today;
  return end < today ? end : today;
}

/**
 * Intervallo navigabile: un programma ancora attivo resta aperto fino a oggi anche oltre la durata
 * prevista (c'è chi continua a seguirlo); quelli conclusi si fermano alla fine.
 */
export function navProgram<
  T extends { startDay: string; durationDays: number | null; status: string },
>(p: T): T {
  return p.status === 'active' ? { ...p, durationDays: null } : p;
}

/** Fine della durata prevista se è già passata e il programma è ancora attivo, altrimenti null. */
export function overrunEnd(
  p: { startDay: string; durationDays: number | null; status: string },
  today: string,
): string | null {
  if (p.status !== 'active' || !p.durationDays) return null;
  const end = addDays(p.startDay, p.durationDays - 1);
  return end < today ? end : null;
}

/** Giorno da mostrare di default: oggi, o l'ultimo giorno se il programma è già finito. */
export function defaultProgramDay(
  p: { startDay: string; durationDays: number | null },
  today: string,
): string {
  const last = lastProgramDay(p, today);
  return last < p.startDay ? today : last;
}

/**
 * Giorno da mostrare spostandosi di una settimana: lo stesso giorno, ma dentro il programma. Le
 * settimane senza giorni del programma (es. dopo la fine) si saltano, così si arriva sempre allo
 * storico.
 */
export function shiftWeek(
  p: { startDay: string; durationDays: number | null },
  day: string,
  today: string,
  dir: -1 | 1,
): string | null {
  const first = p.startDay;
  const last = lastProgramDay(p, today);
  if (last < first) return null;
  for (let step = 1; step <= 600; step++) {
    const target = addDays(day, 7 * step * dir);
    const start = weekStart(target);
    const end = addDays(start, 6);
    if (dir < 0 && end < first) return null;
    if (dir > 0 && start > last) return null;
    if (dayInProgram(p, target, today)) return target;
    // Lo stesso giorno non c'è (prima dell'inizio o dopo la fine): il giorno più vicino di quella settimana.
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) =>
      dayInProgram(p, d, today),
    );
    if (!days.length) continue;
    const dist = (d: string) => Math.abs(new Date(d).getTime() - new Date(target).getTime());
    return days.reduce((best, d) => (dist(d) < dist(best) ? d : best));
  }
  return null;
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
