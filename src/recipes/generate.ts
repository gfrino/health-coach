import { asMeal, cleanLines, type RecipeInput } from '@/db/repositories/recipeRepository';

/**
 * Ricetta generata dall'AI scelta (anche quella del telefono): formato a righe, robusto anche
 * per i modelli piccoli. Il prompt di sistema del coach contiene allergie, dieta e gusti.
 */
export function recipeInstruction(opts: {
  wish: string;
  meal: string;
  maxMinutes: number | null;
  servings: number;
}): string {
  return [
    'Create one recipe for me.',
    opts.wish.trim() ? `What I would like: ${opts.wish.trim()}` : null,
    `Meal: ${opts.meal}. Servings: ${opts.servings}.`,
    opts.maxMinutes ? `Ready in at most ${opts.maxMinutes} minutes.` : null,
    'It MUST respect my allergies and intolerances, my diet and approach, my conditions and medications, and what you remember about my tastes. Prefer ingredients that support my goals and lab results. Use metric quantities. Write in my language.',
    'Reply in EXACTLY this format, nothing else:',
    'TITLE: …',
    'DESCRIPTION: one sentence on why it suits me',
    'MEAL: breakfast|lunch|dinner|snack|dessert',
    'SERVINGS: number',
    'TIME: total minutes',
    'TAGS: up to 4 short tags, comma separated',
    'INGREDIENTS:',
    '- quantity ingredient (one per line)',
    'STEPS:',
    '1. step (one per line)',
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseRecipe(text: string): RecipeInput | null {
  const lines = text.split('\n').map((l) => l.replace(/\*\*/g, '').trim());
  const field = (key: string) => {
    const l = lines.find((x) => new RegExp(`^${key}\\s*:`, 'i').test(x));
    return l ? l.replace(new RegExp(`^${key}\\s*:\\s*`, 'i'), '').trim() : '';
  };
  const block = (key: string, next: string[]) => {
    const start = lines.findIndex((x) => new RegExp(`^${key}\\s*:`, 'i').test(x));
    if (start < 0) return [];
    const out: string[] = [];
    const inline = lines[start]!.replace(new RegExp(`^${key}\\s*:\\s*`, 'i'), '');
    if (inline) out.push(inline);
    for (const l of lines.slice(start + 1)) {
      if (next.some((n) => new RegExp(`^${n}\\s*:`, 'i').test(l))) break;
      if (l) out.push(l);
    }
    return out;
  };
  const title = field('TITLE').slice(0, 120);
  const ingredients = cleanLines(block('INGREDIENTS', ['STEPS', 'TAGS', 'TIME']));
  const steps = cleanLines(block('STEPS', ['INGREDIENTS', 'TAGS', 'NOTES']), 40, 600);
  if (!title || !ingredients.length || !steps.length) return null;
  const num = (s: string) => {
    const m = /\d+/.exec(s);
    return m ? Number(m[0]) : null;
  };
  return {
    title,
    description: field('DESCRIPTION') || null,
    meal: asMeal(field('MEAL').toLowerCase()),
    servings: num(field('SERVINGS')),
    prepMinutes: num(field('TIME')),
    tags: field('TAGS')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    ingredients,
    steps,
  };
}
