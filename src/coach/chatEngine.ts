import { AIError, toAIError } from '@/ai/errors';
import { getApiKey } from '@/ai/keyStore';
import { getProvider, PROVIDERS } from '@/ai/registry';
import type { ChatMessage, SendResult, Usage } from '@/ai/types';
import type { AppSettings } from '@/config/settingsSchema';
import {
  conversationRepository,
  getDb,
  healthQueries,
  labReportRepository,
  profileRepository,
  type Db,
} from '@/db';
import type { MessageAttachment, StoredMessage } from '@/db/repositories/conversationRepository';
import { loadAttachmentContent } from '@/records/attachmentContent';
import { fileTypeOf } from '@/records/fileMeta';
import { resolveLanguage, deviceLanguageCodes } from '@/i18n';
import { DAY_MS } from '@/lib/dates';

import { composeSystemPrompt, recentHistory } from './context';
import { buildHealthSnapshot } from './snapshot';
import { COACH_TOOLS, executeTool } from './tools';

const MAX_TOOL_ROUNDS = 5;
/**
 * Rete di sicurezza: la sincronizzazione avviene già all'apertura dell'app. Prima di rispondere
 * si aggiorna solo se l'ultima sync è vecchia (app aperta a lungo), senza far aspettare.
 */
const FRESH_DATA_MAX_WAIT_MS = 3000;
const FRESH_DATA_MIN_INTERVAL_MS = 10 * 60 * 1000;

/** Sincronizza Apple Salute / Health Connect se l'ultima sync ha più di 10 minuti. */
async function refreshHealthData(): Promise<void> {
  try {
    // Import pigro: il motore della chat resta indipendente dai moduli nativi di salute.
    const { syncHealthData } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/sources/syncService') as typeof import('@/sources/syncService');
    await Promise.race([
      syncHealthData({ minIntervalMs: FRESH_DATA_MIN_INTERVAL_MS }),
      new Promise((resolve) => setTimeout(resolve, FRESH_DATA_MAX_WAIT_MS)),
    ]);
  } catch {
    // Dati non aggiornati: si risponde con quelli già presenti.
  }
}

export interface TurnCallbacks {
  /** Testo completo dell'assistente finora (già concatenato). */
  onText?: (text: string) => void;
  /** Il modello sta consultando i dati locali. */
  onToolUse?: (toolName: string) => void;
  signal?: AbortSignal;
}

export interface TurnResult {
  assistantMessageId: string;
  text: string;
  usage: Usage;
}

export async function buildSystemPrompt(db: Db, settings: AppSettings, now: Date): Promise<string> {
  const [profile, memoryFacts, summaries, snapshot, journal, reports] = await Promise.all([
    profileRepository.loadProfileContext(db),
    healthQueries.recentMemoryFacts(db),
    healthQueries.recentSummaries(db),
    buildHealthSnapshot(db, now),
    healthQueries.journalRange(db, now.getTime() - 7 * DAY_MS, now.getTime() + 1, 7),
    labReportRepository.listReports(db),
  ]);
  const records = reports.map((r) => ({
    id: r.id,
    title: r.title,
    date: r.reportDate,
    kind: fileTypeOf(r.mimeType)?.kind ?? 'document',
  }));
  return composeSystemPrompt({
    coach: settings.coach,
    language: resolveLanguage(settings.language, deviceLanguageCodes()),
    profile,
    memoryFacts,
    summaries,
    metrics: snapshot.metrics,
    anomalies: snapshot.anomalies,
    insights: snapshot.insights,
    journal,
    records,
    now,
    compact: settings.ai.provider === 'device',
  });
}

export async function resolveAI(settings: AppSettings) {
  const { provider: providerId, model } = settings.ai;
  if (!providerId || !model) throw new AIError('invalid_key', 'Provider AI non configurato');
  const apiKey = PROVIDERS[providerId].requiresKey ? await getApiKey(providerId) : '';
  if (apiKey === null || (PROVIDERS[providerId].requiresKey && !apiKey)) {
    throw new AIError('invalid_key', 'Chiave API mancante');
  }
  return { providerId, model, apiKey, provider: getProvider(providerId) };
}

/**
 * Esegue una richiesta al modello con il ciclo di tool call locale.
 * `onText` riceve il testo cumulativo (anche attraverso più round di tool).
 */
