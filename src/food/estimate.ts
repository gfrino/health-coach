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
}

export function estimateInstruction(language: string, text: string): string {
  return [
    'Estimate the nutrition of what the user ate. Reply in EXACTLY this format, one line per food, nothing else:',
    'name | quantity | kcal | protein g | carbs g | fat g',
    `- name: short, in ${language}, starting with a capital letter.`,
    '- quantity: the amount as the user said it; if they gave none, a typical portion you assume (e.g. "1 slice, 30 g").',
    '- Numbers only (no units), with a dot for decimals and no thousands separators. Use typical values for that food and quantity.',
    '- One line for EVERY food and EVERY drink the user mentions (e.g. a coffee or a juice gets its own line). Do not split a single dish into its ingredients.',
    '- If the text mentions no food or drink, reply: NONE',
    '',
    `What the user ate: ${text.trim().slice(0, 600)}`,
  ].join('\n');
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
    const calories = n(2);
    if (calories === null) continue;
    out.push({
      name: parts[0].slice(0, 120),
      quantity: parts[1] || null,
      calories: Math.round(calories),
      protein: n(3),
      carbs: n(4),
      fat: n(5),
    });
    if (out.length >= 20) break;
  }
  return out;
}

export async function estimateFood(settings: AppSettings, text: string): Promise<FoodEstimate[]> {
  // Import pigro: evita il ciclo chatEngine → … → food.
  const { resolveAI } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/coach/chatEngine') as typeof import('@/coach/chatEngine');
  const { provider, model, apiKey } = await resolveAI(settings);
  const language = LANGUAGE_NAMES[resolveLanguage(settings.language, deviceLanguageCodes())];
  const res = await provider.sendMessage(
    { system: 'You are a precise nutrition assistant. You estimate, you never refuse.' },
    [{ role: 'user', content: estimateInstruction(language, text) }],
    { apiKey, model, quick: true, maxOutputTokens: 2000 },
  );
  if (__DEV__)
    console.warn(
      `[cibo] stima ${provider.id} per ${JSON.stringify(text)}: ${JSON.stringify(res.text)}`,
    );
  return parseFoodEstimate(res.text);
}
