import { migrate } from '@/db/migrate';
import { localIsoDate } from '@/lib/dates';
import * as journalRepository from '@/db/repositories/journalRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import { executeTool } from '../tools';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({
  healthQueries: jest.requireActual('@/db/repositories/healthQueries'),
  healthDataRepository: jest.requireActual('@/db/repositories/healthDataRepository'),
  journalRepository: jest.requireActual('@/db/repositories/journalRepository'),
}));

const call = (args: Record<string, unknown>) => ({
  id: 'c',
  name: 'save_journal_entry',
  arguments: args,
});

describe('save_journal_entry', () => {
  it('crea una voce del coach e poi la aggiorna', async () => {
    const db = createTestDb();
    await migrate(db);

    const created = await executeTool(
      db,
      call({ mood: 2, symptoms: ['mal di testa'], text: 'Dormito male' }),
    );
    expect(created.isError).toBe(false);
    const { entry_id } = JSON.parse(created.content) as { entry_id: string };

    const updated = await executeTool(db, call({ entry_id, energy: 4 }));
    expect(updated.isError).toBe(false);

    const e = await journalRepository.getEntry(db, entry_id);
    expect(e).toMatchObject({
      mood: 2,
      energy: 4,
      symptoms: ['mal di testa'],
      text: 'Dormito male',
      source: 'coach',
    });

    const listed = await executeTool(db, {
      id: 'g',
      name: 'get_journal',
      arguments: { from: localIsoDate(new Date()), to: localIsoDate(new Date()) },
    });
    expect(JSON.parse(listed.content)[0]).toMatchObject({ id: entry_id, written_by: 'coach' });
  });

  it('rifiuta voci vuote, valori fuori scala e id inesistenti', async () => {
    const db = createTestDb();
    await migrate(db);
    expect((await executeTool(db, call({}))).isError).toBe(true);
    expect((await executeTool(db, call({ mood: 9 }))).isError).toBe(true);
    expect((await executeTool(db, call({ entry_id: 'nope', mood: 3 }))).isError).toBe(true);
  });

  it('la data indicata diventa il giorno della voce', async () => {
    const db = createTestDb();
    await migrate(db);
    const res = await executeTool(db, call({ date: '2026-09-20', text: 'Corsa 10 km' }));
    const { entry_id } = JSON.parse(res.content) as { entry_id: string };
    const e = await journalRepository.getEntry(db, entry_id);
    expect(new Date(e!.entryAt).getDate()).toBe(20);
  });
});
