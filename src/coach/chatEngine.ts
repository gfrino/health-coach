import { AIError, toAIError } from '@/ai/errors';
import { getApiKey } from '@/ai/keyStore';
import { getProvider, PROVIDERS } from '@/ai/registry';
import type { ChatMessage, SendResult, Usage } from '@/ai/types';
import type { AppSettings } from '@/config/settingsSchema';
import { conversationRepository, getDb, healthQueries, profileRepository, type Db } from '@/db';
import { resolveLanguage, deviceLanguageCodes } from '@/i18n';
import { DAY_MS } from '@/lib/dates';

import { composeSystemPrompt, recentHistory } from './context';
import { buildMetricsSnapshot } from './snapshot';
import { COACH_TOOLS, executeTool } from './tools';

const MAX_TOOL_ROUNDS = 5;

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

async function buildSystemPrompt(db: Db, settings: AppSettings, now: Date): Promise<string> {
  const [profile, memoryFacts, summaries, metrics, journal] = await Promise.all([
    profileRepository.loadProfileContext(db),
    healthQueries.recentMemoryFacts(db),
    healthQueries.recentSummaries(db),
    buildMetricsSnapshot(db, now),
    healthQueries.journalRange(db, now.getTime() - 7 * DAY_MS, now.getTime() + 1, 7),
  ]);
  return composeSystemPrompt({
    coach: settings.coach,
    language: resolveLanguage(settings.language, deviceLanguageCodes()),
    profile,
    memoryFacts,
    summaries,
    metrics,
    journal,
    now,
    compact: settings.ai.provider === 'device',
  });
}

async function resolveAI(settings: AppSettings) {
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
    }
  }
  return { text: text.trim(), usage };
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
): Promise<TurnResult> {
  const db = await getDb();
  const now = new Date();

  if (userText) {
    await conversationRepository.addMessage(db, {
      conversationId,
      role: 'user',
      content: userText.trim(),
    });
    const conv = await conversationRepository.getConversation(db, conversationId);
    if (conv && !conv.title) {
      await conversationRepository.setConversationMeta(db, conversationId, {
        title: userText.trim().slice(0, 60),
      });
    }
  }

  const stored = await conversationRepository.listMessages(db, conversationId);
  const history = recentHistory(stored.filter((m) => m.status === 'complete'));
  const assistant = await conversationRepository.addMessage(db, {
    conversationId,
    role: 'assistant',
    content: '',
    status: 'streaming',
  });

  try {
    const system = await buildSystemPrompt(db, settings, now);
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
