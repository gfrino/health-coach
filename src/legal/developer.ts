/**
 * Dati dello sviluppatore (Impressum, contatti). Fonte: sito ticinoweb.com.
 * Da aggiornare qui se cambiano: sono usati da impostazioni e documenti legali.
 */
export const DEVELOPER = {
  name: 'ticinoWEB di Giovanni Frino',
  owner: 'Giovanni Frino',
  street: 'via Serafino Balestra 6',
  city: '6600 Locarno',
  country: { it: 'Svizzera', en: 'Switzerland', de: 'Schweiz', fr: 'Suisse' },
  email: 'info@ticinoweb.net',
  phone: '+41 91 225 37 15',
  website: 'https://ticinoweb.com',
  uid: 'CHE-312.661.279',
  commercialRegister: 'CH-501.1.019.985-4',
} as const;

/** Data dell'ultima revisione dei documenti legali (da aggiornare a ogni modifica dei testi). */
export const LEGAL_UPDATED = '2026-10-04';

export const LEGAL_DOCS = ['terms', 'privacy', 'disclaimer', 'impressum'] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
