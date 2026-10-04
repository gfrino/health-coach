import { migrate } from '@/db/migrate';
import * as conversationRepository from '@/db/repositories/conversationRepository';
import * as memoryRepository from '@/db/repositories/memoryRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import { getDefaultSettings } from '@/config/settingsSchema';
import { composeSystemPrompt } from '../context';
import { parseSummary } from '../memory';
import { executeTool } from '../tools';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({
  memoryRepository: jest.requireActual('@/db/repositories/memoryRepository'),
}));
jest.mock('@/i18n', () => ({ resolveLanguage: () => 'it', deviceLanguageCodes: () => ['it'] }));

describe('memoria del coach', () => {
  it('legge riassunto e fatti dalla risposta a righe', () => {
    expect(
      parseSummary(
        'SUMMARY: Ha chiesto come dormire meglio; consigliato cena più presto.\n- FACT: Lavora su turni di notte\n**FACT:** "Non mangia pesce"\nFACT: none',
      ),
    ).toEqual({
      summary: 'Ha chiesto come dormire meglio; consigliato cena più presto.',
      facts: ['Lavora su turni di notte', 'Non mangia pesce'],
    });
    expect(parseSummary('FACT: none')).toEqual({ summary: null, facts: [] });
  });

  it('salva fatti senza doppioni, li aggiorna e trova le conversazioni da riassumere', async () => {
    const db = createTestDb();
    await migrate(db);
    const a = await memoryRepository.addFact(db, 'Lavora su turni di notte');
    const b = await memoryRepository.addFact(db, 'lavora su turni di notte!');
    expect(b).toBe(a);
    expect(await memoryRepository.listFacts(db)).toHaveLength(1);

    const conv = await conversationRepository.createConversation(db);
    await conversationRepository.addMessage(db, {
      conversationId: conv,
      role: 'user',
      content: 'Ciao',
    });
    const reply = await conversationRepository.addMessage(db, {
      conversationId: conv,
      role: 'assistant',
      content: 'Ciao!',
    });
    // Appena scritta: non ancora "ferma".
    expect(await memoryRepository.conversationsToSummarize(db, 20 * 60 * 1000)).toEqual([]);
    expect(await memoryRepository.conversationsToSummarize(db, -1000)).toEqual([
      { id: conv, lastMessageId: reply.id },
    ]);
    await memoryRepository.saveSummary(db, conv, 'Saluti.', reply.id);
    expect(await memoryRepository.conversationsToSummarize(db, -1000)).toEqual([]);

    // Tool remember: salva, aggiorna, elimina.
    const call = (args: Record<string, unknown>) =>
      executeTool(db, { id: 'c', name: 'remember', arguments: args });
    const saved = JSON.parse((await call({ fact: 'Porta a spasso il cane alle 7' })).content);
    expect(saved.saved).toBe(true);
    await call({ fact_id: saved.fact_id, fact: 'Porta a spasso il cane alle 6:30' });
    expect((await memoryRepository.listFacts(db)).map((f) => f.text)).toContain(
      'Porta a spasso il cane alle 6:30',
    );
    await call({ fact_id: saved.fact_id, delete: true });
    expect(await memoryRepository.listFacts(db)).toHaveLength(1);
    expect((await call({ fact_id: 'nope', fact: 'x' })).isError).toBe(true);
  });

  it("il prompt chiede consigli personali e, con pochi ricordi, una domanda per conoscere l'utente", () => {
    const now = new Date(2026, 9, 4, 8);
    const coach = getDefaultSettings().coach;
    const few = composeSystemPrompt({
      coach,
      language: 'it',
      now,
      memoryFacts: [{ id: 'f1', text: 'Lavora su turni' }],
    });
    expect(few).toContain('[f1] Lavora su turni');
    expect(few).toContain('Never give textbook advice');
    expect(few).toContain('GETTING TO KNOW THE USER');
    expect(few).toContain('MEMORY');
    const many = composeSystemPrompt({
      coach,
      language: 'it',
      now,
      compact: true,
      memoryFacts: Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, text: `Fatto ${i}` })),
    });
    expect(many).not.toContain('GETTING TO KNOW THE USER');
    expect(many).not.toContain('[f0]');
  });
});
