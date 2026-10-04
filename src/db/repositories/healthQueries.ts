import { localIsoDate } from '@/lib/dates';
import { CUMULATIVE_METRICS, type MetricType } from '@/sources/model';

import type { Db } from '../types';

/** Query di sola lettura usate dagli strumenti del coach (restituiscono solo aggregati). */

export interface DailyValue {
  day: string;
  value: number;
}

export async function dailyMetric(
  db: Db,
  type: string,
  fromMs: number,
  toMs: number,
): Promise<{ unit: string | null; days: DailyValue[] }> {
  // Tipi cumulativi: somma del giorno; campionati (frequenza, peso…): media del giorno.
  const agg = CUMULATIVE_METRICS.has(type as MetricType) ? 'SUM' : 'AVG';
  const rows = await db.getAllAsync<{ day: string; value: number; unit: string }>(
    `SELECT date(start_at / 1000, 'unixepoch', 'localtime') AS day, ${agg}(value) AS value, MAX(unit) AS unit
     FROM metrics WHERE type = ? AND start_at >= ? AND start_at < ?
     GROUP BY day ORDER BY day`,
    [type, fromMs, toMs],
  );
  return {
    unit: rows[0]?.unit ?? null,
    days: rows.map((r) => ({ day: r.day, value: Math.round(r.value * 100) / 100 })),
  };
}

export async function labResultsByName(db: Db, name: string, limit = 20) {
  const q = `%${name.trim().toLowerCase()}%`;
  return db.getAllAsync<{
    name: string;
    value: number | null;
    value_text: string | null;
    unit: string | null;
    ref_low: number | null;
    ref_high: number | null;
    measured_at: string;
  }>(
    `SELECT name, value, value_text, unit, ref_low, ref_high, measured_at FROM lab_results
     WHERE normalized_name LIKE ? ORDER BY measured_at DESC LIMIT ?`,
    [q, limit],
  );
}

export async function journalRange(db: Db, fromMs: number, toMs: number, limit = 30) {
  const rows = await db.getAllAsync<{
    id: string;
    entry_at: number;
    source: string;
    text: string | null;
    mood: number | null;
    energy: number | null;
    tags: string | null;
    symptoms: string | null;
  }>(
    `SELECT id, entry_at, source, text, mood, energy, tags, symptoms FROM journal_entries
     WHERE entry_at >= ? AND entry_at < ? ORDER BY entry_at DESC LIMIT ?`,
    [fromMs, toMs, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    date: localIsoDate(new Date(r.entry_at)),
    written_by: r.source,
    text: r.text,
    mood: r.mood,
    energy: r.energy,
    tags: safeArray(r.tags),
    symptoms: safeArray(r.symptoms),
  }));
}

export async function recentMemoryFacts(db: Db, limit = 30): Promise<string[]> {
  const rows = await db.getAllAsync<{ text: string }>(
    'SELECT text FROM memory_facts ORDER BY pinned DESC, updated_at DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => r.text);
}

export async function recentSummaries(db: Db, limit = 3) {
  const rows = await db.getAllAsync<{ summary: string; created_at: number }>(
    "SELECT summary, created_at FROM conversation_summaries WHERE summary <> '—' ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
  return rows.map((r) => ({ date: localIsoDate(new Date(r.created_at)), text: r.summary }));
}

function safeArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
