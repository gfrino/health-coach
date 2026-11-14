import type { ProgramItemInput } from '@/db/repositories/programRepository';

import { parseDays } from './schedule';

/** Azioni di un programma da input non affidabile (tool call o JSON del modello). */
export function parseProgramItems(raw: unknown, max = 12): ProgramItemInput[] {
  if (!Array.isArray(raw)) return [];
  const out: ProgramItemInput[] = [];
  for (const it of raw) {
    const o = (typeof it === 'string' ? { title: it } : it) as Record<string, unknown> | null;
    const title = typeof o?.title === 'string' ? o.title.trim() : '';
    if (!title) continue;
    out.push({
      title: title.slice(0, 120),
      details: typeof o?.details === 'string' ? o.details.trim().slice(0, 300) || null : null,
      frequency: o?.frequency === 'once' ? 'once' : 'daily',
      // Giorni indicati dal modello; se mancano si deducono dal titolo.
      ...(Array.isArray(o?.days) ? { days: parseDays(o.days) } : {}),
      ...(o?.auto === false ? { auto: 'off' as const } : {}),
    });
    if (out.length >= max) break;
  }
  return out;
}
