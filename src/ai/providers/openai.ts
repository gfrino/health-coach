import { AIError } from '../errors';
import { request } from '../http';
import { readSSE } from '../sse';
import { parseToolArguments } from '../toolArgs';
import type {
  AIProvider,
  ChatMessage,
  CoachContext,
  ModelInfo,
  SendOptions,
  SendResult,
  StopReason,
} from '../types';

const BASE = 'https://api.openai.com/v1';

type OAIMessage =
  | { role: 'system'; content: string }
  | {
      role: 'user';
      content:
        | string
        | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
    }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

interface OAIChunk {
  choices?: {
    delta?: {
      content?: string | null;
      refusal?: string | null;
      tool_calls?: {
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  error?: { message?: string };
}

const headers = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

export function toOpenAIMessages(system: string, messages: ChatMessage[]): OAIMessage[] {
  const out: OAIMessage[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') {
      if (m.images?.length) {
        out.push({
          role: 'user',
          content: [
            ...m.images.map((img) => ({
              type: 'image_url' as const,
              image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
            })),
            { type: 'text' as const, text: m.content },
          ],
        });
      } else {
        out.push({ role: 'user', content: m.content });
      }
    } else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls?.length
          ? m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            }))
          : undefined,
      });
    } else {
      out.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
    }
  }
  return out;
}

function mapFinish(reason: string | null | undefined): StopReason {
  switch (reason) {
    case 'stop':
      return 'end';
    case 'tool_calls':
    case 'function_call':
      return 'tool_use';
    case 'length':
      return 'max_tokens';
    case 'content_filter':
      return 'refusal';
    default:
      return 'other';
  }
}

/** Accumula i chunk dello stream in un risultato completo (esportata per i test). */
export async function collectOpenAIStream(
  events: AsyncIterable<{ data: string }>,
  onToken?: (delta: string) => void,
): Promise<Omit<SendResult, 'raw'>> {
  let text = '';
  let finish: string | null | undefined;
  const usage = { inputTokens: 0, outputTokens: 0 };
  const calls = new Map<number, { id: string; name: string; args: string }>();

  for await (const ev of events) {
    if (ev.data === '[DONE]') break;
    let chunk: OAIChunk;
    try {
      chunk = JSON.parse(ev.data) as OAIChunk;
    } catch {
      continue;
    }
    if (chunk.error) throw new AIError('server', chunk.error.message);
    const choice = chunk.choices?.[0];
    const delta = choice?.delta;
    if (delta?.content) {
      text += delta.content;
      onToken?.(delta.content);
    }
    for (const tc of delta?.tool_calls ?? []) {
      const cur = calls.get(tc.index) ?? { id: '', name: '', args: '' };
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.name += tc.function.name;
      if (tc.function?.arguments) cur.args += tc.function.arguments;
      calls.set(tc.index, cur);
    }
    if (choice?.finish_reason) finish = choice.finish_reason;
    if (chunk.usage) {
      usage.inputTokens = chunk.usage.prompt_tokens ?? 0;
      usage.outputTokens = chunk.usage.completion_tokens ?? 0;
    }
  }

  const toolCalls = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([i, c]) => ({
      id: c.id || `call_${i}`,
      name: c.name,
      arguments: parseToolArguments(c.args),
    }));
  return { text, toolCalls, usage, stopReason: mapFinish(finish) };
}

const EXCLUDED =
  /(mini|nano|audio|realtime|search|transcribe|tts|image|codex|oss|instruct|embedding|moderation|dall-e|whisper|davinci|babbage)/i;

function versionOf(id: string): number {
  const m = /^gpt-(\d+(?:\.\d+)?)/.exec(id);
  return m?.[1] ? parseFloat(m[1]) : 0;
}

export const openaiProvider: AIProvider = {
  id: 'openai',

  async sendMessage(
    context: CoachContext,
    messages: ChatMessage[],
    options: SendOptions,
  ): Promise<SendResult> {
    const res = await request(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: headers(options.apiKey),
      signal: options.signal,
      body: JSON.stringify({
        model: options.model,
        messages: toOpenAIMessages(context.system, messages),
        stream: true,
        stream_options: { include_usage: true },
        max_completion_tokens: options.maxOutputTokens ?? 16000,
        tools: context.tools?.length
          ? context.tools.map((t) => ({
              type: 'function',
              function: { name: t.name, description: t.description, parameters: t.parameters },
            }))
          : undefined,
      }),
    });
    if (!res.body) throw new AIError('network', 'Risposta senza body');
    const result = await collectOpenAIStream(readSSE(res.body), options.onToken);
    return result;
  },

  async testConnection(apiKey, model) {
    await request(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_completion_tokens: 32,
      }),
    });
  },

  async listModels(apiKey): Promise<ModelInfo[]> {
    const res = await request(`${BASE}/models`, { method: 'GET', headers: headers(apiKey) });
    const json = (await res.json()) as { data?: { id: string; created?: number }[] };
    return (json.data ?? [])
      .filter(
        (m) =>
          /^(gpt-|o\d|chatgpt-)/.test(m.id) &&
          !/(audio|realtime|transcribe|tts|image|embedding|moderation|search)/i.test(m.id),
      )
      .sort((a, b) => versionOf(b.id) - versionOf(a.id) || (b.created ?? 0) - (a.created ?? 0))
      .map((m) => ({ id: m.id, displayName: m.id }));
  },

  pickDefaultModel(models) {
    // Modello di punta più recente (non mini/nano), preferendo l'alias senza data.
    const flagship = models
      .filter((m) => /^gpt-\d/.test(m.id) && !EXCLUDED.test(m.id))
      .sort((a, b) => versionOf(b.id) - versionOf(a.id) || a.id.length - b.id.length);
    return flagship[0]?.id ?? models[0]?.id ?? null;
  },

  supportsVision: (model) => !/(o1-mini|o3-mini|gpt-3\.5)/.test(model),
  supportsTools: (model) => !/o1-mini/.test(model),
};