async function runWithTools(
  db: Db,
  settings: AppSettings,
  system: string,
  history: ChatMessage[],
  cb: TurnCallbacks,
): Promise<{ text: string; usage: Usage }> {
  const { provider, model, apiKey } = await resolveAI(settings);
  const tools = provider.supportsTools(model) ? COACH_TOOLS : undefined;
  const messages = [...history];
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let text = '';

  for (let round = 0; ; round++) {
    const prefix = text ? `${text}\n\n` : '';
    let roundText = '';
    const result: SendResult = await provider.sendMessage({ system, tools }, messages, {
      apiKey,
      model,
      signal: cb.signal,
      onToken: (delta) => {
        roundText += delta;
        cb.onText?.(prefix + roundText);
      },
    });
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    if (result.text) text = prefix + result.text;

    if (result.stopReason === 'refusal' && !result.text) throw new AIError('refused');

    const wantsTools = result.toolCalls.length > 0 && result.stopReason !== 'max_tokens';
    if (!wantsTools || round >= MAX_TOOL_ROUNDS) break;

    messages.push({
      role: 'assistant',
      content: result.text,
      toolCalls: result.toolCalls,
      raw: result.raw,
    });
    const requested: MessageAttachment[] = [];
    for (const call of result.toolCalls) {
      cb.onToolUse?.(call.name);
      const outcome = await executeTool(db, call);
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        toolName: call.name,
        content: outcome.content,
        isError: outcome.isError,
      });
      if (outcome.attachment) requested.push(outcome.attachment);
    }
    // Documenti aperti con read_document: il contenuto (PDF, foto, testo) arriva subito dopo.
    if (requested.length) messages.push(await documentMessage(settings, requested));
  }
  return { text: text.trim(), usage };
}

/** Nota testuale sugli allegati: resta nella cronologia anche nei turni successivi. */
export function attachmentNote(attachments: MessageAttachment[]): string {
  return attachments.length
    ? `[Attached: ${attachments.map((a) => a.title).join(', ')} — saved in the user's health records]`
    : '';
}

/** Messaggio con il contenuto dei documenti della Cartella richiesti dal modello. */
async function documentMessage(
  settings: AppSettings,
  attachments: MessageAttachment[],
): Promise<ChatMessage> {
  const { provider, model } = await resolveAI(settings);
  const content = await loadAttachmentContent(attachments, {
    vision: provider.supportsVision(model),
    pdf: provider.id !== 'device',
  });
  const parts = [
    `Contents of the requested document(s) from the user's health records: ${attachments.map((a) => `"${a.title}"`).join(', ')}.`,
    ...content.texts.map((d) => `--- Document "${d.name}" ---\n${d.text}\n--- End of document ---`),
    content.unreadable.length
      ? `(Could not be read with the current AI model: ${content.unreadable.join(', ')}.)`
      : '',
  ].filter(Boolean);
  return {
    role: 'user',
    content: parts.join('\n\n'),
    images: content.images.length ? content.images : undefined,
    documents: content.documents.length ? content.documents : undefined,
  };
}

/** Cronologia per il provider; l'ultimo messaggio utente porta il contenuto degli allegati. */
async function buildHistory(
  settings: AppSettings,
  stored: StoredMessage[],
): Promise<ChatMessage[]> {
  const complete = stored.filter((m) => m.status === 'complete');
  const withNotes = complete.map((m) => ({
    role: m.role,
    content: [m.content, attachmentNote(m.attachments)].filter(Boolean).join('\n\n'),
  }));
  const history = recentHistory(withNotes);
  const lastStored = [...complete].reverse().find((m) => m.role === 'user');
  const lastIdx = history.map((m) => m.role).lastIndexOf('user');
  const last = history[lastIdx];
  if (!lastStored?.attachments.length || !last || last.role !== 'user') return history;

  const { provider, model } = await resolveAI(settings);
  const content = await loadAttachmentContent(lastStored.attachments, {
    vision: provider.supportsVision(model),
    pdf: provider.id !== 'device',
  });
  const extra = [
    ...content.texts.map((d) => `--- Document "${d.name}" ---\n${d.text}\n--- End of document ---`),
    content.unreadable.length
      ? `(You cannot read these attachments with the current AI model: ${content.unreadable.join(', ')}. Tell the user they are saved in their health records and that a cloud AI model in Settings can read them.)`
      : '',
  ].filter(Boolean);
  history[lastIdx] = {
    role: 'user',
    content: [last.content, ...extra].join('\n\n'),
    images: content.images.length ? content.images : undefined,
    documents: content.documents.length ? content.documents : undefined,
  };
  return history;
}

