import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/config/settingsSchema';

export const DEFAULT_LANGUAGE: SupportedLanguage = 'it';

/** Lingua effettiva: preferenza esplicita, altrimenti prima lingua di sistema supportata, altrimenti italiano. */
export function resolveLanguage(
  preference: 'system' | SupportedLanguage,
  deviceLanguageCodes: readonly (string | null | undefined)[],
): SupportedLanguage {
  if (preference !== 'system') return preference;
  for (const code of deviceLanguageCodes) {
    const base = code?.toLowerCase().split('-')[0];
    if (base && (SUPPORTED_LANGUAGES as readonly string[]).includes(base)) {
      return base as SupportedLanguage;
    }
  }
  return DEFAULT_LANGUAGE;
}
