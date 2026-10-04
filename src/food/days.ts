import { localIsoDate } from '@/lib/dates';

import type { FoodMeal } from '@/db/repositories/foodRepository';

/** Giorno YYYY-MM-DD spostato di `delta` giorni (a mezzogiorno: niente sorprese con l'ora legale). */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return localIsoDate(d);
}

/** Ora tipica del pasto, per le voci aggiunte a un giorno passato. */
const MEAL_HOURS: Record<FoodMeal, number> = { breakfast: 8, lunch: 13, snack: 16, dinner: 20 };

/** Quando registrare un alimento: adesso se è oggi, altrimenti all'ora tipica del pasto. */
export function eatenAtFor(day: string, meal: FoodMeal, now = new Date()): number {
  if (day === localIsoDate(now)) return now.getTime();
  const d = new Date(`${day}T12:00:00`);
  d.setHours(MEAL_HOURS[meal], 0, 0, 0);
  return d.getTime();
}
