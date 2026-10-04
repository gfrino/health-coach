import { healthQueries, profileRepository, type Db } from '@/db';
import { DAY_MS, localIsoDate } from '@/lib/dates';

/**
 * Obiettivo calorico giornaliero stimato dall'app (mai inventato dal modello):
 * metabolismo basale (Mifflin-St Jeor) × 1,2 per la vita quotidiana, più la media delle calorie
 * attive degli ultimi 7 giorni se c'è, corretto per l'obiettivo (dimagrire / aumentare di peso).
 * È una stima indicativa: l'utente può impostare il suo numero nella scheda Cibo.
 */

export interface TargetInput {
  sex: 'female' | 'male' | 'other' | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  /** Media giornaliera delle calorie attive (Apple Salute / Health Connect), se disponibile. */
  activeKcal: number | null;
  goals: string[];
}

export interface CalorieTarget {
  kcal: number;
  bmr: number;
  activeKcal: number | null;
  adjustment: number;
}

/** Sotto questa soglia non si scende: diete molto basse vanno seguite da un medico. */
export const MIN_TARGET = 1200;

export function estimateTarget(i: TargetInput): CalorieTarget | null {
  if (!i.weightKg || !i.heightCm || !i.age || i.age < 16) return null;
  const base = 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age;
  // "Altro" o non indicato: a metà tra le due formule.
  const bmr = Math.round(i.sex === 'male' ? base + 5 : i.sex === 'female' ? base - 161 : base - 78);
  const active = i.activeKcal && i.activeKcal > 0 ? Math.round(i.activeKcal) : null;
  const maintenance = bmr * 1.2 + (active ?? 0);
  const adjustment = i.goals.includes('loseWeight')
    ? -400
    : i.goals.includes('gainWeight')
      ? 300
      : 0;
  const kcal = Math.max(MIN_TARGET, Math.round((maintenance + adjustment) / 10) * 10);
  return { kcal, bmr, activeKcal: active, adjustment };
}

function ageOn(birthDate: string | null, now: Date): number | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getFullYear() - b.getFullYear();
  const beforeBirthday =
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate());
  if (beforeBirthday) age--;
  return age;
}

/** Obiettivo dal profilo e dai dati di salute (peso più recente, calorie attive degli ultimi 7 giorni). */
export async function loadCalorieTarget(db: Db, now = new Date()): Promise<CalorieTarget | null> {
  const profile = await profileRepository.getProfile(db);
  const to = now.getTime() + 1;
  const [weight, active] = await Promise.all([
    healthQueries.dailyMetric(db, 'weight', to - 60 * DAY_MS, to),
    healthQueries.dailyMetric(db, 'activeEnergy', to - 8 * DAY_MS, to),
  ]);
  // Oggi è parziale: si usano i 7 giorni completi precedenti.
  const today = localIsoDate(now);
  const fullDays = active.days.filter((d) => d.day < today).slice(-7);
  const activeKcal = fullDays.length
    ? fullDays.reduce((a, d) => a + d.value, 0) / fullDays.length
    : null;
  return estimateTarget({
    sex: profile.sex,
    age: ageOn(profile.birthDate, now),
    weightKg: weight.days.at(-1)?.value ?? profile.weightKg,
    heightCm: profile.heightCm,
    activeKcal,
    goals: profile.goals,
  });
}
