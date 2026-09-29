import { Platform } from 'react-native';

import OnDeviceAi, { type OnDeviceAvailability } from 'on-device-ai';

import { AIError } from '../errors';
import type { AIProvider, ChatMessage, CoachContext, SendOptions, SendResult } from '../types';

/**
 * Modello linguistico del sistema operativo, eseguito interamente sul telefono:
 * Apple Foundation Models (Apple Intelligence, iOS 26+) o Gemini Nano (Android, AICore).
 * Nessun account, nessuna chiave, nessun costo, nessun dato in uscita.
 * Limiti: contesto piccolo (~4K token) e niente tool calling → prompt compatto.
 */

export const DEVICE_MODEL_ID = 'on-device';

/** Budget in caratteri per la trascrizione della conversazione (≈ 1000 token). */
const TRANSCRIPT_CHAR_BUDGET = 4000;

export const deviceEngineName = () =>
  Platform.OS === 'ios' ? 'Apple Intelligence' : 'Gemini Nano';

export async function getDeviceAvailability(): Promise<OnDeviceAvailability> {
  const fallback: OnDeviceAvailability = {
    status: 'unavailable',
    reason: 'unsupportedOS',
    engine: Platform.OS === 'ios' ? 'apple' : 'gemini-nano',
  };
  if (!OnDeviceAi) return fallback;
  try {
    return await OnDeviceAi.getAvailability();
  } catch {
    return fallback;
  }
}

/** Scarica il modello (solo Android, quando lo stato è "downloadable"). */
export async function downloadDeviceModel(onProgress?: (bytes: number) => void): Promise<void> {
  if (!OnDeviceAi) throw new AIError('device_unavailable');
  const sub = OnDeviceAi.addListener('onDownloadProgress', (e) => {
    if (typeof e.bytes === 'number') onProgress?.(e.bytes);
  });
  try {
    await OnDeviceAi.download();
  } finally {
    sub.remove();
  }
}

/**
 * La conversazione diventa un'unica trascrizione testuale (il modello di sistema
 * non accetta una history strutturata): ultimi turni entro il budget, ultimo messaggio in fondo.
 */
export function buildDevicePrompt(messages: ChatMessage[]): string {
  const turns = messages.filter(
    (m): m is Extract<ChatMessage, { role: 'user' | 'assistant' }> =>
      (m.role === 'user' || m.role === 'assistant') && !!m.content.trim(),
  );
  const last = turns.at(-1);
  if (!last) return '';
  const lines: string[] = [];
  let used = last.content.length;
  for (let i = turns.length - 2; i >= 0; i--) {
    const t = turns[i];
    if (!t) continue;
    const line = `${t.role === 'user' ? 'User' : 'Coach'}: ${t.content.trim()}`;
    if (used + line.length > TRANSCRIPT_CHAR_BUDGET) break;
    lines.unshift(line);
    used += line.length;
  }
  const history = lines.length ? `Conversation so far:\n${lines.join('\n')}\n\n` : '';
  return `${history}User: ${last.content.trim()}\nCoach:`;
}

const NATIVE_ERRORS: Record<string, ConstructorParameters<typeof AIError>[0]> = {
  guardrail: 'refused',
  refused: 'refused',
  context_window: 'context_window',
  unsupported_language: 'unsupported_language',
  rate_limited: 'rate_limited',
  busy: 'rate_limited',
  unavailable: 'device_unavailable',
};

let seq = 0;

export const deviceProvider: AIProvider = {
  id: 'device',

  async sendMessage(
    context: CoachContext,
    messages: ChatMessage[],
    options: SendOptions,
  ): Promise<SendResult> {
    if (!OnDeviceAi) throw new AIError('device_unavailable');
    const requestId = `r${Date.now()}-${seq++}`;
    let previous = '';
    const sub = OnDeviceAi.addListener('onToken', (e) => {
      if (e.requestId !== requestId) return;
      // Il nativo invia il testo cumulativo: all'UI passa solo la parte nuova.
      if (e.text.startsWith(previous)) options.onToken?.(e.text.slice(previous.length));
      previous = e.text;
    });
    const onAbort = () => void OnDeviceAi?.cancel(requestId);
    options.signal?.addEventListener('abort', onAbort);
    try {
      const text = await OnDeviceAi.generate(
        requestId,
        context.system,
        buildDevicePrompt(messages),
      );
      if (options.signal?.aborted) throw new AIError('aborted');
      return {
        text: text.trim(),
        toolCalls: [],
        // Nessun costo: i token non vengono conteggiati per il modello sul telefono.
        usage: { inputTokens: 0, outputTokens: 0 },
        stopReason: 'end',
      };
    } catch (e) {
      if (e instanceof AIError) throw e;
      const code = (e as { code?: string }).code ?? '';
      throw new AIError(NATIVE_ERRORS[code] ?? 'unknown', (e as Error).message);
    } finally {
      sub.remove();
      options.signal?.removeEventListener('abort', onAbort);
    }
  },

  async testConnection() {
    const a = await getDeviceAvailability();
    if (a.status !== 'available') throw new AIError('device_unavailable');
  },

  async listModels() {
    return [{ id: DEVICE_MODEL_ID, displayName: deviceEngineName() }];
  },

  pickDefaultModel: () => DEVICE_MODEL_ID,
  supportsVision: () => false,
  supportsTools: () => false,
};
