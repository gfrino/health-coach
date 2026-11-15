import { healthQueries, profileRepository, type Db } from '@/db';
import { weightGoalProgress, type WeightGoalProgress } from '@/goals/progress';
import { DAY_MS, localIsoDate } from '@/lib/dates';

/**
 * Obiettivo calorico giornaliero stimato dall'app (mai inventato dal modello):
 * metabolismo basale (Mifflin-St Jeor) × 1,2 per la vita quotidiana, più la media delle calorie
 * attive degli ultimi 7 giorni se c'è, corretto per l'obiettivo (dimagrire / aumentare di peso).
 * Con un peso obiettivo e una data il deficit segue il ritmo necessario, entro limiti sicuri
 * (0,25–0,75 kg a settimana e mai oltre l'1% del peso; per aumentare 0,1–0,4 kg).
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
  /** Obiettivo di peso (se fissato): direzione, ritmo necessario, raggiunto. */
  weightGoal?: Pick<WeightGoalProgress, 'direction' | 'neededKgWeek' | 'reached'> | null;
}

export interface CalorieTarget {
  kcal: number;
  bmr: number;
  activeKcal: number | null;
  adjustment: number;
  /** Ritmo su cui è calcolato il deficit/surplus (kg a settimana), se c'è un obiettivo. */
  paceKgWeek: number | null;
}

/** Calorie per kg di peso corporeo (approssimazione usata comunemente). */
const KCAL_PER_KG = 7700;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function goalAdjustment(i: TargetInput): { adjustment: number; pace: number | null } {
  const g = i.weightGoal;
  const lose = g ? g.direction === 'lose' : i.goals.includes('loseWeight');
  const gain = g ? g.direction === 'gain' : i.goals.includes('gainWeight');
  if (g?.reached) return { adjustment: 0, pace: null };
  if (lose) {
    if (!g) return { adjustment: -400, pace: null };
    const max = Math.min(0.75, (i.weightKg ?? 70) * 0.01);
    const pace = clamp(g.neededKgWeek ?? 0.4, 0.25, max);
    return {
      adjustment: -Math.round((pace * KCAL_PER_KG) / 7),
      pace: Math.round(pace * 100) / 100,
    };
  }
  if (gain) {
    if (!g) return { adjustment: 300, pace: null };
    const pace = clamp(g.neededKgWeek ?? 0.25, 0.1, 0.4);
    return { adjustment: Math.round((pace * KCAL_PER_KG) / 7), pace: Math.round(pace * 100) / 100 };
  }
  return { adjustment: 0, pace: null };
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
  const { adjustment, pace } = goalAdjustment(i);
  const kcal = Math.max(MIN_TARGET, Math.round((maintenance + adjustment) / 10) * 10);
  return { kcal, bmr, activeKcal: active, adjustment, paceKgWeek: pace };
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

export interface ProteinTarget {
  /** Grammi al giorno (arrotondati a 5). */
  grams: number;
  /** Grammi per kg di peso di riferimento. */
  perKg: number;
  /** Perché questo valore: fabbisogno EFSA, attività, dimagrimento, muscoli o età. */
  basis: 'efsa' | 'active' | 'loseWeight' | 'muscle' | 'older';
}

/**
 * Proteine al giorno stimate dall'app:
 * - EFSA (2012): 0,83 g per kg di peso per gli adulti;
 * - dai 65 anni almeno 1,0 g/kg (PROT-AGE, 2013);
 * - persone attive o che vogliono dimagrire 1,2 g/kg (ACSM/AND/DC 2016: 1,2–2,0; a dieta aiuta a
 *   conservare la massa muscolare);
 * - per aumentare i muscoli 1,6 g/kg (Morton et al. 2018: oltre i benefici non crescono).
 * Con un BMI sopra 25 si usa il peso che corrisponde a BMI 25, per non gonfiare l'obiettivo.
 */
export function estimateProtein(i: {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  activeKcal: number | null;
  goals: string[];
}): ProteinTarget | null {
  if (!i.weightKg || i.weightKg < 30) return null;
  const h = i.heightCm && i.heightCm > 100 ? i.heightCm / 100 : null;
  const refWeight = h ? Math.min(i.weightKg, 25 * h * h) : i.weightKg;
  const active = (i.activeKcal ?? 0) >= 400 || i.goals.includes('fitness');
  let basis: ProteinTarget['basis'] = 'efsa';
  let perKg = 0.83;
  if (i.age != null && i.age >= 65) {
    basis = 'older';
    perKg = 1.0;
  }
  if (i.goals.includes('loseWeight') && perKg < 1.2) {
    basis = 'loseWeight';
    perKg = 1.2;
  } else if (active && perKg < 1.2) {
    basis = 'active';
    perKg = 1.2;
  }
  if (i.goals.includes('gainMuscle')) {
    basis = 'muscle';
    perKg = 1.6;
  }
  return { grams: Math.round((refWeight * perKg) / 5) * 5, perKg, basis };
}

export interface FoodTargets {
  calories: CalorieTarget | null;
  protein: ProteinTarget | null;
}

/** Obiettivi dal profilo e dai dati di salute (peso più recente, calorie attive degli ultimi 7 giorni). */
export async function loadFoodTargets(db: Db, now = new Date()): Promise<FoodTargets> {
  const profile = await profileRepository.getProfile(db);
  const to = now.getTime() + 1;
  const [weight, active] = await Promise.all([
    healthQueries.dailyMetric(db, 'weight', to - 180 * DAY_MS, to),
    healthQueries.dailyMetric(db, 'activeEnergy', to - 8 * DAY_MS, to),
  ]);
  // Oggi è parziale: si usano i 7 giorni completi precedenti.
  const today = localIsoDate(now);
  const fullDays = active.days.filter((d) => d.day < today).slice(-7);
  const activeKcal = fullDays.length
    ? fullDays.reduce((a, d) => a + d.value, 0) / fullDays.length
    : null;
  const input = {
    sex: profile.sex,
    age: ageOn(profile.birthDate, now),
    weightKg: weight.days.at(-1)?.value ?? profile.weightKg,
    heightCm: profile.heightCm,
    activeKcal,
    goals: profile.goals,
  };
  return {
    calories: estimateTarget({
      ...input,
      weightGoal: weightGoalProgress(profile, weight.days, today),
    }),
    protein: estimateProtein(input),
  };
}

export async function loadCalorieTarget(db: Db, now = new Date()): Promise<CalorieTarget | null> {
  return (await loadFoodTargets(db, now)).calories;
}
