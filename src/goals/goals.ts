import de from '@/i18n/locales/de.json';
import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import it from '@/i18n/locales/it.json';

/** Obiettivi che l'utente sceglie nel profilo (chiavi salvate nel DB). */
export const GOALS = [
  'loseWeight',
  'gainWeight',
  'gainMuscle',
  'sleepBetter',
  'moreEnergy',
  'reduceStress',
  'fitness',
  'heartHealth',
  'eatBetter',
  'manageCondition',
] as const;
export type GoalKey = (typeof GOALS)[number];

export const isGoalKey = (g: string): g is GoalKey => (GOALS as readonly string[]).includes(g);

/** Testo per il coach (in inglese, come il resto del prompt). */
export const GOAL_PROMPTS: Record<GoalKey, string> = {
  loseWeight: 'lose weight',
  gainWeight: 'gain weight',
  gainMuscle: 'build muscle',
  sleepBetter: 'sleep better',
  moreEnergy: 'have more energy',
  reduceStress: 'reduce stress',
  fitness: 'improve fitness',
  heartHealth: 'heart health',
  eatBetter: 'eat better',
  manageCondition: 'manage a chronic condition',
};

/** Testo tradotto → chiave, in tutte le lingue dell'app (i profili vecchi salvavano il testo). */
const BY_LABEL = new Map<string, GoalKey>(
  [it, en, de, fr].flatMap((l) =>
    GOALS.map((g) => [l.profileSetup.goals[g].trim().toLowerCase(), g] as [string, GoalKey]),
  ),
);

/** Chiavi senza doppioni; i testi non riconosciuti (obiettivi liberi) restano come sono. */
export function normalizeGoals(raw: readonly string[]): string[] {
  const out: string[] = [];
  for (const g of raw) {
    const key = isGoalKey(g) ? g : (BY_LABEL.get(g.trim().toLowerCase()) ?? g.trim());
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Obiettivi per il prompt del coach. */
export const goalsForPrompt = (goals: readonly string[]) =>
  goals.map((g) => (isGoalKey(g) ? GOAL_PROMPTS[g] : g));
