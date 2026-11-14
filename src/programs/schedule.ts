/**
 * Giorni della settimana e spunta automatica delle azioni dei programmi.
 *
 * - `days`: in quali giorni un'azione quotidiana è prevista (1 = lunedì … 7 = domenica, ISO);
 *   `null` = tutti i giorni. Se non è salvato si ricava dal titolo ("Lunedì — 10 minuti di …").
 * - `auto`: come riconoscere l'azione dai dati di salute (allenamenti di Apple Fitness / Health
 *   Connect, passi). Se non è salvato si ricava dal titolo ("20 min di camminata", "8000 passi").
 *   `'off'` = mai in automatico.
 */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type AutoRule =
  | {
      kind: 'workout';
      /** Tipi di allenamento validi (normalizzati, es. 'walking'); `null` = qualsiasi. */
      activities: string[] | null;
      /** Minuti totali richiesti nella giornata. */
      minMinutes: number;
    }
  | { kind: 'steps'; min: number };

/** Giorno della settimana ISO di una data locale "AAAA-MM-GG". */
export function weekdayOf(day: string): Weekday {
  const d = new Date(`${day}T12:00:00`).getDay(); // 0 = domenica
  return (d === 0 ? 7 : d) as Weekday;
}

export function isScheduled(days: readonly Weekday[] | null, day: string): boolean {
  return !days || days.length === 0 || days.includes(weekdayOf(day));
}

