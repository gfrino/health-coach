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
    'Base it on my profile, data, conditions, diet and preferences. Give 3–6 concrete, doable actions: mostly daily habits, plus one-time steps if useful. Each action has a short title and one line on how to do it. Write in my language.',
    'Reply ONLY with JSON, no other text, in this shape:',
    '{"title":"…","goal":"one sentence","category":"sleep|activity|nutrition|stress|weight|general","items":[{"title":"…","details":"…","frequency":"daily|once"}]}',
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
