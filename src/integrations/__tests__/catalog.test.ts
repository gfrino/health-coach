import itLocale from '@/i18n/locales/it.json';

import {
  COMING_SOON_CATEGORIES,
  comingSoonByCategory,
  INTEGRATIONS,
  integrationsFor,
} from '../integrationsCatalog';

describe('catalogo integrazioni', () => {
  it('ha id univoci', () => {
    const ids = INTEGRATIONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contiene tutte le integrazioni della roadmap', () => {
    const ids = new Set(INTEGRATIONS.map((i) => i.id));
    for (const id of [
      'apple_health',
      'health_connect',
      'withings',
      'oura',
      'dexcom',
      'glucose_file_import',
      'whoop',
      'fitbit',
      'polar',
      'garmin',
      'strava',
      'lumen',
      'freestyle_libre',
      'accu_chek_smartguide',
      'eversense',
      'sibionics',
      'kimi',
      'openai_compatible',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('mostra la sorgente di sistema giusta per piattaforma', () => {
    expect(integrationsFor('ios').some((i) => i.id === 'apple_health')).toBe(true);
    expect(integrationsFor('ios').some((i) => i.id === 'health_connect')).toBe(false);
    expect(integrationsFor('android').some((i) => i.id === 'health_connect')).toBe(true);
  });

  it('le integrazioni a pagamento hanno un productId da 1 CHF, quelle incluse no', () => {
    for (const i of INTEGRATIONS) {
      if (i.priceChf > 0) expect(i.productId).toMatch(/^integration\./);
      else expect(i.productId).toBeNull();
    }
  });

  it('i "presto disponibili" sono raggruppati per categoria e hanno testi', () => {
    const groups = comingSoonByCategory('ios');
    expect(groups.map((g) => g.category)).toEqual(
      COMING_SOON_CATEGORIES.filter((c) => groups.some((g) => g.category === c)),
    );
    const items = itLocale.integrations.items as Record<
      string,
      { name: string; data: string } | undefined
    >;
    for (const g of groups) for (const i of g.items) expect(items[i.id]?.data).toBeTruthy();
  });

  it('nessuna integrazione richiede login e password di terzi', () => {
    for (const i of INTEGRATIONS)
      expect(['system', 'oauth', 'file_import', 'api_key', 'on_device']).toContain(i.method);
  });
});
