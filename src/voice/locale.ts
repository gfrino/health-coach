import { getLocales } from 'expo-localization';

import type { SupportedLanguage } from '@/config/settingsSchema';

const DEFAULT_TAG: Record<SupportedLanguage, string> = {
  it: 'it-IT',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
};

/** Locale per voce (es. "it-CH" se il telefono è in italiano svizzero, altrimenti il default). */
export function speechLocale(language: SupportedLanguage): string {
  const device = getLocales().find((l) => l.languageCode === language);
  return device?.languageTag ?? DEFAULT_TAG[language];
}
