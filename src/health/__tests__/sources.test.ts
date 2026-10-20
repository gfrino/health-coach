import { SAFETY_RULES } from '@/coach/prompts';
import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import itLocale from '@/i18n/locales/it.json';

import { SOURCE_TOPICS, SOURCES } from '../sources';

describe('fonti scientifiche', () => {
  it.each(SOURCE_TOPICS)('il tema %s ha almeno una fonte completa con link https', (topic) => {
    expect(SOURCES[topic].length).toBeGreaterThan(0);
    for (const c of SOURCES[topic]) {
      expect(c.title.trim()).not.toBe('');
      expect(c.authors.trim()).not.toBe('');
      expect(c.publisher.trim()).not.toBe('');
      expect(c.url).toMatch(/^https:\/\/[^\s]+$/);
    }
  });

  it.each([
    ['it', itLocale],
    ['en', en],
    ['de', de],
    ['fr', fr],
  ])('ogni tema ha nome e descrizione d’uso in %s', (_lang, locale) => {
    for (const topic of SOURCE_TOPICS) {
      expect(locale.citations.topics[topic]).toBeTruthy();
      expect(locale.citations.usedFor[topic]).toBeTruthy();
    }
  });

  it('il coach deve citare le fonti senza inventarle', () => {
    expect(SAFETY_RULES).toMatch(/name the source of health advice/);
    expect(SAFETY_RULES).toMatch(/never invent studies or links/);
  });
});
