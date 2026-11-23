import {
  asCategory,
  type ProgramCategory,
  type ProgramItemInput,
} from '@/db/repositories/programRepository';

import { parseProgramItems } from './parse';

/**
 * Programma generato dall'AI scelta dall'utente (anche quella del telefono, che non ha tool):
 * si chiede un JSON e lo si legge in modo tollerante.
 */

export interface GeneratedProgram {
  title: string;
  goal: string | null;
  category: ProgramCategory;
  durationDays: number | null;
  items: ProgramItemInput[];
}

export function programInstruction(opts: {
  focus: string;
  details: string;
  durationDays: number | null;
}): string {
  return [
    `Create a personal program for me. Focus: ${opts.focus}.`,
    opts.details.trim() ? `What I want: ${opts.details.trim()}` : null,
    opts.durationDays ? `Length: ${opts.durationDays} days.` : 'Length: open-ended.',
    'Base it on my profile, goals, data, conditions, diet and preferences. Give 3–6 concrete, doable actions: mostly recurring habits, plus one-time steps if useful. Each action has a short title and one line on how to do it. Write in my language.',
    // Il coach trasformava richieste di analisi in compiti da programmatore ("Esporta i dati", "API").
    'Every action is something I do myself in daily life (eat, move, sleep, breathe, log a meal at the right time, check a result in the app). Never actions for the app, a developer or a data analyst: no exports, APIs, permissions setup, analyses or code. If what I want is an analysis of my data, turn it into habits that make that analysis possible and useful (e.g. "Log every meal at the time you eat it", "Wear your watch during meals") and tell me where the app shows the result.',
    'A habit done only on some weekdays is ONE action with "days" (e.g. ["mon","wed","fri"]), never one action per weekday. Put the workout and its minutes in the title (e.g. "20 min brisk walk", "10 min stretching and core"): the app ticks it by itself when my health app records the workout.',
    'Reply ONLY with JSON, no other text, in this shape:',
    '{"title":"…","goal":"one sentence","category":"sleep|activity|nutrition|stress|weight|general","items":[{"title":"…","details":"…","frequency":"daily|once","days":["mon","thu"]}]}',
    'Omit "days" for an every-day habit.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Estrae il primo oggetto JSON dalla risposta (anche dentro ```json … ```). */
export function parseGeneratedProgram(
  text: string,
  durationDays: number | null,
): GeneratedProgram | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const title = typeof data.title === 'string' ? data.title.trim().slice(0, 80) : '';
  const items = parseProgramItems(data.items, 8);
  if (!title || !items.length) return null;
  return {
    title,
    goal: typeof data.goal === 'string' ? data.goal.trim().slice(0, 300) || null : null,
    category: asCategory(data.category),
    durationDays,
    items,
  };
}
