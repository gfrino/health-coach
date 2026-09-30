import type { SupportedLanguage } from '@/config/settingsSchema';

import { de } from './content/de';
import { en } from './content/en';
import { fr } from './content/fr';
import { it } from './content/it';
import type { LegalDoc } from './developer';

export { DEVELOPER, LEGAL_DOCS, LEGAL_UPDATED, type LegalDoc } from './developer';

const CONTENT: Record<SupportedLanguage, Record<LegalDoc, string>> = { it, en, de, fr };

export function legalDocument(doc: LegalDoc, language: SupportedLanguage): string {
  return CONTENT[language][doc];
}
