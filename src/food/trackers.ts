/**
 * Valori in più che l'utente sceglie di tracciare nel diario alimentare (oltre a calorie, macro,
 * fibre, zuccheri, grassi saturi e sodio): fruttosio, caffeina, alcol… o voci sue ("istamina",
 * "FODMAP"). Sono stimati dall'AI insieme al resto, sommati per giorno e passati al coach.
 */

/**
 * Lista vuota stabile per i selettori di Zustand: `?? []` crea un array nuovo a ogni lettura e
 * Zustand 5 lo vede come un cambiamento, ridisegnando all'infinito (crash della scheda Cibo).
 */
export const NO_TRACKERS: readonly Tracker[] = Object.freeze([]);

export interface Tracker {
  /** Chiave del catalogo (es. 'fructose') o 'c_…' per le voci scritte dall'utente. */
  id: string;
  /** Solo per le voci dell'utente: il nome come l'ha scritto. */
  name?: string;
  unit: string;
}

/** Catalogo: unità e nome per il modello (in inglese, come il resto delle istruzioni). */
export const TRACKER_CATALOGUE = {
  fructose: { unit: 'g', prompt: 'fructose' },
  addedSugar: { unit: 'g', prompt: 'added sugar' },
  caffeine: { unit: 'mg', prompt: 'caffeine' },
  alcohol: { unit: 'g', prompt: 'alcohol' },
  cholesterol: { unit: 'mg', prompt: 'cholesterol' },
  potassium: { unit: 'mg', prompt: 'potassium' },
  magnesium: { unit: 'mg', prompt: 'magnesium' },
  calcium: { unit: 'mg', prompt: 'calcium' },
  iron: { unit: 'mg', prompt: 'iron' },
  vitaminC: { unit: 'mg', prompt: 'vitamin C' },
  vitaminD: { unit: 'µg', prompt: 'vitamin D' },
  omega3: { unit: 'g', prompt: 'omega-3' },
  lactose: { unit: 'g', prompt: 'lactose' },
  purines: { unit: 'mg', prompt: 'purines' },
} as const;
export type CatalogueTracker = keyof typeof TRACKER_CATALOGUE;
export const CATALOGUE_IDS = Object.keys(TRACKER_CATALOGUE) as CatalogueTracker[];

export const isCatalogue = (id: string): id is CatalogueTracker => id in TRACKER_CATALOGUE;

export const catalogueTracker = (id: CatalogueTracker): Tracker => ({
  id,
  unit: TRACKER_CATALOGUE[id].unit,
});

/** Voce scritta dall'utente: id stabile dal nome. */
export function customTracker(name: string, unit: string): Tracker | null {
  const n = name.trim().slice(0, 40);
  const slug = n
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  if (!slug) return null;
  return { id: `c_${slug}`, name: n, unit: unit.trim().slice(0, 10) || 'g' };
}

/** Nome per le istruzioni al modello e per il coach. */
export const trackerPromptName = (t: Tracker) =>
  isCatalogue(t.id) ? TRACKER_CATALOGUE[t.id].prompt : (t.name ?? t.id);

/** Valori puliti: solo voci tracciate, numeri non negativi e plausibili, un decimale. */
export function cleanExtras(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-zA-Z0-9_]{1,48}$/.test(k)) continue;
    const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) continue;
    out[k] = Math.round(Math.min(n, 100000) * 10) / 10;
  }
  return Object.keys(out).length ? out : null;
}

/** Somma dei valori in più di più voci (un decimale). */
export function sumExtras(list: (Record<string, number> | null | undefined)[]) {
  const out: Record<string, number> = {};
  for (const e of list) for (const [k, v] of Object.entries(e ?? {})) out[k] = (out[k] ?? 0) + v;
  for (const k of Object.keys(out)) out[k] = Math.round(out[k]! * 10) / 10;
  return out;
}
