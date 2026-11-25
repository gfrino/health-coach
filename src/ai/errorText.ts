import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useSettingsStore } from '@/store/settingsStore';

import type { AIErrorCode } from './errors';

/**
 * Chiave del testo di errore da mostrare. Con OpenAI il credito esaurito ha un testo suo:
 * molti hanno l'abbonamento a ChatGPT e non sanno che le API si pagano a parte.
 */
export function aiErrorKey(code: AIErrorCode | string, provider?: string | null): string {
  if (code === 'insufficient_credit' && provider === 'openai')
    return 'ai.errors.insufficient_credit_openai';
  return `ai.errors.${code}`;
}

/** Testo dell'errore AI per il provider in uso (o quello indicato). */
export function useAIErrorText() {
  const { t } = useTranslation();
  const current = useSettingsStore((s) => s.settings.ai.provider);
  return useCallback(
    (code: AIErrorCode | string, provider?: string | null) =>
      t(aiErrorKey(code, provider ?? current) as 'ai.errors.unknown'),
    [t, current],
  );
}
