import { AIError } from '../errors';
import { request } from '../http';
import { readSSE } from '../sse';
import type {
  AIProvider,
  ChatMessage,
  CoachContext,
  ModelInfo,
  SendOptions,
  SendResult,
  StopReason,
  ToolDefinition,
} from '../types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name: string; response: Record<string, unknown> };
}
interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}
interface GeminiChunk {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

const headers = (apiKey: string) => ({
  'x-goog-api-key': apiKey,
  'Content-Type': 'application/json',
});
const modelPath = (model: string) => (model.startsWith('models/') ? model : `models/${model}`);

/** Gemini accetta un sottoinsieme di OpenAPI: rimuove le chiavi non supportate. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema)) {
      if (k === 'additionalProperties' || k === '$schema') continue;
      out[k] = toGeminiSchema(v);
    }
    return out;
  }
  return schema;
}

export function toGeminiTools(tools: ToolDefinition[] | undefined) {
  if (!tools?.length) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: toGeminiSchema(t.parameters),
      })),
    },
  ];
}

export function toGeminiContents(messages: ChatMessage[], model: string): GeminiContent[] {
  const out: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({
        role: 'user',
        parts: [
          ...(m.images ?? []).map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.base64 },
          })),
          { text: m.content },
        ],
      });
    } else if (m.role === 'assistant') {
      if (m.raw?.provider === 'gemini' && m.raw.model === model) {
        // Rinvio delle parti originali: le thoughtSignature sono obbligatorie nelle chiamate a funzione.
        out.push({ role: 'model', parts: m.raw.data as GeminiPart[] });
      } else {
        const parts: GeminiPart[] = [];
        if (m.content) parts.push({ text: m.content });
        for (const tc of m.toolCalls ?? [])
          parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
        out.push({ role: 'model', parts });
      }
    } else {
      const part: GeminiPart = {
        functionResponse: {
          id: m.toolCallId.startsWith('gemini-') ? undefined : m.toolCallId,
          name: m.toolName,
          response: m.isError ? { error: m.content } : { result: m.content },
        },
      };
      const prev = out.at(-1);
      if (prev?.role === 'user' && prev.parts.every((p) => p.functionResponse))
        prev.parts.push(part);
      else out.push({ role: 'user', parts: [part] });
    }
  }
  return out;
}

function mapFinish(reason: string | undefined, hasCalls: boolean): StopReason {
  if (hasCalls) return 'tool_use';
  switch (reason) {
    case 'STOP':
      return 'end';
    case 'MAX_TOKENS':
      return 'max_tokens';
    case 'SAFETY':
    case 'RECITATION':
    case 'PROHIBITED_CONTENT':
    case 'BLOCKLIST':
    case 'SPII':
      return 'refusal';
    default:
      return 'other';
  }
}

export async function collectGeminiStream(
  events: AsyncIterable<{ data: string }>,
  model: string,
  onToken?: (delta: string) => void,
): Promise<SendResult> {
  let text = '';
  let finish: string | undefined;
  let blocked = false;
  const parts: GeminiPart[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };

  for await (const ev of events) {
    let chunk: GeminiChunk;
    try {
      chunk = JSON.parse(ev.data) as GeminiChunk;
    } catch {
      continue;
    }
    if (chunk.error) throw new AIError('server', chunk.error.message);
    if (chunk.promptFeedback?.blockReason) blocked = true;
    const cand = chunk.candidates?.[0];
    for (const p of cand?.content?.parts ?? []) {
      parts.push(p);
      if (p.text && !p.thought) {
        text += p.text;
        onToken?.(p.text);
      }
    }
    if (cand?.finishReason) finish = cand.finishReason;
    if (chunk.usageMetadata) {
      usage.inputTokens = chunk.usageMetadata.promptTokenCount ?? 0;
      usage.outputTokens =
        (chunk.usageMetadata.candidatesTokenCount ?? 0) +
        (chunk.usageMetadata.thoughtsTokenCount ?? 0);
    }
  }

  const toolCalls = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({
      id: p.functionCall?.id ?? `gemini-${i}`,
      name: p.functionCall?.name ?? '',
      arguments: p.functionCall?.args ?? {},
    }));

  return {
    text,
    toolCalls,
    usage,
    stopReason: blocked ? 'refusal' : mapFinish(finish, toolCalls.length > 0),
    raw: { provider: 'gemini', model, data: parts },
  };
}

function versionOf(id: string): number {
  const m = /gemini-(\d+(?:\.\d+)?)/.exec(id);
  return m?.[1] ? parseFloat(m[1]) : 0;
}

export const geminiProvider: AIProvider = {
  id: 'gemini',

  async sendMessage(
    context: CoachContext,
    messages: ChatMessage[],
    options: SendOptions,
  ): Promise<SendResult> {
    const res = await request(`${BASE}/${modelPath(options.model)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: headers(options.apiKey),
      signal: options.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: context.system }] },
        contents: toGeminiContents(messages, options.model),
        tools: toGeminiTools(context.tools),
        generationConfig: { maxOutputTokens: options.maxOutputTokens ?? 16000 },
      }),
    });
    if (!res.body) throw new AIError('network', 'Risposta senza body');
    return collectGeminiStream(readSSE(res.body), options.model, options.onToken);
  },

  async testConnection(apiKey, model) {
    await request(`${BASE}/${modelPath(model)}:generateContent`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 32 },
      }),
    });
  },

  async listModels(apiKey): Promise<ModelInfo[]> {
    const res = await request(`${BASE}/models?pageSize=1000`, {
      method: 'GET',
      headers: headers(apiKey),
    });
    const json = (await res.json()) as {
      models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
    };
    return (json.models ?? [])
      .filter(
        (m) =>
          m.supportedGenerationMethods?.includes('generateContent') &&
          /gemini/.test(m.name) &&
          !/(embedding|tts|image|aqa|live|audio|robotics|computer-use)/i.test(m.name),
      )
      .map((m) => ({ id: m.name.replace(/^models\//, ''), displayName: m.displayName ?? m.name }))
      .sort((a, b) => versionOf(b.id) - versionOf(a.id));
  },

  pickDefaultModel(models) {
    const stable = (id: string) => !/(preview|exp|latest)/.test(id);
    const score = (id: string) =>
      versionOf(id) * 10 +
      (/pro/.test(id) ? 2 : /flash(?!-lite)/.test(id) ? 1 : 0) +
      (stable(id) ? 0.5 : 0);
    const sorted = [...models].sort((a, b) => score(b.id) - score(a.id));
    return sorted[0]?.id ?? null;
  },

  supportsVision: () => true,
  supportsTools: () => true,
};
