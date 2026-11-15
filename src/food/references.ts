/**
 * Valori di riferimento giornalieri per adulti, usati nel riepilogo del diario e dal coach per
 * individuare possibili carenze o eccessi. Fonti (in `health/sources.ts`, tema "nutrition"):
 * - EFSA, Dietary Reference Values (PRI o AI per adulti): fibre, potassio, magnesio, calcio,
 *   ferro, vitamina C, vitamina D, omega-3 (ALA 0,5% dell'energia + 250 mg EPA+DHA);
 * - EFSA, sicurezza della caffeina (2015): fino a 400 mg al giorno per gli adulti;
 * - OMS: sodio sotto i 2 g, zuccheri liberi sotto il 10% dell'energia, grassi saturi sotto il 10%;
 * - OMS (2023): per l'alcol non esiste una quantità sicura.
 * Fruttosio, lattosio, purine, colesterolo e voci dell'utente non hanno un riferimento ufficiale.
 */

export type RefKind =
  /** Da raggiungere (fabbisogno). */
  | 'min'
  /** Da non superare. */
  | 'max'
  /** Meno è meglio, senza soglia sicura. */
  | 'avoid';

export interface NutrientRef {
  kind: RefKind;
  /** Valore al giorno nell'unità del nutriente (0 per 'avoid'). */
  value: number;
  unit: string;
  source: 'EFSA' | 'WHO';
}

export interface RefProfile {
  sex: 'female' | 'male' | 'other' | null;
  /** Età in anni (null = non nota: si usano i valori dell'adulto 25–50). */
  age: number | null;
  /** Calorie del giorno su cui calcolare i limiti in % dell'energia. */
  kcal: number | null;
}

/** Nutrienti con un riferimento: i tre "di base" del diario più quelli del catalogo. */
export const BASE_NUTRIENTS = ['fiber', 'saturatedFat', 'sodium'] as const;
export type BaseNutrient = (typeof BASE_NUTRIENTS)[number];

export const BASE_UNITS: Record<BaseNutrient, string> = {
  fiber: 'g',
  saturatedFat: 'g',
  sodium: 'mg',
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function ageFrom(birthDate: string | null, today: string): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return age >= 0 && age < 130 ? age : null;
}

/** Riferimento giornaliero per un nutriente (id del diario o del catalogo), o null se non c'è. */
export function nutrientReference(id: string, p: RefProfile): NutrientRef | null {
  const female = p.sex === 'female';
  // Sesso non indicato: il valore più alto dei due per i fabbisogni (prudente contro le carenze).
  const unknownSex = p.sex !== 'female' && p.sex !== 'male';
  const kcal = p.kcal && p.kcal >= 800 ? p.kcal : 2000;
  const age = p.age ?? 35;
  const efsa = (value: number, unit: string): NutrientRef => ({
    kind: 'min',
    value,
    unit,
    source: 'EFSA',
  });
  switch (id) {
    case 'fiber':
      return efsa(25, 'g');
    case 'potassium':
      return efsa(3500, 'mg');
    case 'magnesium':
      return efsa(female ? 300 : 350, 'mg');
    case 'calcium':
      return efsa(age < 25 ? 1000 : 950, 'mg');
    case 'iron':
      // Donne in età fertile 16 mg; dopo i 50 anni (in media dopo la menopausa) 11 mg come gli uomini.
      return efsa((female || unknownSex) && age < 50 ? 16 : 11, 'mg');
    case 'vitaminC':
      return efsa(female ? 95 : 110, 'mg');
    case 'vitaminD':
      return efsa(15, 'µg');
    case 'omega3':
      return efsa(r1((kcal * 0.005) / 9 + 0.25), 'g');
    case 'sodium':
      return { kind: 'max', value: 2000, unit: 'mg', source: 'WHO' };
    case 'saturatedFat':
      return { kind: 'max', value: Math.round((kcal * 0.1) / 9), unit: 'g', source: 'WHO' };
    case 'addedSugar':
      return { kind: 'max', value: Math.round((kcal * 0.1) / 4), unit: 'g', source: 'WHO' };
    case 'caffeine':
      return { kind: 'max', value: 400, unit: 'mg', source: 'EFSA' };
    case 'alcohol':
      return { kind: 'avoid', value: 0, unit: 'g', source: 'WHO' };
    default:
      return null;
  }
}

export type RefStatus = 'low' | 'below' | 'ok' | 'high' | 'none';

/**
 * Valutazione di una quantità rispetto al riferimento: sotto il 70% del fabbisogno = "low",
 * sotto il 100% = "below", oltre il limite = "high" (per l'alcol qualsiasi quantità).
 */
export function refStatus(value: number, ref: NutrientRef | null): RefStatus {
  if (!ref) return 'none';
  if (ref.kind === 'avoid') return value > 0 ? 'high' : 'ok';
  if (ref.kind === 'max') return value > ref.value ? 'high' : 'ok';
  const pct = value / ref.value;
  return pct < 0.7 ? 'low' : pct < 1 ? 'below' : 'ok';
}
