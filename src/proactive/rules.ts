import type { Proactivity } from '@/config/settingsSchema';

/**
 * Regole delle notifiche proattive: funzioni pure (testabili), calcolate sul telefono dopo
 * ogni sincronizzazione. Nessun dato esce dal dispositivo: il testo nasce da modelli tradotti.
 */

export type NotificationKind =
  'morning' | 'sleepDebt' | 'recovery' | 'activity' | 'daily' | 'weekly';

export interface ProactiveInput {
  now: Date;
  /** YYYY-MM-DD locale di oggi. */
  today: string;
  /** Notti degli ultimi 30 giorni (una per giorno di risveglio), dalla più vecchia. */
  nights: { day: string; asleepMin: number; endAt: number }[];
  stepsToday: number | null;
  /** Media dei passi dei 7 giorni completi precedenti. */
  steps7: number | null;
  /** Media dei passi dei 7 giorni prima ancora (per il riepilogo settimanale). */
  stepsPrev7: number | null;
  rhr7: number | null;
  rhr30: number | null;
  hrv7: number | null;
  hrv30: number | null;
  /** Giorni con valori di frequenza a riposo / HRV negli ultimi 30 (serve una base solida). */
  baselineDays: number;
  prefs: Proactivity;
  sent: { id: string; kind: string; sentAt: number }[];
}

export interface NotificationCandidate {
  id: string;
  kind: NotificationKind;
  /** Più alto = più importante. */
  priority: number;
  /** Parametri per i testi tradotti (proactive.<kind>.title/body/ask). */
  params: Record<string, string | number>;
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
export const parseTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Ore di silenzio, anche a cavallo della mezzanotte (es. 22:00–07:30). */
export function inQuietHours(now: Date, start: string, end: string): boolean {
  const t = minutesOfDay(now);
  const s = parseTime(start);
  const e = parseTime(end);
  return s <= e ? t >= s && t < e : t >= s || t < e;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const hm = (min: number) => {
  const m = Math.round(min);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};

/** Settimana ISO (per non ripetere il riepilogo settimanale). */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

const sentRecently = (input: ProactiveInput, kind: NotificationKind, withinMs: number) =>
  input.sent.some((s) => s.kind === kind && input.now.getTime() - s.sentAt < withinMs);

export function evaluateNotifications(input: ProactiveInput): NotificationCandidate[] {
  const { now, today, prefs } = input;
  if (prefs.mode !== 'proactive') return [];
  const out: NotificationCandidate[] = [];
  const t = minutesOfDay(now);
  const evening = parseTime(prefs.eveningSummaryTime);
  const nights = input.nights;
  const lastNight = nights.at(-1);
  const avg30 = avg(nights.map((n) => n.asleepMin));

  // Mattina: com'è andata la notte (dopo il risveglio, entro mezzogiorno).
  if (
    lastNight &&
    lastNight.day === today &&
    now.getTime() >= lastNight.endAt + 20 * MIN &&
    now.getHours() < 12
  ) {
    const diff = avg30 != null && nights.length >= 7 ? Math.round(lastNight.asleepMin - avg30) : 0;
    out.push({
      id: `morning:${today}`,
      kind: 'morning',
      priority: 2,
      params: {
        duration: hm(lastNight.asleepMin),
        variant: Math.abs(diff) < 20 ? 'usual' : diff > 0 ? 'more' : 'less',
        diff: hm(Math.abs(diff)),
      },
    });
  }

  // Debito di sonno: almeno 3 delle ultime 5 notti sotto le 6 ore.
  const last5 = nights.slice(-5);
  const short = last5.filter((n) => n.asleepMin < 360).length;
  if (last5.length >= 3 && short >= 3 && !sentRecently(input, 'sleepDebt', 3 * DAY)) {
    out.push({
      id: `sleepDebt:${today}`,
      kind: 'sleepDebt',
      priority: 3,
      params: { count: short, total: last5.length },
    });
  }

  // Recupero: frequenza a riposo in salita o HRV in calo rispetto alla propria media.
  if (input.baselineDays >= 14 && !sentRecently(input, 'recovery', 3 * DAY)) {
    const rhrUp =
      input.rhr7 != null && input.rhr30 != null ? Math.round(input.rhr7 - input.rhr30) : 0;
    const hrvDown =
      input.hrv7 != null && input.hrv30 != null && input.hrv30 > 0
        ? Math.round(((input.hrv30 - input.hrv7) / input.hrv30) * 100)
        : 0;
    if (rhrUp >= 3 || hrvDown >= 15) {
      out.push({
        id: `recovery:${today}`,
        kind: 'recovery',
        priority: 3,
        params: {
          variant: rhrUp >= 3 && hrvDown >= 15 ? 'both' : rhrUp >= 3 ? 'rhr' : 'hrv',
          rhrUp,
          hrvDown,
        },
      });
    }
  }

  // Pomeriggio/sera: pochi passi rispetto al solito (nelle 3 ore prima del riepilogo serale).
  if (
    input.stepsToday != null &&
    input.steps7 != null &&
    input.steps7 >= 3000 &&
    t >= evening - 180 &&
    t < evening &&
    input.stepsToday < input.steps7 * 0.6
  ) {
    out.push({
      id: `activity:${today}`,
      kind: 'activity',
      priority: 1,
      params: {
        steps: Math.round(input.stepsToday),
        usual: Math.round(input.steps7),
      },
    });
  }

  // Riepilogo serale.
  if (prefs.reports.daily && t >= evening) {
    out.push({
      id: `daily:${today}`,
      kind: 'daily',
      priority: 1,
      params: {
        steps: input.stepsToday != null ? Math.round(input.stepsToday) : 0,
        sleep: lastNight?.day === today ? hm(lastNight.asleepMin) : '',
      },
    });
  }

  // Riepilogo settimanale: domenica sera.
  if (prefs.reports.weekly && now.getDay() === 0 && t >= evening) {
    const week = nights.filter((n) => now.getTime() - n.endAt < 7 * DAY);
    const sleep7 = avg(week.map((n) => n.asleepMin));
    out.push({
      id: `weekly:${isoWeek(now)}`,
      kind: 'weekly',
      priority: 2,
      params: {
        sleep: sleep7 != null ? hm(sleep7) : '',
        steps: input.steps7 != null ? Math.round(input.steps7) : 0,
        trend:
          input.steps7 != null && input.stepsPrev7 != null && input.stepsPrev7 > 0
            ? Math.round(((input.steps7 - input.stepsPrev7) / input.stepsPrev7) * 100)
            : 0,
      },
    });
  }

  return out;
}

/** Tra i candidati, al massimo UNO per controllo: il più importante non ancora inviato. */
export function pickNotification(input: ProactiveInput): NotificationCandidate | null {
  const { now, prefs, sent } = input;
  if (inQuietHours(now, prefs.quietHoursStart, prefs.quietHoursEnd)) return null;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = sent.filter((s) => s.sentAt >= startOfDay.getTime());
  if (sentToday.length >= prefs.maxNotificationsPerDay) return null;
  // Almeno 90 minuti tra una notifica e l'altra, salvo gli avvisi importanti.
  const lastSent = Math.max(0, ...sent.map((s) => s.sentAt));
  const ids = new Set(sent.map((s) => s.id));
  const fresh = evaluateNotifications(input)
    .filter((c) => !ids.has(c.id))
    .filter((c) => c.priority >= 3 || now.getTime() - lastSent >= 90 * MIN)
    .sort((a, b) => b.priority - a.priority);
  return fresh[0] ?? null;
}
