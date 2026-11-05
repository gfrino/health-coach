import { asMeal, cleanLines, type RecipeInput } from '@/db/repositories/recipeRepository';

/**
 * Ricetta generata dall'AI scelta (anche quella del telefono): formato a righe, robusto anche
 * per i modelli piccoli. Il prompt di sistema del coach contiene allergie, dieta e gusti.
 *
 * Priorità: la richiesta dell'utente viene prima della dieta scelta (se chiede riso con una dieta
 * chetogenica, il riso resta e la descrizione lo dice); allergie, intolleranze e farmaci restano
 * invece vincoli assoluti: ciò che viene tolto per questi motivi va in WARNING, che l'app mostra
 * all'utente. Il modello elenca in REQUESTED gli ingredienti nominati, così l'app può verificare
 * che ci siano davvero e, se ne manca uno senza avviso, chiedere di nuovo.
 */
export function recipeInstruction(opts: {
  wish: string;
  meal: string;
  maxMinutes: number | null;
  servings: number;
  /** Ingredienti chiesti ma assenti nel primo tentativo. */
  missing?: string[];
}): string {
  const wish = opts.wish.trim();
  return [
    'Create one recipe for me.',
    wish
      ? `MY REQUEST (most important): ${wish}\nBuild the recipe around this request. Every ingredient I name MUST appear in INGREDIENTS and be used in STEPS; do not replace it with something else.`
      : null,
    opts.missing?.length
      ? `Your previous recipe left out: ${opts.missing.join(', ')}. Include them this time.`
      : null,
    `Meal: ${opts.meal}. Servings: ${opts.servings}.`,
    opts.maxMinutes ? `Ready in at most ${opts.maxMinutes} minutes.` : null,
    'Hard limits: never use anything I am allergic or intolerant to, and respect my conditions and medications. If I ask for one of those, leave it out and tell me clearly in WARNING (what you left out and why, e.g. my allergy).',
    'My diet, approach and tastes are preferences: follow them for the rest of the recipe, but my request comes first. If my request does not fit my diet (e.g. rice on a keto diet), still use what I asked for and add a short note in DESCRIPTION.',
    'Prefer ingredients that support my goals and lab results. Use metric quantities. Write in my language.',
    'Reply in EXACTLY this format, nothing else:',
    'TITLE: …',
    'DESCRIPTION: one sentence on why it suits me',
    'REQUESTED: the ingredients I named in my request, comma separated, in my language (empty if none)',
    'WARNING: one sentence telling me what I asked for that you left out because of my allergies, intolerances, conditions or medications, and why (empty if nothing was left out)',
    'MEAL: breakfast|lunch|dinner|snack|dessert',
    'SERVINGS: number',
    'TIME: total minutes',
    'TAGS: up to 4 short tags, comma separated',
    'INGREDIENTS:',
    '- quantity ingredient (one per line)',
    'STEPS:',
    '1. step (one per line)',
    wish ? `Remember: the recipe must contain what I asked for: ${wish}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Ingredienti richiesti (riga REQUESTED) che non compaiono tra gli ingredienti della ricetta.
 * Confronto tollerante: accenti ignorati e radice della parola più lunga ("semi di chia" → "chia",
 * "pomodori" ↔ "pomodoro").
 */
export function missingRequested(
  recipe: Pick<RecipeInput, 'ingredients'> & { warning?: string | null },
  requested: string[],
) {
  const text = fold((recipe.ingredients ?? []).join(' \n '));
  // Tolti di proposito (allergia, patologia…) e segnalati nell'avviso: non si richiede di nuovo.
  const warned = fold(recipe.warning ?? '');
  return requested.filter((item) => {
    const words = fold(item)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3);
    if (!words.length) return false;
    const key = words.reduce((a, b) => (b.length > a.length ? b : a));
    const stem = key.length > 5 ? key.slice(0, key.length - 2) : key;
    return !text.includes(stem) && !warned.includes(stem);
  });
}

export type ParsedRecipe = RecipeInput & {
  requested: string[];
  /** Cosa è stato tolto per allergie, intolleranze, patologie o farmaci, e perché. */
  warning: string | null;
};

export function parseRecipe(text: string): ParsedRecipe | null {
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
  const ingredients = cleanLines(block('INGREDIENTS', ['STEPS', 'TAGS', 'TIME', 'REQUESTED']));
  const steps = cleanLines(block('STEPS', ['INGREDIENTS', 'TAGS', 'NOTES', 'REQUESTED']), 40, 600);
  if (!title || !ingredients.length || !steps.length) return null;
  const num = (s: string) => {
    const m = /\d+/.exec(s);
    return m ? Number(m[0]) : null;
  };
  const list = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x && !/^(none|nessuno|keine|aucun|-|—)$/i.test(x));
  return {
    title,
    description: field('DESCRIPTION') || null,
    meal: asMeal(field('MEAL').toLowerCase()),
    servings: num(field('SERVINGS')),
    prepMinutes: num(field('TIME')),
    tags: list(field('TAGS')),
    ingredients,
    steps,
    requested: list(field('REQUESTED')),
    warning: /^(none|nessuno|nessuna|keine|aucun|aucune|-|—)?\.?$/i.test(field('WARNING'))
      ? null
      : field('WARNING'),
  };
}
