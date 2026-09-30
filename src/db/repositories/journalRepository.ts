import { newId } from '../ids';
import type { Db } from '../types';

/** Diario: come si sente l'utente (umore, energia, sintomi, note). Può scriverlo lui o il coach. */

export type JournalSource = 'user' | 'coach';

export interface JournalEntry {
  id: string;
  entryAt: number;
  text: string | null;
  mood: number | null;
  energy: number | null;
  symptoms: string[];
  tags: string[];
  source: JournalSource;
  updatedAt: number;
}

export interface JournalInput {
  entryAt?: number;
  text?: string | null;
  mood?: number | null;
  energy?: number | null;
  symptoms?: string[];
  tags?: string[];
}

interface Row {
  id: string;
  entry_at: number;
  text: string | null;
  mood: number | null;
  energy: number | null;
  symptoms: string | null;
  tags: string | null;
  source: JournalSource;
  updated_at: number;
}

const list = (v: string | null): string[] => {
  try {
    const a: unknown = v ? JSON.parse(v) : [];
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const toEntry = (r: Row): JournalEntry => ({
  id: r.id,
  entryAt: r.entry_at,
  text: r.text,
  mood: r.mood,
  energy: r.energy,
  symptoms: list(r.symptoms),
  tags: list(r.tags),
  source: r.source,
  updatedAt: r.updated_at,
});

const scale = (v: number | null | undefined) =>
  v == null ? null : Math.min(5, Math.max(1, Math.round(v)));
const clean = (xs: string[] | undefined) =>
  [...new Set((xs ?? []).map((x) => x.trim()).filter(Boolean))].slice(0, 20);
const json = (xs: string[] | undefined) => {
  const c = clean(xs);
  return c.length ? JSON.stringify(c) : null;
};

const COLUMNS = 'id, entry_at, text, mood, energy, symptoms, tags, source, updated_at';

export async function listEntries(db: Db, limit = 100): Promise<JournalEntry[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT ${COLUMNS} FROM journal_entries ORDER BY entry_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toEntry);
}

export async function getEntry(db: Db, id: string): Promise<JournalEntry | null> {
  const r = await db.getFirstAsync<Row>(`SELECT ${COLUMNS} FROM journal_entries WHERE id = ?`, [
    id,
  ]);
  return r ? toEntry(r) : null;
}

export async function createEntry(
  db: Db,
  input: JournalInput,
  source: JournalSource = 'user',
): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO journal_entries (id, entry_at, text, mood, energy, symptoms, tags, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.entryAt ?? now,
      input.text?.trim() || null,
      scale(input.mood),
      scale(input.energy),
      json(input.symptoms),
      json(input.tags),
      source,
      now,
      now,
    ],
  );
  return id;
}

/** Aggiorna solo i campi presenti in `patch`. */
export async function updateEntry(db: Db, id: string, patch: JournalInput): Promise<boolean> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  const set = (col: string, v: string | number | null) => {
    sets.push(`${col} = ?`);
    values.push(v);
  };
  if (patch.entryAt !== undefined) set('entry_at', patch.entryAt);
  if (patch.text !== undefined) set('text', patch.text?.trim() || null);
  if (patch.mood !== undefined) set('mood', scale(patch.mood));
  if (patch.energy !== undefined) set('energy', scale(patch.energy));
  if (patch.symptoms !== undefined) set('symptoms', json(patch.symptoms));
  if (patch.tags !== undefined) set('tags', json(patch.tags));
  set('updated_at', Date.now());
  const res = await db.runAsync(`UPDATE journal_entries SET ${sets.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
  return res.changes > 0;
}

export async function deleteEntry(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM journal_entries WHERE id = ?', [id]);
}
