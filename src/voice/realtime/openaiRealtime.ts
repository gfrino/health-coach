import AudioRoute from 'audio-route';
import type { MediaStream, RTCPeerConnection } from 'react-native-webrtc';

import { AIError } from '@/ai/errors';
import { request } from '@/ai/http';
import type { ToolCall, ToolDefinition } from '@/ai/types';

/**
 * Conversazione a voce in tempo reale con OpenAI (Realtime API su WebRTC), come la
 * modalità vocale di ChatGPT: si parla e si interrompe liberamente, il turno lo decide il
 * rilevamento vocale di OpenAI. Tutto parte dal telefono con la chiave dell'utente: una chiave
 * temporanea (10 minuti) apre la connessione audio diretta con OpenAI, nessun server intermedio.
 */

const BASE = 'https://api.openai.com/v1';

/**
 * WebRTC caricato solo quando serve: nelle build precedenti il modulo nativo non c'è
 * e un import all'avvio farebbe chiudere l'app.
 */
function loadWebRTC(): typeof import('react-native-webrtc') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-webrtc') as typeof import('react-native-webrtc');
  } catch {
    throw new AIError('app_update_required', 'WebRTC non disponibile in questa build');
  }
}
const FALLBACK_MODEL = 'gpt-realtime';
const TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';
export const REALTIME_VOICE = 'marin';

export type RealtimeState = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended';

export interface RealtimeCallbacks {
  onState: (s: RealtimeState) => void;
  /** Trascrizione di ciò che ha detto l'utente (a fine frase). */
  onUserTranscript: (text: string) => void;
  /** Testo della risposta del coach: cumulativo mentre parla, `final` a fine risposta. */
  onAssistantTranscript: (text: string, final: boolean) => void;
  onToolUse: (name: string) => void;
  onError: (e: AIError) => void;
}

export interface RealtimeOptions {
  apiKey: string;
  instructions: string;
  tools: ToolDefinition[];
  /** Codice ISO 639-1 per la trascrizione (es. "it"). */
  language: string;
  /** Ultimi scambi della chat, per continuare la conversazione a voce. */
  history: { role: 'user' | 'assistant'; text: string }[];
  executeTool: (call: ToolCall) => Promise<{ content: string }>;
}

const versionOf = (id: string) => {
  const m = /^gpt-realtime-(\d+(?:\.\d+)?)$/.exec(id);
  return m?.[1] ? parseFloat(m[1]) : id === 'gpt-realtime' ? 1 : 0;
};

/** Il modello realtime più recente disponibile per questa chiave (non "mini", non datato). */
export function pickRealtimeModel(ids: string[]): string {
  const candidates = ids.filter((id) => /^gpt-realtime(-\d+(\.\d+)?)?$/.test(id));
  return candidates.sort((a, b) => versionOf(b) - versionOf(a))[0] ?? FALLBACK_MODEL;
}

interface ServerEvent {
  type: string;
  delta?: string;
  transcript?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  error?: { message?: string; code?: string };
  response?: { status?: string; output?: { type: string }[] };
}

export class OpenAIRealtimeSession {
  private pc: RTCPeerConnection | null = null;
  private channel: ReturnType<RTCPeerConnection['createDataChannel']> | null = null;
  private mic: MediaStream | null = null;
  private assistantText = '';
  private ended = false;
  /** Tool in esecuzione nella risposta corrente: si prosegue quando sono finiti tutti. */
  private pendingTools: Promise<void>[] = [];

  constructor(
    private readonly opts: RealtimeOptions,
    private readonly cb: RealtimeCallbacks,
  ) {}

