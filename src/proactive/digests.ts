import type { Proactivity } from '@/config/settingsSchema';
import { localIsoDate } from '@/lib/dates';

import {
  evaluateNotifications,
  parseTime,
  type NotificationCandidate,
  type ProactiveInput,
} from './rules';

/**
 * Check-in quotidiani (mattino e sera) PROGRAMMATI in anticipo come notifiche locali a orario:
 * iOS e Android li consegnano anche se l'app non viene risvegliata in background. A ogni
 * sincronizzazione il testo di quelli in arrivo si aggiorna con i dati veri (e, al mattino,
 * con l'analisi del coach se è pronta).
 */

export type CheckinKind = 'morning' | 'evening';

export interface CheckinSlot {
  /** Es. "morning:2026-10-03": identificativo della notifica e del check-in salvato. */
  id: string;
  kind: CheckinKind;
  day: string;
  at: Date;
}

/** Quanti giorni programmare in anticipo (iOS tiene al massimo 64 notifiche in attesa). */
export const CHECKIN_DAYS_AHEAD = 7;

function at(day: Date, hhmm: string): Date {
  const d = new Date(day);
  const m = parseTime(hhmm);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

/** Orari dei prossimi check-in (solo futuri), in ordine. */
export function checkinSlots(
  prefs: Proactivity,
  now: Date,
  days = CHECKIN_DAYS_AHEAD,
): CheckinSlot[] {
  if (prefs.mode !== 'proactive') return [];
  const out: CheckinSlot[] = [];
  for (let k = 0; k < days; k++) {
    const day = new Date(now);
    day.setDate(day.getDate() + k);
    const iso = localIsoDate(day);
    out.push({
      id: `morning:${iso}`,
      kind: 'morning',
      day: iso,
      at: at(day, prefs.morningCheckinTime),
    });
    const sunday = day.getDay() === 0;
    if (prefs.reports.daily || (sunday && prefs.reports.weekly)) {
      out.push({
        id: `evening:${iso}`,
        kind: 'evening',
        day: iso,
        at: at(day, prefs.eveningSummaryTime),
      });
    }
  }
  return out.filter((s) => s.at.getTime() > now.getTime()).sort((a, b) => +a.at - +b.at);
}

/**
 * Contenuto con i dati veri per un check-in di OGGI: le regole valutate all'orario del check-in
 * (il mattino richiede la notte già sincronizzata). Null = testo generico.
 */
export function checkinCandidate(
  slot: CheckinSlot,
  input: Omit<ProactiveInput, 'now' | 'sent'>,
): NotificationCandidate | null {
  if (slot.day !== input.today) return null;
  const candidates = evaluateNotifications({ ...input, now: slot.at, sent: [] });
  const kinds = slot.kind === 'morning' ? ['morning'] : ['weekly', 'daily'];
  for (const k of kinds) {
    const c = candidates.find((x) => x.kind === k);
    if (c) return c;
  }
  return null;
}

/** Tipi che arrivano con i check-in programmati: non si inviano anche come avvisi immediati. */
export const SCHEDULED_KINDS = new Set(['morning', 'daily', 'weekly']);

/** Prima frase, senza markdown, per il testo della notifica. */
export function firstSentence(text: string, max = 150): string {
  const plain = text
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = plain.match(/^(.+?[.!?])(\s|$)/);
  const s = (m?.[1] ?? plain).trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