/**
 * Un turno di chat: salva il messaggio utente (se nuovo), crea il messaggio dell'assistente
 * in stato "streaming", lo aggiorna alla fine (o in errore, con codice per l'UI e "Riprova").
 */
export async function runCoachTurn(
  settings: AppSettings,
  conversationId: string,
  userText: string | null,
  cb: TurnCallbacks = {},
  attachments: MessageAttachment[] = [],
): Promise<TurnResult> {
  const db = await getDb();

  if (userText !== null) {
    await conversationRepository.addMessage(db, {
      conversationId,
      role: 'user',
      content: userText.trim(),
      attachments,
    });
    const conv = await conversationRepository.getConversation(db, conversationId);
    const title = userText.trim() || attachments[0]?.title;
    if (conv && !conv.title && title) {
      await conversationRepository.setConversationMeta(db, conversationId, {
        title: title.slice(0, 60),
      });
    }
  }

  const stored = await conversationRepository.listMessages(db, conversationId);
  const assistant = await conversationRepository.addMessage(db, {
    conversationId,
    role: 'assistant',
    content: '',
    status: 'streaming',
  });

  try {
    await refreshHealthData();
    const system = await buildSystemPrompt(db, settings, new Date());
    const history = await buildHistory(settings, stored);
    const { text, usage } = await runWithTools(db, settings, system, history, cb);
    await conversationRepository.finishMessage(db, assistant.id, {
      content: text,
      status: 'complete',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
    await conversationRepository.setConversationMeta(db, conversationId, {
      provider: settings.ai.provider ?? undefined,
      model: settings.ai.model ?? undefined,
    });
    return { assistantMessageId: assistant.id, text, usage };
  } catch (e) {
    const err = toAIError(e);
    // Solo codice, stato HTTP e messaggio del provider: mai chiavi né contenuti della chat.
    console.warn(
      `[coach] ${settings.ai.provider}/${settings.ai.model} → ${err.code}${err.status ? ` (HTTP ${err.status})` : ''}: ${err.message.slice(0, 300)}`,
    );
    await conversationRepository.finishMessage(db, assistant.id, {
      content: '',
      status: 'error',
      errorCode: err.code,
    });
    throw err;
  }
}

/** "Riprova": elimina la risposta fallita e rigenera a partire dall'ultimo messaggio utente. */
export async function retryLastTurn(
  settings: AppSettings,
  conversationId: string,
  cb: TurnCallbacks = {},
): Promise<TurnResult> {
  const db = await getDb();
  const messages = await conversationRepository.listMessages(db, conversationId);
  const last = messages.at(-1);
  if (last?.role === 'assistant' && last.status !== 'complete') {
    await conversationRepository.deleteMessage(db, last.id);
  }
  return runCoachTurn(settings, conversationId, null, cb);
}

const WELCOME_INSTRUCTION = `The user has just finished setting up the app. Write a short, personalised welcome message (max 120 words): introduce yourself by name, mention concretely what you already know about them from their profile and data (if anything), and suggest 2–3 ways you can help them reach their goals. End with one simple question.`;

/** Messaggio di benvenuto a fine onboarding: l'istruzione non viene salvata, solo la risposta. */
export async function generateWelcome(
  settings: AppSettings,
  cb: TurnCallbacks = {},
): Promise<string> {
  const db = await getDb();
  const conversationId = await conversationRepository.createConversation(db, {
    kind: 'welcome',
    provider: settings.ai.provider,
    model: settings.ai.model,
  });
  const assistant = await conversationRepository.addMessage(db, {
    conversationId,
    role: 'assistant',
    content: '',
    status: 'streaming',
  });
  try {
    const system = await buildSystemPrompt(db, settings, new Date());
    const { text, usage } = await runWithTools(
      db,
      settings,
      system,
      [{ role: 'user', content: WELCOME_INSTRUCTION }],
      cb,
    );
    await conversationRepository.finishMessage(db, assistant.id, {
      content: text,
      status: 'complete',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
  } catch (e) {
    // Il benvenuto è facoltativo: in caso di errore la conversazione resta vuota e si può scrivere subito.
    await conversationRepository.deleteMessage(db, assistant.id);
    throw toAIError(e);
  }
  return conversationId;
}