  async start(): Promise<void> {
    this.cb.onState('connecting');
    try {
      const model = await this.chooseModel();
      const secret = await this.createClientSecret(model);
      if (this.ended) return;

      const { mediaDevices, RTCPeerConnection, RTCSessionDescription } = loadWebRTC();
      this.mic = await mediaDevices.getUserMedia({ audio: true, video: false });
      const pc = new RTCPeerConnection({});
      this.pc = pc;
      for (const track of this.mic.getTracks()) pc.addTrack(track, this.mic);

      const channel = pc.createDataChannel('oai-events');
      this.channel = channel;
      channel.onopen = () => this.onChannelOpen();
      channel.onmessage = (e: unknown) => {
        try {
          const data = (e as { data: string }).data;
          void this.onServerEvent(JSON.parse(data) as ServerEvent);
        } catch {
          // evento non JSON: ignorato
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          if (!this.ended) this.fail(new AIError('network', 'Connessione vocale interrotta'));
        }
      };

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      const res = await request(`${BASE}/realtime/calls`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/sdp' },
        body: offer.sdp ?? '',
      });
      const answer = await res.text();
      if (this.ended) return;
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer }));
      await AudioRoute?.setSpeakerphone(true);
    } catch (e) {
      this.fail(e instanceof AIError ? e : new AIError('unknown', String(e)));
    }
  }

  /** Microfono in pausa (il coach continua a parlare). */
  setMuted(muted: boolean) {
    for (const t of this.mic?.getAudioTracks() ?? []) t.enabled = !muted;
  }

  stop() {
    if (this.ended) return;
    this.ended = true;
    try {
      this.channel?.close();
      for (const t of this.mic?.getTracks() ?? []) t.stop();
      this.pc?.close();
    } finally {
      this.channel = null;
      this.pc = null;
      this.mic = null;
      void AudioRoute?.setSpeakerphone(false);
      this.cb.onState('ended');
    }
  }

  private fail(e: AIError) {
    if (this.ended) return;
    this.cb.onError(e);
    this.stop();
  }

  private send(event: Record<string, unknown>) {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(event));
  }

  private async chooseModel(): Promise<string> {
    try {
      const res = await request(`${BASE}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.opts.apiKey}` },
      });
      const json = (await res.json()) as { data?: { id: string }[] };
      return pickRealtimeModel((json.data ?? []).map((m) => m.id));
    } catch (e) {
      if (e instanceof AIError && e.code === 'invalid_key') throw e;
      return FALLBACK_MODEL;
    }
  }

  /** Chiave temporanea per la sessione: la chiave dell'utente non entra nella connessione audio. */
  private async createClientSecret(model: string): Promise<string> {
    const res = await request(`${BASE}/realtime/client_secrets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 600 },
        session: {
          type: 'realtime',
          model,
          instructions: this.opts.instructions,
          audio: {
            input: {
              transcription: { model: TRANSCRIBE_MODEL, language: this.opts.language },
              turn_detection: { type: 'semantic_vad', eagerness: 'auto' },
              noise_reduction: { type: 'near_field' },
            },
            output: { voice: REALTIME_VOICE },
          },
          tools: this.opts.tools.map((t) => ({
            type: 'function',
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
          tool_choice: 'auto',
        },
      }),
    });
    const json = (await res.json()) as { value?: string };
    if (!json.value) throw new AIError('server', 'Chiave temporanea non ricevuta');
    return json.value;
  }

  /** Contesto della chat esistente, poi si ascolta. */
  private onChannelOpen() {
    for (const m of this.opts.history) {
      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: m.role,
          content: [{ type: m.role === 'user' ? 'input_text' : 'output_text', text: m.text }],
        },
      });
    }
    this.cb.onState('listening');
  }

  private async onServerEvent(e: ServerEvent) {
    switch (e.type) {
      case 'input_audio_buffer.speech_started':
        // L'utente parla (anche interrompendo il coach): OpenAI ferma la risposta da sé.
        this.cb.onState('listening');
        break;
      case 'input_audio_buffer.speech_stopped':
        this.cb.onState('thinking');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (e.transcript?.trim()) this.cb.onUserTranscript(e.transcript.trim());
        break;
      case 'response.output_audio_transcript.delta':
        this.assistantText += e.delta ?? '';
        this.cb.onAssistantTranscript(this.assistantText, false);
        break;
      case 'output_audio_buffer.started':
        this.cb.onState('speaking');
        break;
      case 'output_audio_buffer.stopped':
      case 'output_audio_buffer.cleared':
        if (!this.ended) this.cb.onState('listening');
        break;
      case 'response.output_audio_transcript.done': {
        const text = (e.transcript ?? this.assistantText).trim();
        this.assistantText = '';
        if (text) this.cb.onAssistantTranscript(text, true);
        break;
      }
      case 'response.function_call_arguments.done':
        this.pendingTools.push(this.runTool(e));
        break;
      case 'response.done': {
        if (!e.response?.output?.some((o) => o.type === 'function_call')) break;
        const pending = this.pendingTools;
        this.pendingTools = [];
        await Promise.all(pending);
        // Una sola nuova risposta dopo tutti i risultati dei tool.
        this.send({ type: 'response.create' });
        break;
      }
      case 'error': {
        const msg = e.error?.message ?? 'Errore della sessione vocale';
        // Errori non fatali (es. risposta annullata perché l'utente ha interrotto).
        if (/cancel|no active response/i.test(msg)) break;
        this.fail(new AIError('server', msg));
        break;
      }
      default:
        break;
    }
  }

  private async runTool(e: ServerEvent) {
    if (!e.call_id || !e.name) return;
    this.cb.onToolUse(e.name);
    let args: Record<string, unknown> = {};
    try {
      args = e.arguments ? (JSON.parse(e.arguments) as Record<string, unknown>) : {};
    } catch {
      args = {};
    }
    const outcome = await this.opts.executeTool({ id: e.call_id, name: e.name, arguments: args });
    this.send({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: e.call_id, output: outcome.content },
    });
  }
}
