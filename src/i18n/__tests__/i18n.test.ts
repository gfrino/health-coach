import de from '../locales/de.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import itLocale from '../locales/it.json';
import { resolveLanguage } from '../resolveLanguage';

type Tree = { [k: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'string' ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) };
  }, {});
}

const placeholders = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort();

describe('traduzioni', () => {
  const base = flatten(itLocale);
  it.each([
    ['en', en],
    ['de', de],
    ['fr', fr],
  ])("%s ha le stesse chiavi e gli stessi placeholder dell'italiano", (_lang, locale) => {
    const other = flatten(locale as Tree);
    expect(Object.keys(other).sort()).toEqual(Object.keys(base).sort());
    for (const [key, value] of Object.entries(base)) {
      expect(placeholders(other[key] ?? '')).toEqual(placeholders(value));
      expect((other[key] ?? '').trim()).not.toBe('');
    }
  });
});

describe('resolveLanguage', () => {
  it('usa la preferenza esplicita', () => {
    expect(resolveLanguage('fr', ['de-CH'])).toBe('fr');
  });
  it('usa la prima lingua di sistema supportata', () => {
    expect(resolveLanguage('system', ['es-ES', 'de-CH', 'en'])).toBe('de');
  });
  it("ripiega sull'italiano", () => {
    expect(resolveLanguage('system', ['ja-JP', null])).toBe('it');
    expect(resolveLanguage('system', [])).toBe('it');
  });
});
