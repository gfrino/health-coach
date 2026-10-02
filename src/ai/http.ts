import { fetch as expoFetch } from 'expo/fetch';

import { classifyHttpError, toAIError } from './errors';

/**
 * fetch di Expo: supporta lo streaming del body (necessario per SSE) su iOS e Android.
 * Sostituibile nei test.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

let currentFetch: FetchLike = expoFetch as unknown as FetchLike;

export function setFetch(f: FetchLike) {
  currentFetch = f;
}

export function getFetch(): FetchLike {
  return currentFetch;
}

/** Stati temporanei (sovraccarico, troppe richieste): si riprova da soli prima di mostrare l'errore. */
const RETRY_STATUS = new Set([429, 500, 502, 503, 529]);
const RETRY_DELAYS_MS = [1200, 3500];

const wait = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

/** POST/GET con classificazione degli errori HTTP e nuovi tentativi sugli errori temporanei. */
export async function request(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await currentFetch(url, init);
    } catch (e) {
      throw toAIError(e);
    }
    if (res.ok) return res;
    const body = await res.text().catch(() => '');
    const delay = RETRY_DELAYS_MS[attempt];
    if (RETRY_STATUS.has(res.status) && delay !== undefined && !init.signal?.aborted) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await wait(retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : delay, init.signal);
      if (!init.signal?.aborted) continue;
    }
    throw classifyHttpError(res.status, body);
  }
}
