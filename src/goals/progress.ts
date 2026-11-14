import { healthQueries, profileRepository, type Db } from '@/db';
import type { Profile } from '@/db/repositories/profileRepository';
import { DAY_MS, localIsoDate } from '@/lib/dates';

/**
 * Progresso verso il peso obiettivo, calcolato dall'app (mai dal modello): punto di partenza,
 * peso attuale, quanto manca, andamento delle ultime settimane, ritmo necessario per arrivare
 * entro la data scelta e data prevista con l'andamento attuale.
 */

export interface WeightGoalProgress {
  direction: 'lose' | 'gain';
  startKg: number;
  startDate: string | null;
  currentKg: number;
  /** Giorno dell'ultima pesata (null = peso del profilo). */
  currentDate: string | null;
  targetKg: number;
  targetDate: string | null;
  /** Kg ancora da perdere/prendere (0 se raggiunto). */
  remainingKg: number;
  /** Frazione del percorso fatta (0–1). */
  done: number;
  reached: boolean;
  /** Andamento delle ultime settimane in kg/settimana (negativo = cala); null se pochi dati. */
  trendKgWeek: number | null;
  /** Kg/settimana necessari per arrivare alla data scelta. */
  neededKgWeek: number | null;
  /** Data prevista con l'andamento attuale (se va nella direzione giusta). */
  etaDate: string | null;
  /** Ritmo richiesto oltre l'1% del peso a settimana: troppo rapido. */
  tooFast: boolean;
  onTrack: boolean | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pendenza (kg/settimana) della retta dei minimi quadrati sulle pesate. */
export function weightTrend(points: { day: string; value: number }[]): number | null {
  if (points.length < 3) return null;
  const xs = points.map((p) => new Date(`${p.day}T12:00:00`).getTime() / DAY_MS);
  const span = xs[xs.length - 1]! - xs[0]!;
  if (span < 7) return null;
  const n = points.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = points.reduce((a, p) => a + p.value, 0) / n;
  let num = 0;
  let den = 0;
  points.forEach((p, i) => {
    num += (xs[i]! - mx) * (p.value - my);
    den += (xs[i]! - mx) ** 2;
  });
  return den ? round2((num / den) * 7) : null;
}

const weeksBetween = (a: string, b: string) =>
  (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / (7 * DAY_MS);

export function weightGoalProgress(
  profile: Pick<
    Profile,
    'goals' | 'weightKg' | 'targetWeightKg' | 'targetDate' | 'goalStartWeightKg' | 'goalStartDate'
  >,
  weights: { day: string; value: number }[],
  today: string,
): WeightGoalProgress | null {
  const target = profile.targetWeightKg;
  if (!target) return null;
  const last = weights.at(-1);
  const currentKg = last?.value ?? profile.weightKg;
  if (!currentKg) return null;
  const startKg = profile.goalStartWeightKg ?? currentKg;
  const direction: 'lose' | 'gain' =
    target < startKg || (target === startKg && profile.goals.includes('loseWeight'))
      ? 'lose'
      : 'gain';
  const sign = direction === 'lose' ? -1 : 1;
  const remaining = Math.max(0, sign * (target - currentKg));
  const total = Math.abs(target - startKg);
  const reached = remaining === 0;
  // Andamento: pesate delle ultime 5 settimane.
  const since = localIsoDate(new Date(new Date(`${today}T12:00:00`).getTime() - 35 * DAY_MS));
  const trend = weightTrend(weights.filter((w) => w.day >= since));
  const weeksLeft = profile.targetDate ? weeksBetween(today, profile.targetDate) : null;
  const needed =
    weeksLeft !== null && !reached ? (weeksLeft > 0 ? round2(remaining / weeksLeft) : null) : null;
  const goodTrend = trend !== null && sign * trend > 0.02;
  const etaDate =
    goodTrend && !reached
      ? localIsoDate(
          new Date(
            new Date(`${today}T12:00:00`).getTime() + (remaining / Math.abs(trend)) * 7 * DAY_MS,
          ),
        )
      : null;
  return {
    direction,
    startKg: round1(startKg),
    startDate: profile.goalStartDate,
    currentKg: round1(currentKg),
    currentDate: last?.day ?? null,
    targetKg: round1(target),
    targetDate: profile.targetDate,
    remainingKg: round1(remaining),
    done: reached ? 1 : total > 0 ? Math.max(0, Math.min(1, 1 - remaining / total)) : 0,
    reached,
    trendKgWeek: trend,
    neededKgWeek: needed,
    etaDate,
    tooFast: needed !== null && needed > currentKg * 0.01,
    onTrack:
      reached || needed === null || trend === null
        ? reached
          ? true
          : null
        : sign * trend >= needed * 0.8,
  };
}

/** Progresso dal profilo e dalle pesate (Apple Salute / Health Connect) degli ultimi 6 mesi. */
export async function loadWeightGoal(db: Db, now = new Date()): Promise<WeightGoalProgress | null> {
  const profile = await profileRepository.getProfile(db);
  if (!profile.targetWeightKg) return null;
  const to = now.getTime() + 1;
  const weights = await healthQueries.dailyMetric(db, 'weight', to - 180 * DAY_MS, to);
  return weightGoalProgress(profile, weights.days, localIsoDate(now));
}

/** Righe per il prompt del coach (numeri già calcolati, in inglese). */
export function weightGoalLines(g: WeightGoalProgress): string[] {
  const verb = g.direction === 'lose' ? 'lose' : 'gain';
  const lines = [
    `Weight goal: ${verb} weight from ${g.startKg} kg${g.startDate ? ` (on ${g.startDate})` : ''} to ${g.targetKg} kg${g.targetDate ? ` by ${g.targetDate}` : ''}.`,
    g.reached
      ? `Reached: now ${g.currentKg} kg. Help them keep it.`
      : `Now ${g.currentKg} kg${g.currentDate ? ` (weighed ${g.currentDate})` : ' (from the profile, no recent weigh-in)'}: ${g.remainingKg} kg to go, ${Math.round(g.done * 100)}% of the way.`,
  ];
  if (g.trendKgWeek !== null)
    lines.push(
      `Trend over the last weeks: ${g.trendKgWeek > 0 ? '+' : ''}${g.trendKgWeek} kg/week${g.etaDate ? `; at this pace they reach the target around ${g.etaDate}` : ' (not moving toward the target)'}.`,
    );
  else lines.push('Not enough recent weigh-ins for a trend: encourage weighing 2–3 times a week.');
  if (g.neededKgWeek !== null)
    lines.push(
      `To arrive on time they need about ${g.neededKgWeek} kg/week${g.onTrack === true ? ' — on track' : g.onTrack === false ? ' — behind schedule' : ''}.${g.tooFast ? ' That is faster than 1% of body weight per week: suggest a later date, never an extreme diet.' : ''}`,
    );
  return lines;
}