/** Giorni da input non affidabile (tool, JSON del modello): ["mon","wed"] o [1,3]. */
export function parseDays(raw: unknown): Weekday[] | null {
  if (!Array.isArray(raw)) return null;
  const out = new Set<Weekday>();
  for (const v of raw) {
    if (typeof v === 'number' && v >= 1 && v <= 7) out.add(Math.round(v) as Weekday);
    else if (typeof v === 'string') {
      const i = WEEKDAY_KEYS.indexOf(v.trim().slice(0, 3).toLowerCase() as WeekdayKey);
      if (i >= 0) out.add((i + 1) as Weekday);
    }
  }
  return out.size && out.size < 7 ? [...out].sort((a, b) => a - b) : null;
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Nomi dei giorni nelle 4 lingue dell'app (senza accenti). */
const DAY_NAMES: [Weekday, RegExp][] = [
  [1, /\b(lunedi|monday|montag|lundi)\b/],
  [2, /\b(martedi|tuesday|dienstag|mardi)\b/],
  [3, /\b(mercoledi|wednesday|mittwoch|mercredi)\b/],
  [4, /\b(giovedi|thursday|donnerstag|jeudi)\b/],
  [5, /\b(venerdi|friday|freitag|vendredi)\b/],
  [6, /\b(sabato|saturday|samstag|samedi)\b/],
  [7, /\b(domenica|sunday|sonntag|dimanche)\b/],
];

/** Giorni nominati nel titolo (es. "Lunedì — 10 minuti di stretching"). */
export function inferDays(title: string): Weekday[] | null {
  const t = fold(title);
  const days = DAY_NAMES.filter(([, re]) => re.test(t)).map(([d]) => d);
  return days.length && days.length < 7 ? days : null;
}

/** Gruppi di parole → tipi di allenamento (nomi normalizzati in sources/normalize). */
const ACTIVITY_WORDS: [RegExp, string[]][] = [
  [
    /(camminat|passeggiat|\bwalk|spazier|marche\b|\bmarcher|wander|escursion|hike|hiking)/,
    ['walking', 'hiking'],
  ],
  [/(\bcorsa\b|\bcorrere|\brun\b|running|jogging|\blauf|course a pied|\bcourir)/, ['running']],
  [/(\bbici|ciclismo|cycling|\bbike|radfahr|\bvelo\b)/, ['cycling']],
  [/(nuot|\bswim|schwimm|\bnage|natation)/, ['swimming']],
  [/(\byoga)/, ['yoga', 'mindAndBody', 'flexibility']],
  [/(pilates)/, ['pilates', 'coreTraining']],
  [
    /(stretching|allungament|flessibilit|mobilit|dehn|etirement|assouplissement)/,
    ['flexibility', 'yoga', 'cooldown', 'mindAndBody', 'preparationAndRecovery', 'pilates'],
  ],
  [
    /(\bforza\b|\bpesi\b|palestra|strength|\bkraft|muscula|renforcement|\bcore\b|addominal|\babs\b|bauch|gainage)/,
    ['strength', 'functionalStrength', 'coreTraining', 'hiit', 'crossTraining'],
  ],
  [/(\bhiit\b|interval)/, ['hiit', 'mixedCardio', 'crossTraining']],
  [
    /(cardio|elliptic|ellittic|rowing|vogatore|rudern)/,
    ['mixedCardio', 'elliptical', 'rowing', 'hiit'],
  ],
  [/(\bballo\b|\bdance|tanz|\bdanse)/, ['dance']],
];

/** Parole generiche: va bene qualsiasi allenamento registrato. */
const ANY_WORKOUT =
  /(allenament|workout|training|esercizi|attivita fisica|\bsport|movimento|bewegung|entrainement|seance)/;

/** Azioni che parlano di non fare qualcosa: mai spuntate da un allenamento. */
const NEGATIVE = /\b(evita|evitare|niente|non |no |avoid|don't|vermeide|kein|eviter|pas de)\b/;

/** Riconoscimento automatico dedotto dal testo dell'azione, se è chiaramente un'attività fisica. */
export function inferAutoRule(title: string, details?: string | null): AutoRule | null {
  const t = fold(title);
  const all = fold(`${title} ${details ?? ''}`);
  if (NEGATIVE.test(t)) return null;

  const steps = /(\d{1,2}[.' ]?\d{3}|\d{3,5})\s*(passi|steps|schritte|pas)\b/.exec(all);
  if (steps?.[1]) {
    const n = Number(steps[1].replace(/[.' ]/g, ''));
    if (n >= 500) return { kind: 'steps', min: n };
  }

  const activities = new Set<string>();
  for (const [re, types] of ACTIVITY_WORDS) if (re.test(t)) types.forEach((x) => activities.add(x));
  const generic = ANY_WORKOUT.test(t);
  if (!activities.size && !generic) return null;

  const minutes = /(\d{1,3})\s*(?:-\s*\d{1,3}\s*)?(min\b|minut|mins\b|')/.exec(all);
  const minMinutes = minutes?.[1] ? Math.max(5, Math.min(240, Number(minutes[1]))) : 10;
  return { kind: 'workout', activities: activities.size ? [...activities] : null, minMinutes };
}

/** Regola da input non affidabile (colonna salvata o tool): `'off'`, oggetto o niente. */
export function parseAutoRule(raw: unknown): AutoRule | 'off' | null {
  if (raw === 'off') return 'off';
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'steps' && typeof o.min === 'number' && o.min > 0) {
    return { kind: 'steps', min: Math.round(o.min) };
  }
  if (o.kind === 'workout') {
    const acts = Array.isArray(o.activities)
      ? o.activities.filter((a): a is string => typeof a === 'string' && !!a)
      : null;
    const min = typeof o.minMinutes === 'number' && o.minMinutes > 0 ? o.minMinutes : 10;
    return { kind: 'workout', activities: acts?.length ? acts : null, minMinutes: Math.round(min) };
  }
  return null;
}

export interface DayActivity {
  workouts: { activityType: string; durationMin: number | null }[];
  steps: number | null;
}

/** La regola è soddisfatta dai dati della giornata? */
export function ruleSatisfied(rule: AutoRule, day: DayActivity): boolean {
  if (rule.kind === 'steps') return (day.steps ?? 0) >= rule.min;
  const minutes = day.workouts
    .filter((w) => !rule.activities || rule.activities.includes(w.activityType))
    .reduce((a, w) => a + (w.durationMin ?? 0), 0);
  return minutes >= rule.minMinutes;
}

/** Descrizione breve per il coach (in inglese, come il resto del prompt). */
export function describeRule(rule: AutoRule): string {
  return rule.kind === 'steps'
    ? `auto-ticked at ${rule.min} steps`
    : `auto-ticked by ${rule.minMinutes}+ min of ${rule.activities ? rule.activities.join('/') : 'any'} workout`;
}
