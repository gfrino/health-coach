import type { AppSettings } from '@/config/settingsSchema';
import { conversationRepository, getDb, memoryRepository } from '@/db';
import { deviceLanguageCodes, resolveLanguage } from '@/i18n';

/**
 * Memoria del coach: quando una conversazione è ferma da un po', l'AI scelta dall'utente ne
 * scrive un breve riassunto ed estrae i fatti duraturi detti dall'utente (abitudini, lavoro,
 * preferenze, cosa ha funzionato). Funziona con tutti i provider, anche quello sul telefono
 * (formato a righe, nessun tool). Tutto resta nel DB cifrato.
 */

const LANGUAGE_NAMES = { it: 'Italian', en: 'English', de: 'German', fr: 'French' } as const;
/** Una conversazione si riassume quando è ferma da almeno 20 minuti. */
const IDLE_MS = 20 * 60 * 1000;
const MAX_TRANSCRIPT = 8000;
const MAX_TRANSCRIPT_DEVICE = 3000;
const MAX_FACTS_PER_CONVERSATION = 6;

export function summaryInstruction(language: string): string {
  return [
    'Below is a conversation between the user and you, their health coach. Read it and reply in EXACTLY this format, nothing else:',
    `SUMMARY: 1–3 sentences in ${language}: what the user asked or told you, and the main advice you gave.`,
    `FACT: one lasting fact about the user per line, in ${language}, written in the third person (e.g. "Works night shifts", "Does not like fish", "Walks the dog every morning at 7", "Magnesium in the evening did not help their sleep").`,
    'Facts are things the user said about their life: routine, work and schedule, family and pets, food likes and dislikes, sports, what they tried and whether it worked, personal motivations. Not health measurements (the app already has them) and not your advice.',
    'If there are no lasting facts, write: FACT: none',
  ].join('\n');
}

export interface ParsedSummary {
  summary: string | null;
  facts: string[];
}

export function parseSummary(text: string): ParsedSummary {
  let summary: string | null = null;
  const facts: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^[\s*•-]+/, '').replace(/\*\*/g, '');
    const s = /^SUMMARY\s*:\s*(.+)$/i.exec(line);
    if (s?.[1]) summary = s[1].trim();
    const f = /^FACT\s*:\s*(.+)$/i.exec(line);
    const fact = f?.[1]?.trim().replace(/^["“]|["”]$/g, '');
    if (fact && !/^(none|nessuno|keine|aucun)\.?$/i.test(fact) && fact.length > 3) facts.push(fact);
  }
  return { summary, facts: facts.slice(0, MAX_FACTS_PER_CONVERSATION) };
}

let running = false;

/** Riassume le conversazioni concluse (al massimo 3 per volta). Silenzioso in caso di errore. */
export async function summarizePendingConversations(settings: AppSettings): Promise<number> {
  if (running || !settings.ai.provider || !settings.ai.model) return 0;
  running = true;
  let done = 0;
  try {
    const db = await getDb();
    const pending = await memoryRepository.conversationsToSummarize(db, IDLE_MS);
    if (!pending.length) return 0;
    // Import pigro: evita il ciclo chatEngine → memory.
    const { resolveAI } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./chatEngine') as typeof import('./chatEngine');
    const { provider, model, apiKey } = await resolveAI(settings);
    const max = provider.id === 'device' ? MAX_TRANSCRIPT_DEVICE : MAX_TRANSCRIPT;
    const language = LANGUAGE_NAMES[resolveLanguage(settings.language, deviceLanguageCodes())];

    for (const c of pending) {
      const messages = (await conversationRepository.listMessages(db, c.id)).filter(
        (m) =>
          m.status === 'complete' && (m.role === 'user' || m.role === 'assistant') && m.content,
      );
      // Le ultime battute contano di più: si tiene la parte finale.
      let transcript = messages
        .map((m) => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content.trim()}`)
        .join('\n\n');
      if (transcript.length > max) transcript = `…${transcript.slice(-max)}`;
      try {
        const res = await provider.sendMessage(
          { system: 'You keep concise, accurate notes about a coaching conversation.' },
          [{ role: 'user', content: `${summaryInstruction(language)}\n\n---\n${transcript}` }],
          { apiKey, model },
        );
        const parsed = parseSummary(res.text);
        if (!parsed.summary && !parsed.facts.length) continue;
        if (parsed.summary)
          await memoryRepository.saveSummary(db, c.id, parsed.summary, c.lastMessageId);
        else await memoryRepository.saveSummary(db, c.id, '—', c.lastMessageId);
        for (const f of parsed.facts) await memoryRepository.addFact(db, f, c.id);
        done++;
      } catch {
        // Riprova alla volta successiva.
      }
    }
  } catch {
    // Nessuna AI disponibile o DB non pronto: si riprova più tardi.
  } finally {
    running = false;
  }
  return done;
}
