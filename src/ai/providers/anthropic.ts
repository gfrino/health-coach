import Anthropic from '@anthropic-ai/sdk';

import { AIError, classifyHttpError, toAIError } from '../errors';
import { getFetch } from '../http';
import type {
  AIProvider,
  ChatMessage,
  CoachContext,
  ModelInfo,
  SendOptions,
  SendResult,
  StopReason,
} from '../types';

type ContentBlock = Anthropic.Beta.BetaContentBlock;
type ContentBlockParam = Anthropic.Beta.BetaContentBlockParam;
type MessageParam = Anthropic.Beta.BetaMessageParam;

/** Modello consigliato di default (vedi elenco modelli nella documentazione Anthropic). */
export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5-5';

/** Modelli che accettano il fallback server-side in caso di rifiuto (`fallbacks: "default"`). */
const FALLBACK_MODELS = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

function client(apiKey: string) {
  return new Anthropic({
    apiKey,
    // BYOK: la chiave è dell'utente e resta sul suo dispositivo; nessun server intermedio.
    dangerouslyAllowBrowser: true,
    fetch: getFetch() as unknown as typeof fetch,
    maxRetries: 1,
  });
}

/**
 * Dopo un fallback a metà risposta vanno omessi thinking/tool_use (e blocchi sconosciuti)
 * che precedono l'ultimo blocco `fallback`; il resto si rimanda invariato.
 */
export function contentForEcho(content: readonly ContentBlock[]): ContentBlockParam[] {
  const lastFallback = content.map((b) => b.type as string).lastIndexOf('fallback');
  const keepBeforeBoundary = new Set(['text']);
  return content
    .filter((b, i) => {
      if ((b.type as string) === 'fallback') return false;
      if (i < lastFallback) return keepBeforeBoundary.has(b.type);
      return true;
    })
    .map((b) => b as unknown as ContentBlockParam);
}

export function toAnthropicMessages(messages: ChatMessage[], model: string): MessageParam[] {
  const out: MessageParam[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      const content: ContentBlockParam[] = [
        ...(m.images ?? []).map((img): ContentBlockParam => ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: img.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: img.base64,
          },
        })),
        ...(m.documents ?? []).map((doc): ContentBlockParam => ({
          type: 'document',
          title: doc.name,
          source: { type: 'base64', media_type: 'application/pdf', data: doc.base64 },
        })),
        { type: 'text', text: m.content },
      ];
      out.push({ role: 'user', content });
    } else if (m.role === 'assistant') {
      if (m.raw?.provider === 'anthropic' && m.raw.model === model) {
        out.push({ role: 'assistant', content: contentForEcho(m.raw.data as ContentBlock[]) });
      } else {
        const content: ContentBlockParam[] = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls ?? []) {
          content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
        }
        out.push({ role: 'assistant', content });
      }
    } else {
      // Tutti i tool_result consecutivi vanno in un unico messaggio user.
      const block: ContentBlockParam = {
        type: 'tool_result',
        tool_use_id: m.toolCallId,
        content: m.content,
        is_error: m.isError || undefined,
      };
      const prev = out.at(-1);
      const prevContent = prev?.content;
      if (
        prev?.role === 'user' &&
        Array.isArray(prevContent) &&
        prevContent.every((b) => b.type === 'tool_result')
      ) {
        prevContent.push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
    }
  }
  return out;
}

function mapStop(reason: string | null | undefined): StopReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'end';
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'max_tokens';
    case 'refusal':
      return 'refusal';
    default:
      return 'other';
  }
}

export function mapAnthropicError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new AIError('aborted');
  if (e instanceof Anthropic.APIConnectionError) return new AIError('network', e.message);
  if (e instanceof Anthropic.APIError && typeof e.status === 'number') {
    return classifyHttpError(e.status, JSON.stringify(e.error ?? e.message));
  }
  return toAIError(e);
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',

  async sendMessage(
    context: CoachContext,
    messages: ChatMessage[],
    options: SendOptions,
  ): Promise<SendResult> {
    const { apiKey, model, signal, onToken } = options;
    const useFallback = FALLBACK_MODELS.has(model);
    try {
      const stream = client(apiKey).beta.messages.stream(
        {
          model,
          max_tokens: options.maxOutputTokens ?? 16000,
          system: [{ type: 'text', text: context.system, cache_control: { type: 'ephemeral' } }],
          messages: toAnthropicMessages(messages, model),
          tools: context.tools?.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
          })),
          ...(useFallback ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
        },
        { signal },
      );

      stream.on('text', (delta) => onToken?.(delta));
      const msg = await stream.finalMessage();

      const text = msg.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const toolCalls = msg.content
        .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
        .map((b) => ({
          id: b.id,
          name: b.name,
          arguments: (b.input ?? {}) as Record<string, unknown>,
        }));

      return {
        text,
        toolCalls,
        stopReason: mapStop(msg.stop_reason),
        usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
        raw: { provider: 'anthropic', model, data: msg.content },
      };
    } catch (e) {
      throw mapAnthropicError(e);
    }
  },

  async testConnection(apiKey, model) {
    try {
      // Richiesta minima: verifica chiave, modello e credito disponibile.
      await client(apiKey).messages.create({
        model,
        max_tokens: 64,
        messages: [{ role: 'user', content: 'ping' }],
      });
    } catch (e) {
      throw mapAnthropicError(e);
    }
  },

  async listModels(apiKey): Promise<ModelInfo[]> {
    try {
      const models: ModelInfo[] = [];
      for await (const m of client(apiKey).models.list({ limit: 100 })) {
        models.push({ id: m.id, displayName: m.display_name });
      }
      return models;
    } catch (e) {
      throw mapAnthropicError(e);
    }
  },

  pickDefaultModel(models) {
    if (models.some((m) => m.id === ANTHROPIC_DEFAULT_MODEL)) return ANTHROPIC_DEFAULT_MODEL;
    return models[0]?.id ?? null;
  },

  supportsVision: () => true,
  supportsTools: () => true,
};
