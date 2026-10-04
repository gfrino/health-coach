import { newId } from '../ids';
import type { Db } from '../types';

/**
 * Memoria del coach: fatti duraturi sull'utente (abitudini, preferenze, cosa funziona) e
 * riassunti delle conversazioni concluse. Solo sul telefono, nel DB cifrato; l'utente può
 * vederli e cancellarli in Opzioni.
 */

export interface MemoryFact {
  id: string;
  text: string;
  sourceConversationId: string | null;
  updatedAt: number;
}

/** Oltre questo numero si tengono i più recenti: il contesto del coach resta compatto. */
export const MAX_FACTS = 60;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

export async function listFacts(db: Db, limit = MAX_FACTS): Promise<MemoryFact[]> {
  const rows = await db.getAllAsync<{
    id: string;
    text: string;
    source_conversation_id: string | null;
    updated_at: number;
  }>(
    'SELECT id, text, source_conversation_id, updated_at FROM memory_facts ORDER BY pinned DESC, updated_at DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    sourceConversationId: r.source_conversation_id,
    updatedAt: r.updated_at,
  }));
}

/** Aggiunge un fatto (se non c'è già uno uguale) e restituisce il suo id. */
export async function addFact(
  db: Db,
  text: string,
  sourceConversationId: string | null = null,
): Promise<string | null> {
  const clean = text.trim().slice(0, 300);
  if (!clean) return null;
  const all = await db.getAllAsync<{ id: string; text: string }>(
    'SELECT id, text FROM memory_facts',
    [],
  );
  const same = all.find((f) => norm(f.text) === norm(clean));
  const now = Date.now();
  if (same) {
    await db.runAsync('UPDATE memory_facts SET updated_at = ? WHERE id = ?', [now, same.id]);
    return same.id;
  }
  const id = newId();
  await db.runAsync(
    `INSERT INTO memory_facts (id, text, source_conversation_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, clean, sourceConversationId, now, now],
  );
  // I più vecchi oltre il limite si eliminano.
  await db.runAsync(
    `DELETE FROM memory_facts WHERE pinned = 0 AND id NOT IN (
       SELECT id FROM memory_facts ORDER BY pinned DESC, updated_at DESC LIMIT ?)`,
    [MAX_FACTS],
  );
  return id;
}

export async function updateFact(db: Db, id: string, text: string): Promise<boolean> {
  const clean = text.trim().slice(0, 300);
  if (!clean) return false;
  const res = await db.runAsync('UPDATE memory_facts SET text = ?, updated_at = ? WHERE id = ?', [
    clean,
    Date.now(),
    id,
  ]);
  return res.changes > 0;
}

export async function deleteFact(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM memory_facts WHERE id = ?', [id]);
}

export async function clearMemory(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM memory_facts', []);
    await db.runAsync('DELETE FROM conversation_summaries', []);
  });
}

// ── Riassunti delle conversazioni ────────────────────────────────────────────

export async function saveSummary(
  db: Db,
  conversationId: string,
  summary: string,
  upToMessageId: string | null,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM conversation_summaries WHERE conversation_id = ?', [
      conversationId,
    ]);
    await db.runAsync(
      `INSERT INTO conversation_summaries (id, conversation_id, summary, up_to_message_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [newId(), conversationId, summary.trim().slice(0, 800), upToMessageId, Date.now()],
    );
  });
}

export async function countSummaries(db: Db): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM conversation_summaries',
    [],
  );
  return r?.n ?? 0;
}

/**
 * Conversazioni da riassumere: almeno un messaggio dell'utente, ferme da `idleMs`, senza
 * riassunto o con messaggi nuovi dopo l'ultimo riassunto.
 */
export async function conversationsToSummarize(
  db: Db,
  idleMs: number,
  limit = 3,
): Promise<{ id: string; lastMessageId: string }[]> {
  const rows = await db.getAllAsync<{ id: string; last_id: string | null }>(
    `SELECT c.id,
       (SELECT m.id FROM messages m WHERE m.conversation_id = c.id AND m.status = 'complete'
        ORDER BY m.created_at DESC LIMIT 1) AS last_id
     FROM conversations c
     WHERE c.updated_at < ?
       AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user')
       AND NOT EXISTS (
         SELECT 1 FROM conversation_summaries s WHERE s.conversation_id = c.id
           AND s.up_to_message_id = (SELECT m.id FROM messages m WHERE m.conversation_id = c.id
             AND m.status = 'complete' ORDER BY m.created_at DESC LIMIT 1))
     ORDER BY c.updated_at DESC LIMIT ?`,
    [Date.now() - idleMs, limit],
  );
  return rows.filter((r) => r.last_id).map((r) => ({ id: r.id, lastMessageId: r.last_id! }));
}
