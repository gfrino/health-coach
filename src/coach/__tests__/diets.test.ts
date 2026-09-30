import { getDefaultSettings, NUTRITION_APPROACHES } from '@/config/settingsSchema';
import itLocale from '@/i18n/locales/it.json';

import { composeSystemPrompt } from '../context';
import { DIET_GUIDES, dietGuideText } from '../diets';

const now = new Date(2026, 8, 29, 20, 0);

describe('schede delle diete', () => {
  it('ogni opzione ha una scheda completa e un’etichetta', () => {
    for (const d of NUTRITION_APPROACHES) {
      const g = DIET_GUIDES[d];
      expect(g.summary.length).toBeGreaterThan(20);
      expect(g.principles.length).toBeGreaterThan(0);
      expect((itLocale.coachSetup.nutritionOptions as Record<string, string>)[d]).toBeTruthy();
    }
  });

  it('Healthy Keto: la scheda completa arriva ai modelli cloud', () => {
    const p = composeSystemPrompt({
      coach: { ...getDefaultSettings().coach, nutritionApproach: 'healthyKeto' },
      language: 'it',
      now,
    });
    expect(p).toContain('Healthy Keto® (Dr. Eric Berg)');
    expect(p).toMatch(/7–10 cups/);
    expect(p).toMatch(/intermittent fasting/);
    expect(p).toMatch(/Avoid or limit: .*seed oils/);
  });

  it('senza lectine: versione ridotta sul telefono', () => {
    const t = dietGuideText('lectinFree', true);
    expect(t).toMatch(/^Nutrition: Lectin-free/);
    expect(t).not.toContain('Prefer:');
  });

  it('il prompt compatto resta entro il budget del modello sul telefono', () => {
    for (const d of NUTRITION_APPROACHES) {
      const p = composeSystemPrompt({
        coach: { ...getDefaultSettings().coach, nutritionApproach: d },
        language: 'it',
        now,
        compact: true,
      });
      // ~4 caratteri per token: sotto i ~1200 token lascia spazio a dati e conversazione.
      expect(p.length).toBeLessThan(4800);
    }
  });
});
