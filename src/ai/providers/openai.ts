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

/**
 * OpenAI tramite la Responses API (/v1/responses): i modelli più recenti non accettano tool
 * con il ragionamento attivo su Chat Completions. `store: false` → OpenAI non conserva le
 * conversazioni; il ragionamento cifrato viene rinviato tra un round di tool e l'altro.
 */

type InputItem = Record<string, unknown>;

interface OutputItem {
  type: string;
  id?: string;
  status?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type: string; text?: string; refusal?: string }[];
  [k: string]: unknown;
}

interface OAIResponse {
  status?: string;
  output?: OutputItem[];
  usage?: { input_tokens?: number; output_tokens?: number };
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string } | null;
}

interface OAIStreamEvent {
  type: string;
  delta?: string;
  item?: OutputItem;
  response?: OAIResponse;
  message?: string;
}

const headers = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
});

/** Modelli con ragionamento (serie o, GPT-5 e successivi). */
export const isReasoningModel = (model: string) => /^(o\d|gpt-([5-9]|\d{2}))/.test(model);

/** Con store:false gli id degli item non esistono lato server: si rinviano senza id/stato. */
function replayable(item: OutputItem): InputItem {
  const { id: _id, status: _status, ...rest } = item;
  return rest;
}

export function toOpenAIInput(messages: ChatMessage[]): InputItem[] {
  const out: InputItem[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({
        role: 'user',
        content: [
          ...(m.images ?? []).map((img) => ({
            type: 'input_image',
            image_url: `data:${img.mimeType};base64,${img.base64}`,
          })),
          ...(m.documents ?? []).map((doc) => ({
            type: 'input_file',
            filename: doc.name,
            file_data: `data:${doc.mimeType};base64,${doc.base64}`,
          })),
          { type: 'input_text', text: m.content },
        ],
      });
    } else if (m.role === 'assistant') {
      const raw =
        m.raw?.provider === 'openai' ? (m.raw.data as OutputItem[] | undefined) : undefined;
      if (Array.isArray(raw) && raw.length) {
        // Turno con tool: si rinviano gli item originali (ragionamento cifrato compreso).
        out.push(...raw.map(replayable));
        continue;
      }
      if (m.content) {
        out.push({ role: 'assistant', content: [{ type: 'output_text', text: m.content }] });
      }
      for (const tc of m.toolCalls ?? []) {
        out.push({
          type: 'function_call',
          call_id: tc.id,
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        });
      }
    } else {
      out.push({ type: 'function_call_output', call_id: m.toolCallId, output: m.content });
    }
  }
  return out;
}

/** Risultato neutro a partire dalla risposta completa (stream terminato o chiamata sincrona). */
export function fromResponse(
  response: OAIResponse,
  model: string,
  streamedText?: string,
  onToken?: (delta: string) => void,
): SendResult {
  if (response.status === 'failed' || response.error) {
    throw new AIError('server', response.error?.message ?? 'Risposta non riuscita');
  }
  const output = response.output ?? [];
  let text = '';
  let refused = false;
  for (const item of output) {
    if (item.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c.type === 'output_text' && c.text) text += c.text;
      if (c.type === 'refusal') refused = true;
    }
  }
  if (streamedText === undefined && text) onToken?.(text);
  const toolCalls = output
    .filter((i) => i.type === 'function_call')
    .map((i, n) => ({
      id: i.call_id || `call_${n}`,
      name: i.name ?? '',
      arguments: parseToolArguments(i.arguments ?? ''),
    }));
  const stopReason: StopReason = toolCalls.length
    ? 'tool_use'
    : refused && !text
      ? 'refusal'
      : response.status === 'incomplete'
        ? response.incomplete_details?.reason === 'max_output_tokens'
          ? 'max_tokens'
          : response.incomplete_details?.reason === 'content_filter'
            ? 'refusal'
            : 'other'
        : 'end';
  return {
    text: text || streamedText || '',
    toolCalls,
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
    stopReason,
    raw: toolCalls.length ? { provider: 'openai', model, data: output } : undefined,
  };
}

/** Accumula lo stream della Responses API (esportata per i test). */
export async function collectOpenAIStream(
  events: AsyncIterable<{ data: string }>,
  model: string,
  onToken?: (delta: string) => void,
): Promise<SendResult> {
  let text = '';
  const items: OutputItem[] = [];
  let final: OAIResponse | null = null;
  for await (const ev of events) {
    if (ev.data === '[DONE]') break;
    let e: OAIStreamEvent;
    try {
      e = JSON.parse(ev.data) as OAIStreamEvent;
    } catch {
      continue;
    }
    switch (e.type) {
      case 'response.output_text.delta':
        if (e.delta) {
          text += e.delta;
          onToken?.(e.delta);
        }
        break;
      case 'response.output_item.done':
        if (e.item) items.push(e.item);
        break;
      case 'response.completed':
      case 'response.incomplete':
      case 'response.failed':
        final = e.response ?? null;
        break;
      case 'error':
        throw new AIError('server', e.message ?? 'Errore nello stream');
      default:
        break;
    }
  }
  const response: OAIResponse = final ?? { status: 'incomplete', output: items };
  if (!response.output?.length) response.output = items;
  return fromResponse(response, model, text, onToken);
}

// "pro" e "deep-research" funzionano solo con la Responses API.
const EXCLUDED =
  /(pro|deep-research|mini|nano|audio|realtime|search|transcribe|tts|image|codex|oss|instruct|embedding|moderation|dall-e|whisper|davinci|babbage)/i;

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
    const body = {
      model: options.model,
      instructions: context.system,
      input: toOpenAIInput(messages),
      store: false,
      include: isReasoningModel(options.model) ? ['reasoning.encrypted_content'] : undefined,
      max_output_tokens: options.maxOutputTokens ?? 16000,
      reasoning: options.quick && isReasoningModel(options.model) ? { effort: 'low' } : undefined,
      tools: context.tools?.length
        ? context.tools.map((t) => ({
            type: 'function',
            name: t.name,
            description: t.description,
            parameters: t.parameters,
            strict: false,
          }))
        : undefined,
    };
    const post = (extra: object) =>
      request(`${BASE}/responses`, {
        method: 'POST',
        headers: headers(options.apiKey),
        signal: options.signal,
        body: JSON.stringify({ ...body, ...extra }),
      });

    let res: Response;
    try {
      res = await post({ stream: true });
    } catch (e) {
      // Lo streaming di alcuni modelli richiede la verifica dell'organizzazione OpenAI:
      // si ripete senza streaming (la risposta arriva tutta in una volta).
      if (!(e instanceof AIError) || e.code !== 'org_verification') throw e;
      const json = (await (await post({})).json()) as OAIResponse;
      return fromResponse(json, options.model, undefined, options.onToken);
    }
    if (!res.body) throw new AIError('network', 'Risposta senza body');
    return collectOpenAIStream(readSSE(res.body), options.model, options.onToken);
  },

  async testConnection(apiKey, model) {
    await request(`${BASE}/responses`, {
      method: 'POST',
      headers: headers(apiKey),
      body: JSON.stringify({ model, input: 'ping', max_output_tokens: 16, store: false }),
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
