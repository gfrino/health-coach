import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/config/settingsSchema';

import { DEFAULT_LANGUAGE, resolveLanguage } from './resolveLanguage';

import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import it from './locales/it.json';

export { DEFAULT_LANGUAGE, resolveLanguage };

export const resources = {
  it: { translation: it },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
} as const;

export function deviceLanguageCodes(): string[] {
  return getLocales().map((l) => l.languageCode ?? l.languageTag);
}

export function deviceRegion(): string | null {
  return getLocales()[0]?.regionCode ?? null;
}

const i18n = createInstance();
let initialized = false;

export async function initI18n(preference: 'system' | SupportedLanguage = 'system') {
  const lng = resolveLanguage(preference, deviceLanguageCodes());
  if (initialized) {
    if (i18n.language !== lng) await i18n.changeLanguage(lng);
    return i18n;
  }
  initialized = true;
  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18n;
}

export default i18n;
