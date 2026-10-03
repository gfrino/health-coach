import { newId } from '../ids';
import type { Db } from '../types';

/**
 * Programmi: piani con azioni da spuntare (ogni giorno o una volta sola), creati dal coach
 * o dall'utente e sempre modificabili. Le spunte sono per giorno (YYYY-MM-DD locale).
 */

export const PROGRAM_CATEGORIES = [
  'sleep',
  'activity',
  'nutrition',
  'stress',
  'weight',
  'general',
] as const;
export type ProgramCategory = (typeof PROGRAM_CATEGORIES)[number];
export type ProgramStatus = 'active' | 'completed' | 'archived';
export type ItemFrequency = 'daily' | 'once';

export interface ProgramItem {
  id: string;
  programId: string;
  title: string;
  details: string | null;
  frequency: ItemFrequency;
  position: number;
}

export interface Program {
  id: string;
  title: string;
  goal: string | null;
  category: ProgramCategory;
  status: ProgramStatus;
  startDay: string;
  durationDays: number | null;
  source: 'user' | 'coach';
  createdAt: number;
  updatedAt: number;
  items: ProgramItem[];
}

export interface ProgramItemInput {
  title: string;
  details?: string | null;
  frequency?: ItemFrequency;
}

export interface ProgramInput {
  title: string;
  goal?: string | null;
  category?: ProgramCategory;
  startDay: string;
  durationDays?: number | null;
  items: ProgramItemInput[];
}

interface ProgramRow {
  id: string;
  title: string;
  goal: string | null;
  category: string;
  status: string;
  start_day: string;
  duration_days: number | null;
  source: string;
  created_at: number;
  updated_at: number;
}

interface ItemRow {
  id: string;
  program_id: string;
  title: string;
  details: string | null;
  frequency: string;
  position: number;
}

export const asCategory = (v: unknown): ProgramCategory =>
  PROGRAM_CATEGORIES.includes(v as ProgramCategory) ? (v as ProgramCategory) : 'general';

const toItem = (r: ItemRow): ProgramItem => ({
  id: r.id,
  programId: r.program_id,
  title: r.title,
  details: r.details,
  frequency: r.frequency === 'once' ? 'once' : 'daily',
  position: r.position,
});

const toProgram = (r: ProgramRow, items: ProgramItem[]): Program => ({
  id: r.id,
  title: r.title,
  goal: r.goal,
  category: asCategory(r.category),
  status: r.status === 'completed' || r.status === 'archived' ? r.status : 'active',
  startDay: r.start_day,
  durationDays: r.duration_days,
  source: r.source === 'coach' ? 'coach' : 'user',
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  items,
});

async function itemsFor(db: Db, programIds: string[]): Promise<Map<string, ProgramItem[]>> {
  const map = new Map<string, ProgramItem[]>();
  if (!programIds.length) return map;
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT id, program_id, title, details, frequency, position FROM program_items
     WHERE program_id IN (${programIds.map(() => '?').join(',')}) ORDER BY position, created_at`,
    programIds,
  );
  for (const r of rows) {
    const list = map.get(r.program_id) ?? [];
    list.push(toItem(r));
    map.set(r.program_id, list);
  }
  return map;
}

export async function listPrograms(
  db: Db,
  status?: ProgramStatus | ProgramStatus[],
): Promise<Program[]> {
  const statuses = status === undefined ? null : Array.isArray(status) ? status : [status];
  const rows = await db.getAllAsync<ProgramRow>(
    `SELECT * FROM programs ${
      statuses ? `WHERE status IN (${statuses.map(() => '?').join(',')})` : ''
    } ORDER BY updated_at DESC`,
    statuses ?? [],
  );
  const items = await itemsFor(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toProgram(r, items.get(r.id) ?? []));
}

export async function getProgram(db: Db, id: string): Promise<Program | null> {
  const row = await db.getFirstAsync<ProgramRow>('SELECT * FROM programs WHERE id = ?', [id]);
  if (!row) return null;
  return toProgram(row, (await itemsFor(db, [id])).get(id) ?? []);
}

async function touch(db: Db, programId: string) {
  await db.runAsync('UPDATE programs SET updated_at = ? WHERE id = ?', [Date.now(), programId]);
}

export async function createProgram(
  db: Db,
  input: ProgramInput,
  source: 'user' | 'coach' = 'user',
): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO programs (id, title, goal, category, status, start_day, duration_days, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
      [
        id,
        input.title.trim(),
        input.goal?.trim() || null,
        input.category ?? 'general',
        input.startDay,
        input.durationDays ?? null,
        source,
        now,
        now,
      ],
    );
    let position = 0;
    for (const item of input.items) await insertItem(db, id, item, position++, now);
  });
  return id;
}

async function insertItem(
  db: Db,
  programId: string,
  item: ProgramItemInput,
  position: number,
  now: number,
): Promise<string> {
  const id = newId();
  await db.runAsync(
    `INSERT INTO program_items (id, program_id, title, details, frequency, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      programId,
      item.title.trim(),
      item.details?.trim() || null,
      item.frequency === 'once' ? 'once' : 'daily',
      position,
      now,
    ],
  );
  return id;
}

