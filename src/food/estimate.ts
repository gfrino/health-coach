import type { ImagePart } from '@/ai/types';
import type { AppSettings } from '@/config/settingsSchema';
import { deviceLanguageCodes, resolveLanguage } from '@/i18n';
import { parseNumber } from '@/records/labExtraction';

/**
 * Stima di calorie e macronutrienti da una frase ("2 uova e una fetta di pane") con l'AI scelta
 * dall'utente, anche quella del telefono: formato a righe, corto e facile da leggere.
 * Sono stime: l'utente le controlla e le corregge prima di salvarle.
 */

const LANGUAGE_NAMES = { it: 'Italian', en: 'English', de: 'German', fr: 'French' } as const;

export interface FoodEstimate {
  name: string;
  quantity: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  saturatedFat: number | null;
  /** Milligrammi. */
  sodium: number | null;
}

export function estimateInstruction(language: string, text: string, fromPhoto = false): string {
  return [
    fromPhoto
      ? 'Look at the photo of what the user ate. Identify each food and drink you can see and estimate its portion from the photo (plate size, typical servings). Reply in EXACTLY this format, one line per food, nothing else:'
      : 'Estimate the nutrition of what the user ate. Reply in EXACTLY this format, one line per food, nothing else:',
    'name | quantity | kcal | protein g | carbs g | fat g | fiber g | sugar g | saturated fat g | sodium mg',
    `- name: the food itself (e.g. "Scrambled eggs"), short, in ${language}, starting with a capital letter. Never a word like "today" or "lunch".`,
    '- quantity: the amount as the user said it; if they gave none, a typical portion you assume (e.g. "1 slice, 30 g").',
    '- Numbers only (no units), with a dot for decimals and no thousands separators. Use typical values for that food and quantity.',
    '- One line for EVERY food and EVERY drink the user mentions (e.g. a coffee or a juice gets its own line). Do not split a single dish into its ingredients.',
    fromPhoto
      ? '- If the photo shows no food or drink, reply: NONE'
      : '- If the text mentions no food or drink, reply: NONE',
    '',
    fromPhoto
      ? text.trim()
        ? `The user added this note, which wins over what you see: ${text.trim().slice(0, 600)}`
        : ''
      : `What the user ate: ${text.trim().slice(0, 600)}`,
  ]
    .join('\n')
    .trim();
}

/** Numero da una cella: "182 kcal", "~90", "circa 12,5 g", "80-100" (media). */
function cellNumber(cell: string | undefined): number | null {
  if (!cell) return null;
  const range = /(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/.exec(cell);
  if (range) {
    const a = parseNumber(range[1]);
    const b = parseNumber(range[2]);
    if (a !== null && b !== null) return (a + b) / 2;
  }
  const m = /\d+(?:[.,']\d+)*/.exec(cell);
  const v = m ? parseNumber(m[0]) : null;
  return v !== null && v >= 0 ? v : null;
}

export function parseFoodEstimate(reply: string): FoodEstimate[] {
  const out: FoodEstimate[] = [];
  for (const raw of reply.split('\n')) {
    const parts = raw
      .replace(/^[\s*•-]+/, '')
      .replace(/\*\*/g, '')
      .split('|')
      .map((p) => p.trim());
    if (parts.length < 3 || !parts[0] || /^name$/i.test(parts[0])) continue;
    const n = (i: number) => cellNumber(parts[i]);
    let calories = n(2);
    if (calories === null) continue;
    // Coerenza con i macro (4 kcal/g proteine e carboidrati, 9 kcal/g grassi): i modelli piccoli
    // a volte scrivono un numero sbagliato nella colonna delle calorie (es. 18 per due uova).
    const fromMacros = 4 * (n(3) ?? 0) + 4 * (n(4) ?? 0) + 9 * (n(5) ?? 0);
    if (fromMacros >= 40 && (calories < fromMacros * 0.6 || calories > fromMacros * 1.7))
      calories = fromMacros;
    out.push({
      name: parts[0].slice(0, 120),
      quantity: parts[1] || null,
      calories: Math.round(calories),
      protein: n(3),
      carbs: n(4),
      fat: n(5),
      fiber: n(6),
      sugar: n(7),
      saturatedFat: n(8),
      sodium: n(9),
    });
    if (out.length >= 20) break;
  }
  return out;
}

/** L'AI scelta sa guardare le foto? (L'AI del telefono no: serve un servizio online.) */
export async function canReadFoodPhotos(settings: AppSettings): Promise<boolean> {
  if (!settings.ai.provider || !settings.ai.model) return false;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getProvider } = require('@/ai/registry') as typeof import('@/ai/registry');
  return getProvider(settings.ai.provider).supportsVision(settings.ai.model);
}

export async function estimateFood(
  settings: AppSettings,
  text: string,
  photo?: ImagePart,
): Promise<FoodEstimate[]> {
  // Import pigro: evita il ciclo chatEngine → … → food.
  const { resolveAI } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/coach/chatEngine') as typeof import('@/coach/chatEngine');
  const { provider, model, apiKey } = await resolveAI(settings);
  const language = LANGUAGE_NAMES[resolveLanguage(settings.language, deviceLanguageCodes())];
  const res = await provider.sendMessage(
    { system: 'You are a precise nutrition assistant. You estimate, you never refuse.' },
    [
      {
        role: 'user',
        content: estimateInstruction(language, text, !!photo),
        images: photo ? [photo] : undefined,
      },
    ],
    { apiKey, model, quick: true, maxOutputTokens: 2000 },
  );
  if (__DEV__)
    console.warn(
      `[cibo] stima ${provider.id} per ${JSON.stringify(text)}: ${JSON.stringify(res.text)}`,
    );
  return parseFoodEstimate(res.text);
}
