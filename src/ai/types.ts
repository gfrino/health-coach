/**
 * Contratto comune per i provider AI (Anthropic, OpenAI, Gemini; in futuro altri).
 * Le chiamate partono direttamente dal dispositivo verso il provider (BYOK), senza server intermedi.
 */
import type { AIProviderId } from '@/config/settingsSchema';

export type { AIProviderId };

export interface ImagePart {
  mimeType: string;
  base64: string;
}

/** Documento allegato (PDF) inviato così com'è ai modelli che lo leggono nativamente. */
export interface DocumentPart {
  mimeType: 'application/pdf';
  base64: string;
  name: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Formato neutro dei messaggi; ogni adapter lo traduce nel formato del proprio provider. */
export type ChatMessage =
  | { role: 'user'; content: string; images?: ImagePart[]; documents?: DocumentPart[] }
  | {
      role: 'assistant';
      content: string;
      toolCalls?: ToolCall[];
      /**
       * Contenuto originale del provider per questo turno (es. blocchi di thinking di Anthropic,
       * thought signature di Gemini): va rinviato invariato durante un ciclo di tool call.
       */
      raw?: { provider: AIProviderId; model: string; data: unknown };
    }
  | { role: 'tool'; toolCallId: string; toolName: string; content: string; isError?: boolean };

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema (object) dei parametri. */
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface CoachContext {
  /** System prompt già composto dal livello coach. */
  system: string;
  tools?: ToolDefinition[];
}

export interface SendOptions {
  apiKey: string;
  model: string;
  maxOutputTokens?: number;
  /** Compito semplice (es. copiare i valori di un referto): poco ragionamento, risposta rapida. */
  quick?: boolean;
  signal?: AbortSignal;
  /** Testo generato in streaming, un pezzo alla volta. */
  onToken?: (delta: string) => void;
}

export type StopReason = 'end' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface SendResult {
  text: string;
  toolCalls: ToolCall[];
  usage: Usage;
  stopReason: StopReason;
  raw?: { provider: AIProviderId; model: string; data: unknown };
}

export interface ModelInfo {
  id: string;
  displayName: string;
}

export interface AIProvider {
  readonly id: AIProviderId;
  sendMessage(
    context: CoachContext,
    messages: ChatMessage[],
    options: SendOptions,
  ): Promise<SendResult>;
  /** Verifica chiave e modello con una richiesta minima. Lancia AIError in caso di problemi. */
  testConnection(apiKey: string, model: string): Promise<void>;
  listModels(apiKey: string): Promise<ModelInfo[]>;
  /** Modello suggerito tra quelli disponibili per la chiave. */
  pickDefaultModel(models: ModelInfo[]): string | null;
  supportsVision(model: string): boolean;
  supportsTools(model: string): boolean;
}
