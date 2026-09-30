import { newId } from '../ids';
import type { Db } from '../types';

export interface Conversation {
  id: string;
  title: string | null;
  kind: 'chat' | 'welcome';
  provider: string | null;
  model: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessage: string | null;
}

export type MessageStatus = 'complete' | 'streaming' | 'error';

/** File allegato a un messaggio: vive nella Cartella salute (lab_reports). */
export interface MessageAttachment {
  reportId: string;
  title: string;
  mimeType: string;
}

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: MessageAttachment[];
  status: MessageStatus;
  errorCode: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: number;
}

interface ConversationRow {
  id: string;
  title: string | null;
  kind: string;
  provider: string | null;
  model: string | null;
  created_at: number;
  updated_at: number;
  last_message: string | null;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: string | null;
  status: MessageStatus;
  error_code: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: number;
}

const toConversation = (r: ConversationRow): Conversation => ({
  id: r.id,
  title: r.title,
  kind: r.kind === 'welcome' ? 'welcome' : 'chat',
  provider: r.provider,
  model: r.model,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  lastMessage: r.last_message,
});

function parseAttachments(v: string | null): MessageAttachment[] {
  try {
    const a: unknown = v ? JSON.parse(v) : [];
    return Array.isArray(a) ? (a as MessageAttachment[]) : [];
  } catch {
    return [];
  }
}

const toMessage = (r: MessageRow): StoredMessage => ({
  id: r.id,
  conversationId: r.conversation_id,
  role: r.role,
  content: r.content,
  attachments: parseAttachments(r.attachments),
  status: r.status,
  errorCode: r.error_code,
  inputTokens: r.input_tokens,
  outputTokens: r.output_tokens,
  createdAt: r.created_at,
});

export async function createConversation(
  db: Db,
  opts: {
    kind?: 'chat' | 'welcome';
    title?: string | null;
    provider?: string | null;
    model?: string | null;
  } = {},
): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO conversations (id, title, kind, provider, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      opts.title ?? null,
      opts.kind ?? 'chat',
      opts.provider ?? null,
      opts.model ?? null,
      now,
      now,
    ],
  );
  return id;
}

export async function listConversations(db: Db): Promise<Conversation[]> {
  const rows = await db.getAllAsync<ConversationRow>(
    `SELECT c.*, (
       SELECT m.content FROM messages m
       WHERE m.conversation_id = c.id AND m.role IN ('user', 'assistant') AND m.content <> ''
       ORDER BY m.created_at DESC LIMIT 1
     ) AS last_message
     FROM conversations c WHERE c.archived = 0 ORDER BY c.updated_at DESC`,
    [],
  );
  return rows.map(toConversation);
}

export async function getConversation(db: Db, id: string): Promise<Conversation | null> {
  const row = await db.getFirstAsync<ConversationRow>(
    'SELECT *, NULL AS last_message FROM conversations WHERE id = ?',
    [id],
  );
  return row ? toConversation(row) : null;
}

export async function listMessages(db: Db, conversationId: string): Promise<StoredMessage[]> {
  const rows = await db.getAllAsync<MessageRow>(
    `SELECT id, conversation_id, role, content, attachments, status, error_code, input_tokens, output_tokens, created_at
     FROM messages WHERE conversation_id = ? AND role IN ('user', 'assistant') ORDER BY created_at, rowid`,
    [conversationId],
  );
  return rows.map(toMessage);
}

export async function addMessage(
  db: Db,
  m: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    status?: MessageStatus;
    attachments?: MessageAttachment[];
  },
): Promise<StoredMessage> {
  const id = newId();
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO messages (id, conversation_id, role, content, attachments, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        m.conversationId,
        m.role,
        m.content,
        m.attachments?.length ? JSON.stringify(m.attachments) : null,
        m.status ?? 'complete',
        now,
      ],
    );
    await db.runAsync('UPDATE conversations SET updated_at = ? WHERE id = ?', [
      now,
      m.conversationId,
    ]);
  });
  return {
    id,
    conversationId: m.conversationId,
    role: m.role,
    content: m.content,
    attachments: m.attachments ?? [],
    status: m.status ?? 'complete',
    errorCode: null,
    inputTokens: null,
    outputTokens: null,
    createdAt: now,
  };
}

export async function finishMessage(
  db: Db,
  id: string,
  patch: {
    content: string;
    status: MessageStatus;
    errorCode?: string | null;
    inputTokens?: number;
    outputTokens?: number;
  },
): Promise<void> {
  await db.runAsync(
    'UPDATE messages SET content = ?, status = ?, error_code = ?, input_tokens = ?, output_tokens = ? WHERE id = ?',
    [
      patch.content,
      patch.status,
      patch.errorCode ?? null,
      patch.inputTokens ?? null,
      patch.outputTokens ?? null,
      id,
    ],
  );
}

export async function deleteMessage(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM messages WHERE id = ?', [id]);
}

export async function setConversationMeta(
  db: Db,
  id: string,
  meta: { title?: string; provider?: string; model?: string },
): Promise<void> {
  if (meta.title !== undefined)
    await db.runAsync('UPDATE conversations SET title = ? WHERE id = ?', [meta.title, id]);
  if (meta.provider !== undefined || meta.model !== undefined) {
    await db.runAsync('UPDATE conversations SET provider = ?, model = ? WHERE id = ?', [
      meta.provider ?? null,
      meta.model ?? null,
      id,
    ]);
  }
}

export async function deleteConversation(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM conversations WHERE id = ?', [id]);
}

export interface TokenUsage {
  provider: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  messages: number;
}

/** Consumo di token stimato (dai conteggi restituiti dai provider), per provider e modello. */
export async function tokenUsageSince(db: Db, sinceMs: number): Promise<TokenUsage[]> {
  const rows = await db.getAllAsync<{
    provider: string | null;
    model: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    n: number;
  }>(
    `SELECT c.provider, c.model, SUM(m.input_tokens) AS input_tokens, SUM(m.output_tokens) AS output_tokens, COUNT(*) AS n
     FROM messages m JOIN conversations c ON c.id = m.conversation_id
     WHERE m.role = 'assistant' AND m.created_at >= ? AND m.input_tokens IS NOT NULL
     GROUP BY c.provider, c.model ORDER BY n DESC`,
    [sinceMs],
  );
  return rows.map((r) => ({
    provider: r.provider,
    model: r.model,
    inputTokens: r.input_tokens ?? 0,
    outputTokens: r.output_tokens ?? 0,
    messages: r.n,
  }));
}
