import { Platform } from 'react-native';

import OnDeviceAi, { type OnDeviceAvailability } from 'on-device-ai';

import { AIError } from '../errors';
import type { AIProvider, ChatMessage, CoachContext, SendOptions, SendResult } from '../types';

/**
 * Modello linguistico del sistema operativo: Apple Foundation Models (Apple Intelligence, iOS 26+)
 * o Gemini Nano (Android, AICore). Nessun account, nessuna chiave, nessun costo.
 * - Sul telefono: contesto piccolo (~4K token) e niente tool calling → prompt compatto.
 * - Su iPhone con iOS 27 (build 1.41.0+), se l'utente non l'ha disattivato: Private Cloud Compute,
 *   il modello più grande di Apple sui suoi server privati (32K di contesto, Apple non conserva
 *   le richieste). Se PCC non risponde (rete, quota giornaliera, servizio) si torna al telefono.
 */

export const DEVICE_MODEL_ID = 'on-device';

/** Budget in caratteri per la trascrizione della conversazione (≈ 1000 token sul telefono). */
const TRANSCRIPT_CHAR_BUDGET = 4000;
/** Con Private Cloud Compute (32K token) la conversazione può essere molto più lunga. */
const PCC_TRANSCRIPT_CHAR_BUDGET = 24000;

/** Dopo un errore di PCC si usa il telefono per un po', invece di riprovare a ogni messaggio. */
const PCC_PAUSE_MS: Record<string, number> = {
  pcc_quota: 3 * 60 * 60 * 1000,
  pcc_network: 2 * 60 * 1000,
  pcc_unavailable: 15 * 60 * 1000,
};
let pccPausedUntil = 0;
/** Preferenza dell'utente, aggiornata da `usesPcc` (chiamata prima di comporre il prompt). */
let pccPreferred = true;

/**
 * true se la prossima risposta userà Private Cloud Compute: iPhone con iOS 27, build con il
 * permesso Apple, opzione attiva, quota non esaurita e nessun errore recente.
 */
export async function usesPcc(enabled: boolean): Promise<boolean> {
  pccPreferred = enabled;
  if (!enabled || Platform.OS !== 'ios' || typeof OnDeviceAi?.generateWith !== 'function') {
    return false;
  }
  if (Date.now() < pccPausedUntil) return false;
  return (await getDeviceAvailability()).pcc === 'available';
}

/** Per i test. */
export function resetPccPause() {
  pccPausedUntil = 0;
  pccPreferred = true;
}

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
export function buildDevicePrompt(
  messages: ChatMessage[],
  budget = TRANSCRIPT_CHAR_BUDGET,
): string {
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
    if (used + line.length > budget) break;
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
  pcc_quota: 'device_unavailable',
  pcc_network: 'network',
  pcc_unavailable: 'device_unavailable',
};

let seq = 0;

export const deviceProvider: AIProvider = {
  id: 'device',

  async sendMessage(
    context: CoachContext,
    messages: ChatMessage[],
    options: SendOptions,
  ): Promise<SendResult> {
    const native = OnDeviceAi;
    if (!native) throw new AIError('device_unavailable');

    /** Una richiesta al modello: il nativo invia il testo cumulativo, all'UI va solo la parte nuova. */
    const generate = async (engine: 'pcc' | 'device', system: string, prompt: string) => {
      const requestId = `r${Date.now()}-${seq++}`;
      let previous = '';
      const sub = native.addListener('onToken', (e) => {
        if (e.requestId !== requestId) return;
        if (e.text.startsWith(previous)) options.onToken?.(e.text.slice(previous.length));
        previous = e.text;
      });
      const onAbort = () => void native.cancel(requestId);
      options.signal?.addEventListener('abort', onAbort);
      try {
        const text =
          engine === 'pcc' && native.generateWith
            ? await native.generateWith(requestId, system, prompt, 'pcc')
            : await native.generate(requestId, system, prompt);
        return { text, streamed: previous.length > 0 };
      } catch (e) {
        throw Object.assign(e as Error, { streamed: previous.length > 0 });
      } finally {
        sub.remove();
        options.signal?.removeEventListener('abort', onAbort);
      }
    };

    const done = (text: string): SendResult => {
      if (options.signal?.aborted) throw new AIError('aborted');
      return {
        text: text.trim(),
        toolCalls: [],
        // Nessun costo: i token non vengono conteggiati per i modelli di Apple e del telefono.
        usage: { inputTokens: 0, outputTokens: 0 },
        stopReason: 'end',
      };
    };

    const toError = (e: unknown) => {
      if (e instanceof AIError) return e;
      const code = (e as { code?: string }).code ?? '';
      return new AIError(NATIVE_ERRORS[code] ?? 'unknown', (e as Error).message);
    };

    let system = context.system;
    if (await usesPcc(pccPreferred)) {
      try {
        const r = await generate('pcc', system, buildDevicePrompt(messages, PCC_TRANSCRIPT_CHAR_BUDGET));
        return done(r.text);
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        const pause = PCC_PAUSE_MS[code];
        if (pause) pccPausedUntil = Date.now() + pause;
        // Se PCC aveva già scritto qualcosa, ripartire dal telefono mescolerebbe due risposte.
        if (!pause || (e as { streamed?: boolean }).streamed || options.signal?.aborted) {
          throw toError(e);
        }
        // Prompt ridotto per il modello sul telefono (4K token), se il chiamante lo fornisce.
        if (context.fallbackSystem) system = await context.fallbackSystem();
      }
    }
    try {
      const r = await generate('device', system, buildDevicePrompt(messages));
      return done(r.text);
    } catch (e) {
      throw toError(e);
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
