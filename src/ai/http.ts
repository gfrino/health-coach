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

/** POST/GET con classificazione degli errori HTTP. */
export async function request(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await currentFetch(url, init);
  } catch (e) {
    throw toAIError(e);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw classifyHttpError(res.status, body);
  }
  return res;
}
