export type AIErrorCode =
  | 'invalid_key'
  | 'insufficient_credit'
  | 'rate_limited'
  | 'network'
  | 'server'
  | 'model_not_found'
  | 'refused'
  | 'device_unavailable'
  | 'context_window'
  | 'unsupported_language'
  | 'aborted'
  | 'org_verification'
  | 'app_update_required'
  | 'billing_required'
  | 'unknown';

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message?: string,
    public readonly status?: number,
  ) {
    super(message ?? code);
    this.name = 'AIError';
  }

  /** Errori per cui ha senso il pulsante "Riprova". */
  get retryable(): boolean {
    return this.code === 'rate_limited' || this.code === 'network' || this.code === 'server';
  }
}

const CREDIT_PATTERNS = [
  /credit balance/i,
  /insufficient_quota/i,
  /exceeded your current quota/i,
  /billing/i,
  /payment/i,
];
/**
 * Gemini: in Svizzera, UE e Regno Unito Google può richiedere la fatturazione attiva sul progetto
 * (piano gratuito non disponibile o paese non supportato).
 */
const BILLING_REQUIRED_PATTERNS = [
  /location is not supported/i,
  /not available in your (country|region)/i,
  /free tier is not available/i,
  /enable billing/i,
  /billing (is )?(not enabled|required)/i,
];

/** Testo leggibile dell'errore del provider (campo "message" del JSON, se c'è), per i dettagli in app. */
export function providerMessage(e: AIError): string | null {
  const raw = e.message?.trim();
  if (!raw || raw === e.code) return null;
  try {
    const json = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
    const msg =
      typeof json.error === 'string' ? json.error : (json.error?.message ?? json.message ?? null);
    return msg ? msg.slice(0, 240) : raw.slice(0, 240);
  } catch {
    return raw.slice(0, 240);
  }
}

/** OpenAI: alcuni modelli (streaming GPT-5, o3…) richiedono la verifica dell'organizzazione. */
const VERIFICATION_PATTERNS = [/must be verified/i, /organization.*verif/i];
const KEY_PATTERNS = [/api[_ ]?key/i, /invalid.*key/i, /API_KEY_INVALID/, /unauthori[sz]ed/i];

/** Classificazione degli errori HTTP comune ai provider. */
export function classifyHttpError(status: number, body: string): AIError {
  const text = body.slice(0, 500);
  if (status === 401 || status === 403) return new AIError('invalid_key', text, status);
  // Prima del credito: anche questi messaggi parlano di "billing".
  if (BILLING_REQUIRED_PATTERNS.some((p) => p.test(text))) {
    return new AIError('billing_required', text, status);
  }
  if (status === 402 || CREDIT_PATTERNS.some((p) => p.test(text))) {
    return new AIError('insufficient_credit', text, status);
  }
  if (status === 404) return new AIError('model_not_found', text, status);
  if (status === 400 && KEY_PATTERNS.some((p) => p.test(text))) {
    return new AIError('invalid_key', text, status);
  }
  if (status === 400 && VERIFICATION_PATTERNS.some((p) => p.test(text))) {
    return new AIError('org_verification', text, status);
  }
  if (status === 429) return new AIError('rate_limited', text, status);
  if (status === 529 || status >= 500) return new AIError('server', text, status);
  return new AIError('unknown', text, status);
}

export function toAIError(e: unknown): AIError {
  if (e instanceof AIError) return e;
  if (e instanceof Error && e.name === 'AbortError') return new AIError('aborted');
  if (e instanceof TypeError) return new AIError('network', e.message);
  return new AIError('unknown', e instanceof Error ? e.message : String(e));
}
