import { SUPPORTED_LANGUAGES } from '@/config/settingsSchema';

import { DEVELOPER, LEGAL_DOCS, legalDocument } from '..';

describe('documenti legali', () => {
  it('ogni documento esiste in tutte le lingue, con titolo', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const doc of LEGAL_DOCS) {
        const text = legalDocument(doc, lang);
        expect(text).toMatch(/^# \S/);
        expect(text.length).toBeGreaterThan(300);
      }
    }
  });

  it("l'impressum e l'informativa riportano i dati dello sviluppatore", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const impressum = legalDocument('impressum', lang);
      expect(impressum).toContain(DEVELOPER.uid);
      expect(impressum).toContain(DEVELOPER.street);
      expect(legalDocument('privacy', lang)).toContain(DEVELOPER.email);
    }
  });

  it('i numeri di emergenza sono nelle avvertenze', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(legalDocument('disclaimer', lang)).toMatch(/144.*112/s);
    }
  });
});
