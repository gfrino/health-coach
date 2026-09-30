/** Scala 1–5 per umore ed energia (emoji: leggibili a colpo d'occhio, senza testo). */
export const MOOD_EMOJI = ['😞', '🙁', '😐', '🙂', '😄'] as const;
export const ENERGY_EMOJI = ['🪫', '😴', '🙂', '💪', '⚡'] as const;

export const emojiFor = (scale: readonly string[], v: number | null) =>
  v == null ? null : (scale[Math.min(5, Math.max(1, v)) - 1] ?? null);

/** "mal di testa, nausea ,  " → ["mal di testa", "nausea"] */
export const splitList = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
