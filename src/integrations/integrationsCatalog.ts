/**
 * Catalogo di TUTTE le integrazioni previste.
 * Rendere disponibile un'integrazione = scrivere il suo adapter (src/sources o src/ai),
 * cambiare `status` in 'available' e collegare `productId` (acquisto in-app, se a pagamento).
 * Testi (nome dei dati forniti) in i18n: integrations.items.<id>.
 *
 * Regola per tutte le integrazioni future: MAI campi login/password di servizi terzi.
 * Solo OAuth sulla pagina ufficiale del servizio, oppure import di file esportati dall'utente.
 */

export type IntegrationCategory =
  | 'platform' // Apple Health / Health Connect
  | 'ai' // provider AI
  | 'scales' // bilance e pressione
  | 'wearables' // anelli e bracciali
  | 'glucose' // sensori di glicemia
  | 'nutrition' // nutrizione e metabolismo
  | 'sports';

export type IntegrationStatus = 'available' | 'coming_soon';
export type IntegrationPlatform = 'ios' | 'android';
export type ConnectionMethod = 'system' | 'oauth' | 'file_import' | 'api_key' | 'on_device';

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  platforms: readonly IntegrationPlatform[];
  status: IntegrationStatus;
  method: ConnectionMethod;
  /** Prodotto in-app futuro (acquisto non consumabile). `null` = incluso nel prezzo dell'app. */
  productId: string | null;
  /** Prezzo previsto in CHF (0 = incluso). */
  priceChf: number;
  /** Colore del badge con l'iniziale (nessun logo di terzi incluso nell'app). */
  color: string;
}

const BOTH = ['ios', 'android'] as const;
const paid = (id: string) => `integration.${id}`;

export const INTEGRATIONS: readonly Integration[] = [
  // Piattaforma (incluse nel prezzo)
  {
    id: 'apple_health',
    name: 'Apple Health',
    category: 'platform',
    platforms: ['ios'],
    status: 'available',
    method: 'system',
    productId: null,
    priceChf: 0,
    color: '#E5484D',
  },
  {
    id: 'health_connect',
    name: 'Health Connect',
    category: 'platform',
    platforms: ['android'],
    status: 'available',
    method: 'system',
    productId: null,
    priceChf: 0,
    color: '#3E7BFA',
  },

  // AI (cambio sempre gratuito)
  {
    id: 'device',
    name: 'AI del telefono',
    category: 'ai',
    platforms: BOTH,
    status: 'available',
    method: 'on_device',
    productId: null,
    priceChf: 0,
    color: '#3A7560',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    category: 'ai',
    platforms: BOTH,
    status: 'available',
    method: 'api_key',
    productId: null,
    priceChf: 0,
    color: '#4285F4',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    category: 'ai',
    platforms: BOTH,
    status: 'available',
    method: 'api_key',
    productId: null,
    priceChf: 0,
    color: '#C96442',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'ai',
    platforms: BOTH,
    status: 'available',
    method: 'api_key',
    productId: null,
    priceChf: 0,
    color: '#10A37F',
  },
  // "Sign in with ChatGPT" con uso del piano: per app a pagamento richiede l'approvazione di OpenAI.
  {
    id: 'chatgpt_account',
    name: 'ChatGPT',
    category: 'ai',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: null,
    priceChf: 0,
    color: '#10A37F',
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    category: 'ai',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'api_key',
    productId: null,
    priceChf: 0,
    color: '#1F1F1F',
  },
  {
    id: 'openai_compatible',
    name: 'Provider compatibile OpenAI',
    category: 'ai',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'api_key',
    productId: null,
    priceChf: 0,
    color: '#6B7280',
  },

  // Bilance e pressione
  {
    id: 'withings',
    name: 'Withings',
    category: 'scales',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('withings'),
    priceChf: 1,
    color: '#00A5A8',
  },

  // Anelli e bracciali
  {
    id: 'oura',
    name: 'Oura',
    category: 'wearables',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('oura'),
    priceChf: 1,
    color: '#2E2E38',
  },
  {
    id: 'whoop',
    name: 'Whoop',
    category: 'wearables',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('whoop'),
    priceChf: 1,
    color: '#111111',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    category: 'wearables',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('fitbit'),
    priceChf: 1,
    color: '#00B0B9',
  },
  {
    id: 'polar',
    name: 'Polar',
    category: 'wearables',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('polar'),
    priceChf: 1,
    color: '#D10A11',
  },
  {
    id: 'garmin',
    name: 'Garmin',
    category: 'wearables',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('garmin'),
    priceChf: 1,
    color: '#007CC3',
  },

  // Sensori di glicemia
  {
    id: 'dexcom',
    name: 'Dexcom',
    category: 'glucose',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('dexcom'),
    priceChf: 1,
    color: '#58A618',
  },
  {
    id: 'glucose_file_import',
    name: 'Import glicemia da file',
    category: 'glucose',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'file_import',
    productId: paid('glucose_file_import'),
    priceChf: 1,
    color: '#7C5CFA',
  },
  {
    id: 'freestyle_libre',
    name: 'FreeStyle Libre',
    category: 'glucose',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('freestyle_libre'),
    priceChf: 1,
    color: '#F2A900',
  },
  {
    id: 'accu_chek_smartguide',
    name: 'Accu-Chek SmartGuide',
    category: 'glucose',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('accu_chek_smartguide'),
    priceChf: 1,
    color: '#0066CC',
  },
  {
    id: 'eversense',
    name: 'Eversense',
    category: 'glucose',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('eversense'),
    priceChf: 1,
    color: '#00857C',
  },
  {
    id: 'sibionics',
    name: 'Sibionics',
    category: 'glucose',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('sibionics'),
    priceChf: 1,
    color: '#2B6CB0',
  },

  // Nutrizione e metabolismo
  {
    id: 'lumen',
    name: 'Lumen',
    category: 'nutrition',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('lumen'),
    priceChf: 1,
    color: '#FF6B4A',
  },

  // Sport
  {
    id: 'strava',
    name: 'Strava',
    category: 'sports',
    platforms: BOTH,
    status: 'coming_soon',
    method: 'oauth',
    productId: paid('strava'),
    priceChf: 1,
    color: '#FC4C02',
  },
];

/** Ordine delle sezioni "presto disponibili" nella pagina Integrazioni. */
export const COMING_SOON_CATEGORIES: readonly IntegrationCategory[] = [
  'scales',
  'wearables',
  'glucose',
  'nutrition',
  'sports',
  'ai',
];

export function integrationsFor(platform: IntegrationPlatform): Integration[] {
  return INTEGRATIONS.filter((i) => i.platforms.includes(platform));
}

export function comingSoonByCategory(
  platform: IntegrationPlatform,
): { category: IntegrationCategory; items: Integration[] }[] {
  const items = integrationsFor(platform).filter((i) => i.status === 'coming_soon');
  return COMING_SOON_CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);
}

export function getIntegration(id: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}
