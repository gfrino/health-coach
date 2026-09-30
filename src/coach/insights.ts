import { SleepStage, type StageInterval } from '@/sources/model';
import { stageMinutes } from '@/sources/sleep';

/**
 * Osservazioni già "digerite" per il coach: confronti con la media personale, direzione,
 * giudizio e un focus consigliato. I modelli piccoli sul telefono non sanno ragionare sui numeri
 * (e non hanno tool): l'app fa i conti, il modello deve solo spiegarli e consigliare.
 * Frasi in inglese come il resto del system prompt; il coach risponde nella lingua dell'utente.
 */

export interface DailyPoint {
  day: string; // YYYY-MM-DD locale
  value: number;
}

export interface InsightNight {
  day: string;
  asleepMin: number;
  stages: StageInterval[];
}

export interface InsightInput {
  today: string; // YYYY-MM-DD locale
  steps?: DailyPoint[];
  activeEnergy?: DailyPoint[];
  restingHeartRate?: DailyPoint[];
  hrv?: DailyPoint[];
  weight?: DailyPoint[];
  nights?: InsightNight[];
  workouts7?: number;
  workouts30?: number;
}

export interface Insights {
  /** Osservazioni in ordine di importanza. */
  lines: string[];
  /** Area su cui concentrarsi, con il motivo (null se va tutto bene o mancano dati). */
  focus: string | null;
  /** Serie compatte degli ultimi giorni (per rispondere a "come ho dormito questa settimana"). */
  recent: string[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const int = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (a: number, b: number) => Math.round(((a - b) / Math.abs(b)) * 100);

export function hm(min: number): string {
  const m = Math.round(min);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

function daysBefore(today: string, n: number): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function last7Days(points: DailyPoint[], today: string) {
  const from = daysBefore(today, 7);
  return points.filter((p) => p.day > from && p.day <= today).map((p) => p.value);
}

/** Giorni completi (oggi escluso: i totali di oggi sono parziali). */
function windows(points: DailyPoint[], today: string) {
  const past = points.filter((p) => p.day < today);
  const from7 = daysBefore(today, 7);
  return {
    last7: past.filter((p) => p.day >= from7).map((p) => p.value),
    all: past.map((p) => p.value),
    today: points.find((p) => p.day === today)?.value ?? null,
    latest: points.at(-1) ?? null,
  };
}

function change(a7: number, a30: number, unit: string, relative: boolean) {
  const d = a7 - a30;
  if (relative) {
    const p = pct(a7, a30);
    if (Math.abs(p) < 5) return { text: 'in line with your 30-day average', delta: p };
    return { text: `${Math.abs(p)}% ${p > 0 ? 'above' : 'below'} your 30-day average`, delta: p };
  }
  const r = Math.round(d * 10) / 10;
  if (Math.abs(r) < 1) return { text: 'in line with your 30-day average', delta: r };
  return {
    text: `${Math.abs(r)} ${unit} ${r > 0 ? 'above' : 'below'} your 30-day average`,
    delta: r,
  };
}

interface Candidate {
  score: number;
  area: string;
  reason: string;
}

export function buildInsights(input: InsightInput): Insights {
  const { today } = input;
  const lines: string[] = [];
  const recent: string[] = [];
  const focus: Candidate[] = [];

  // Sonno
  const nights = (input.nights ?? []).filter((n) => n.day <= today);
  if (nights.length) {
    const from7 = daysBefore(today, 7);
    const week = nights.filter((n) => n.day > from7);
    const last = nights.at(-1)!;
    const a7 = avg(week.map((n) => n.asleepMin));
    const a30 = avg(nights.map((n) => n.asleepMin));
    const parts = [`last night (${last.day}) ${hm(last.asleepMin)} asleep`];
    const st = stageMinutes(last.stages);
    const deep = st[SleepStage.Deep];
    const rem = st[SleepStage.REM];
    if (deep != null || rem != null) {
      parts.push(
        [deep != null ? `deep ${hm(deep)}` : null, rem != null ? `REM ${hm(rem)}` : null]
          .filter(Boolean)
          .join(', '),
      );
    }
    if (a7 != null && week.length >= 3) {
      let s = `average ${hm(a7)} over the last ${week.length} nights`;
      if (a30 != null && nights.length > week.length) {
        const d = Math.round(a7 - a30);
        s +=
          Math.abs(d) < 10
            ? ', in line with your 30-night average'
            : `, ${Math.abs(d)} min ${d > 0 ? 'more' : 'less'} than your 30-night average (${hm(a30)})`;
      }
      parts.push(s);
      const short = week.filter((n) => n.asleepMin < 360).length;
      if (short) parts.push(`${short} of the last ${week.length} nights under 6 h`);
      if (a7 < 420) {
        focus.push({
          score: (420 - a7) / 30 + short,
          area: 'sleep',
          reason: `average sleep ${hm(a7)}, below the 7–9 h recommended for adults`,
        });
      }
    }
    lines.push(`Sleep: ${parts.join('; ')}. Adults need 7–9 h.`);
    recent.push(
      `Sleep per night, oldest to newest: ${week.map((n) => `${n.day.slice(5)} ${hm(n.asleepMin)}`).join(', ')}`,
    );
  }

  // Passi
  if (input.steps?.length) {
    const w = windows(input.steps, today);
    const a7 = avg(w.last7);
    const a30 = avg(w.all);
    if (a7 != null) {
      let s = `Steps: ${int(a7)}/day on average over the last 7 days`;
      if (a30 != null && w.all.length > w.last7.length) {
        const c = change(a7, a30, 'steps', true);
        s += `, ${c.text}`;
        if (c.delta <= -15) {
          focus.push({
            score: Math.abs(c.delta) / 10,
            area: 'movement',
            reason: `steps ${c.text}`,
          });
        }
      }
      if (w.today != null) s += `; today so far ${int(w.today)}`;
      lines.push(`${s}.`);
      if (a7 < 6000) {
        focus.push({
          score: (6000 - a7) / 1000,
          area: 'movement',
          reason: `only ${int(a7)} steps/day on average`,
        });
      }
    }
    recent.push(
      `Steps per day, last 7 days: ${input.steps
        .filter((p) => p.day >= daysBefore(today, 7))
        .map((p) => `${p.day.slice(5)} ${int(p.value)}${p.day === today ? ' (partial)' : ''}`)
        .join(', ')}`,
    );
  }

  // Calorie attive
  if (input.activeEnergy?.length) {
    const w = windows(input.activeEnergy, today);
    const a7 = avg(w.last7);
    const a30 = avg(w.all);
    if (a7 != null) {
      let s = `Active energy: ${int(a7)} kcal/day on average over the last 7 days`;
      if (a30 != null && w.all.length > w.last7.length)
        s += `, ${change(a7, a30, 'kcal', true).text}`;
      lines.push(`${s}.`);
    }
  }

  // Frequenza a riposo (più bassa = meglio)
  if (input.restingHeartRate?.length) {
    // Valori campionati: anche oggi è un giorno valido (ultimi 7 giorni, oggi compreso).
    const a7 = avg(last7Days(input.restingHeartRate, today));
    const a30 = avg(input.restingHeartRate.map((p) => p.value));
    if (a7 != null && a30 != null) {
      const c = change(a7, a30, 'bpm', false);
      lines.push(
        `Resting heart rate: ${Math.round(a7)} bpm over the last 7 days, ${c.text}${c.delta >= 3 ? ' (a rise can mean fatigue, stress, illness or poor recovery)' : c.delta <= -2 ? ' (a good sign of fitness and recovery)' : ''}.`,
      );
      if (c.delta >= 3) {
        focus.push({
          score: c.delta / 1.5,
          area: 'recovery',
          reason: `resting heart rate ${c.text}`,
        });
      }
    }
  }

  // HRV (più alta = meglio)
  if (input.hrv?.length) {
    // Valori campionati: anche oggi è un giorno valido (ultimi 7 giorni, oggi compreso).
    const a7 = avg(last7Days(input.hrv, today));
    const a30 = avg(input.hrv.map((p) => p.value));
    if (a7 != null && a30 != null) {
      const c = change(a7, a30, 'ms', true);
      lines.push(
        `HRV: ${Math.round(a7)} ms over the last 7 days, ${c.text}${c.delta <= -10 ? ' (lower HRV usually means more stress or less recovery)' : c.delta >= 10 ? ' (a sign of good recovery)' : ''}.`,
      );
      if (c.delta <= -10) {
        focus.push({ score: Math.abs(c.delta) / 5, area: 'recovery', reason: `HRV ${c.text}` });
      }
    }
  }

  // Peso
  if (input.weight?.length && input.weight.length >= 2) {
    const first = input.weight[0]!;
    const last = input.weight.at(-1)!;
    const d = Math.round((last.value - first.value) * 10) / 10;
    lines.push(
      `Weight: ${last.value.toFixed(1)} kg on ${last.day}${Math.abs(d) >= 0.3 ? `, ${d > 0 ? '+' : ''}${d} kg since ${first.day}` : ', stable over the last 30 days'}.`,
    );
  }

  // Allenamenti
  if (input.workouts30) {
    const perWeek = (input.workouts30 / 30) * 7;
    lines.push(
      `Workouts: ${input.workouts7 ?? 0} in the last 7 days (usual: about ${perWeek.toFixed(1)} per week).`,
    );
  }

  const best = focus.sort((a, b) => b.score - a.score)[0];
  return {
    lines,
    focus: best ? `${best.area} — ${best.reason}` : null,
    recent,
  };
}
