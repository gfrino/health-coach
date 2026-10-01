import type { AIProviderId } from '@/config/settingsSchema';

import { anthropicProvider } from './providers/anthropic';
import { deviceEngineName, deviceProvider } from './providers/device';
import { geminiProvider } from './providers/gemini';
import { openaiProvider } from './providers/openai';
import type { AIProvider } from './types';

export interface ProviderInfo {
  id: AIProviderId;
  /** false per il modello sul telefono: nessuna chiave né account. */
  requiresKey: boolean;
  name: string;
  /** Pagina ufficiale dove creare la chiave API. */
  keysUrl: string;
  /** Prefisso tipico della chiave, solo come suggerimento (nessuna validazione rigida). */
  keyHint: string;
  /** Numero di passi della guida (testi in i18n: ai.guides.<id>.step1…stepN). */
  guideSteps: number;
}

export const PROVIDERS: Record<AIProviderId, ProviderInfo> = {
  device: {
    id: 'device',
    requiresKey: false,
    get name() {
      return deviceEngineName();
    },
    keysUrl: '',
    keyHint: '',
    guideSteps: 0,
  },
  anthropic: {
    id: 'anthropic',
    requiresKey: true,
    name: 'Anthropic (Claude)',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
    guideSteps: 4,
  },
  openai: {
    id: 'openai',
    requiresKey: true,
    name: 'OpenAI (ChatGPT)',
    keysUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    guideSteps: 4,
  },
  gemini: {
    id: 'gemini',
    requiresKey: true,
    name: 'Google Gemini',
    keysUrl: 'https://aistudio.google.com/app/apikey',
    keyHint: 'AQ.… / AIza…',
    guideSteps: 3,
  },
};

const ADAPTERS: Record<AIProviderId, AIProvider> = {
  device: deviceProvider,
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
};

const KEY_PATTERNS: Partial<Record<AIProviderId, RegExp>> = {
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
  openai: /^sk-(?!ant-)[A-Za-z0-9_-]{20,}$/,
  // Dal 28/5/2026 AI Studio emette chiavi "AQ.…" (auth key); le vecchie "AIza…" restano valide.
  gemini: /^(AIza[A-Za-z0-9_-]{30,}|AQ\.[A-Za-z0-9_.-]{20,})$/,
};

/** Riconosce un codice di accesso copiato negli appunti (solo per l'autocompilazione, non è una validazione). */
export function extractKey(provider: AIProviderId, text: string | null | undefined): string | null {
  const pattern = KEY_PATTERNS[provider];
  if (!pattern || !text) return null;
  const candidate = text.trim().split(/\s+/)[0] ?? '';
  return pattern.test(candidate) ? candidate : null;
}

export function getProvider(id: AIProviderId): AIProvider {
  return ADAPTERS[id];
}