export async function updateProgram(
  db: Db,
  id: string,
  patch: Partial<{
    title: string;
    goal: string | null;
    category: ProgramCategory;
    status: ProgramStatus;
    durationDays: number | null;
  }>,
): Promise<boolean> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const col = (c: string, v: string | number | null) => {
    sets.push(`${c} = ?`);
    args.push(v);
  };
  if (patch.title !== undefined && patch.title.trim()) col('title', patch.title.trim());
  if (patch.goal !== undefined) col('goal', patch.goal?.trim() || null);
  if (patch.category !== undefined) col('category', patch.category);
  if (patch.status !== undefined) col('status', patch.status);
  if (patch.durationDays !== undefined) col('duration_days', patch.durationDays);
  col('updated_at', Date.now());
  const res = await db.runAsync(`UPDATE programs SET ${sets.join(', ')} WHERE id = ?`, [
    ...args,
    id,
  ]);
  return res.changes > 0;
}

export async function deleteProgram(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM programs WHERE id = ?', [id]);
}

export async function addItem(db: Db, programId: string, item: ProgramItemInput): Promise<string> {
  const max = await db.getFirstAsync<{ p: number | null }>(
    'SELECT MAX(position) AS p FROM program_items WHERE program_id = ?',
    [programId],
  );
  const id = await insertItem(db, programId, item, (max?.p ?? -1) + 1, Date.now());
  await touch(db, programId);
  return id;
}

export async function updateItem(
  db: Db,
  itemId: string,
  patch: Partial<{ title: string; details: string | null; frequency: ItemFrequency }>,
): Promise<boolean> {
  const item = await db.getFirstAsync<{ program_id: string }>(
    'SELECT program_id FROM program_items WHERE id = ?',
    [itemId],
  );
  if (!item) return false;
  const sets: string[] = [];
  const args: (string | null)[] = [];
  if (patch.title !== undefined && patch.title.trim()) {
    sets.push('title = ?');
    args.push(patch.title.trim());
  }
  if (patch.details !== undefined) {
    sets.push('details = ?');
    args.push(patch.details?.trim() || null);
  }
  if (patch.frequency !== undefined) {
    sets.push('frequency = ?');
    args.push(patch.frequency === 'once' ? 'once' : 'daily');
  }
  if (sets.length)
    await db.runAsync(`UPDATE program_items SET ${sets.join(', ')} WHERE id = ?`, [
      ...args,
      itemId,
    ]);
  await touch(db, item.program_id);
  return true;
}

export async function removeItem(db: Db, itemId: string): Promise<void> {
  const item = await db.getFirstAsync<{ program_id: string }>(
    'SELECT program_id FROM program_items WHERE id = ?',
    [itemId],
  );
  await db.runAsync('DELETE FROM program_items WHERE id = ?', [itemId]);
  if (item) await touch(db, item.program_id);
}

/**
 * Spunte: per le azioni quotidiane conta il giorno indicato; per quelle "una volta" basta
 * una spunta qualsiasi (restano fatte).
 */
export async function setItemDone(db: Db, item: ProgramItem, day: string, done: boolean) {
  if (done) {
    await db.runAsync(
      'INSERT OR REPLACE INTO program_checks (item_id, day, done_at) VALUES (?, ?, ?)',
      [item.id, day, Date.now()],
    );
  } else if (item.frequency === 'once') {
    await db.runAsync('DELETE FROM program_checks WHERE item_id = ?', [item.id]);
  } else {
    await db.runAsync('DELETE FROM program_checks WHERE item_id = ? AND day = ?', [item.id, day]);
  }
}

/** Azioni fatte nel giorno indicato (le "una volta" contano se fatte in qualsiasi giorno). */
export async function doneItemIds(db: Db, items: ProgramItem[], day: string): Promise<Set<string>> {
  if (!items.length) return new Set();
  const rows = await db.getAllAsync<{ item_id: string; day: string }>(
    `SELECT item_id, day FROM program_checks WHERE item_id IN (${items.map(() => '?').join(',')})`,
    items.map((i) => i.id),
  );
  const freq = new Map(items.map((i) => [i.id, i.frequency]));
  return new Set(
    rows.filter((r) => freq.get(r.item_id) === 'once' || r.day === day).map((r) => r.item_id),
  );
}

/** Spunte per giorno nel periodo (per la costanza degli ultimi giorni). */
export async function checksBetween(
  db: Db,
  items: ProgramItem[],
  fromDay: string,
  toDay: string,
): Promise<{ itemId: string; day: string }[]> {
  if (!items.length) return [];
  const rows = await db.getAllAsync<{ item_id: string; day: string }>(
    `SELECT item_id, day FROM program_checks
     WHERE day >= ? AND day <= ? AND item_id IN (${items.map(() => '?').join(',')})`,
    [fromDay, toDay, ...items.map((i) => i.id)],
  );
  return rows.map((r) => ({ itemId: r.item_id, day: r.day }));
}

/** Giorno del programma (1 = primo giorno). */
export function programDay(p: Pick<Program, 'startDay'>, today: string): number {
  const a = new Date(`${p.startDay}T12:00:00`).getTime();
  const b = new Date(`${today}T12:00:00`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

// ── Check-in quotidiani del coach ────────────────────────────────────────────

export async function getCheckin(
  db: Db,
  id: string,
): Promise<{ conversationId: string | null; summary: string | null } | null> {
  const row = await db.getFirstAsync<{ conversation_id: string | null; summary: string | null }>(
    'SELECT conversation_id, summary FROM daily_checkins WHERE id = ?',
    [id],
  );
  return row ? { conversationId: row.conversation_id, summary: row.summary } : null;
}

export async function saveCheckin(
  db: Db,
  id: string,
  conversationId: string | null,
  summary: string | null,
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO daily_checkins (id, conversation_id, summary, created_at) VALUES (?, ?, ?, ?)',
    [id, conversationId, summary, Date.now()],
  );
}
