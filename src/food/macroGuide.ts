import type { NutritionApproach } from '@/coach/diets';

/**
 * Riferimenti per i riquadri dei macronutrienti secondo la dieta scelta nelle impostazioni del coach.
 * - Senza dieta particolare (e diete senza numeri propri): EFSA, carboidrati 45–60% e grassi 20–35%
 *   dell'energia; zuccheri totali fino a 90 g (assunzione di riferimento UE).
 * - Mediterranea: grassi fino a circa il 40% (soprattutto olio extravergine, come in PREDIMED).
 * - Chetogenica e Healthy Keto: carboidrati netti (carboidrati meno fibre) sotto i 50 g; carnivora 20 g.
 * - Low-carb: 50–130 g di carboidrati.
 * - In queste diete (e nella paleo) lo zucchero va ridotto al minimo: limite OMS più severo, 5% dell'energia.
 * - Chetogenica, Healthy Keto, carnivora e low-carb: i grassi sono la fonte di energia e si mangiano fino a
 *   sazietà, non c'è un tetto; la barra indica l'energia che resta tolte proteine e carboidrati.
 * I numeri delle diete sono quelli delle schede in `coach/diets.ts`, così riquadri e coach dicono lo stesso.
 */

export interface MacroGuide {
  carbs: {
    /** Carboidrati netti (meno fibre) invece dei totali. */
    net: boolean;
    min: number | null;
    max: number;
    /** Oltre il massimo la barra è rossa (diete in cui è un limite vero, come la chetosi). */
    strict: boolean;
    basis: 'efsa' | 'lowCarb' | 'keto' | 'carnivore';
  };
  sugar: { max: number; basis: 'eu' | 'who5' };
  fat: {
    /** Tetto in grammi, null se i grassi si mangiano fino a sazietà. */
    max: number | null;
    /** Quantità indicativa per la barra quando non c'è un tetto. */
    target: number | null;
    basis: 'efsa' | 'mediterranean' | 'fuel';
  };
}

const KETO: readonly NutritionApproach[] = ['keto', 'healthyKeto'];
const LOW_SUGAR: readonly NutritionApproach[] = [
  'keto',
  'healthyKeto',
  'carnivore',
  'lowCarb',
  'paleo',
];

export function macroGuide(
  approach: NutritionApproach,
  kcal: number | null,
  proteinGrams: number | null,
): MacroGuide {
  const energy = kcal && kcal >= 800 ? kcal : 2000;
  const protein = proteinGrams ?? Math.round((energy * 0.2) / 4);
  const fuel = (carbs: number) => Math.max(0, Math.round((energy - protein * 4 - carbs * 4) / 9));
  const sugar: MacroGuide['sugar'] = LOW_SUGAR.includes(approach)
    ? { max: Math.round((energy * 0.05) / 4), basis: 'who5' }
    : { max: 90, basis: 'eu' };

  if (KETO.includes(approach) || approach === 'carnivore') {
    const max = approach === 'carnivore' ? 20 : 50;
    return {
      carbs: {
        net: true,
        min: null,
        max,
        strict: true,
        basis: approach === 'carnivore' ? 'carnivore' : 'keto',
      },
      sugar,
      fat: { max: null, target: fuel(max), basis: 'fuel' },
    };
  }
  if (approach === 'lowCarb') {
    return {
      carbs: { net: false, min: 50, max: 130, strict: false, basis: 'lowCarb' },
      sugar,
      fat: { max: null, target: fuel(90), basis: 'fuel' },
    };
  }
  const efsaCarbs = {
    net: false,
    min: Math.round((energy * 0.45) / 4),
    max: Math.round((energy * 0.6) / 4),
    strict: false,
    basis: 'efsa' as const,
  };
  if (approach === 'mediterranean') {
    return {
      carbs: efsaCarbs,
      sugar,
      fat: { max: Math.round((energy * 0.4) / 9), target: null, basis: 'mediterranean' },
    };
  }
  return {
    carbs: efsaCarbs,
    sugar,
    fat: { max: Math.round((energy * 0.35) / 9), target: null, basis: 'efsa' },
  };
}
