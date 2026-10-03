import { migrate } from '@/db/migrate';
import * as programRepository from '@/db/repositories/programRepository';
import { createTestDb } from '@/test/nodeSqliteDb';
import { parseGeneratedProgram } from '@/programs/generate';

import { executeTool } from '../tools';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({
  healthQueries: jest.requireActual('@/db/repositories/healthQueries'),
  healthDataRepository: jest.requireActual('@/db/repositories/healthDataRepository'),
  journalRepository: jest.requireActual('@/db/repositories/journalRepository'),
  programRepository: jest.requireActual('@/db/repositories/programRepository'),
}));

const call = (name: string, args: Record<string, unknown>) => ({ id: 'c', name, arguments: args });

describe('programmi dal coach', () => {
  it('create_program e update_program', async () => {
    const db = createTestDb();
    await migrate(db);
    const created = await executeTool(
      db,
      call('create_program', {
        title: 'Più passi',
        goal: '8000 passi al giorno',
        category: 'activity',
        duration_days: 21,
        items: [
          { title: 'Camminata di 20 minuti dopo pranzo', details: 'Anche a passo lento' },
          { title: 'Scale invece dell’ascensore' },
          { title: '' },
        ],
      }),
    );
    expect(created.isError).toBe(false);
    const { program_id } = JSON.parse(created.content) as { program_id: string };
    let p = (await programRepository.getProgram(db, program_id))!;
    expect(p).toMatchObject({ source: 'coach', category: 'activity', durationDays: 21 });
    expect(p.items).toHaveLength(2);

    const [first, second] = p.items as [
      programRepository.ProgramItem,
      programRepository.ProgramItem,
    ];
    const updated = await executeTool(
      db,
      call('update_program', {
        program_id,
        title: 'Più passi, ogni giorno',
        update_items: [{ item_id: first.id, title: 'Camminata di 30 minuti' }],
        remove_item_ids: [second.id, 'non-mio'],
        add_items: [{ title: 'Prenotare una visita sportiva', frequency: 'once' }],
      }),
    );
    expect(updated.isError).toBe(false);
    p = (await programRepository.getProgram(db, program_id))!;
    expect(p.title).toBe('Più passi, ogni giorno');
    expect(p.items.map((i) => [i.title, i.frequency])).toEqual([
      ['Camminata di 30 minuti', 'daily'],
      ['Prenotare una visita sportiva', 'once'],
    ]);

    const missing = await executeTool(db, call('update_program', { program_id: 'x' }));
    expect(missing.isError).toBe(true);
  });

  it('legge il programma generato in JSON (anche dentro un blocco di codice)', () => {
    const text =
      'Ecco:\n```json\n{"title":"Sonno","goal":"7 ore","category":"sleep","items":[{"title":"A letto alle 23","frequency":"daily"},"Niente caffè dopo le 14"]}\n```';
    expect(parseGeneratedProgram(text, 14)).toEqual({
      title: 'Sonno',
      goal: '7 ore',
      category: 'sleep',
      durationDays: 14,
      items: [
        { title: 'A letto alle 23', details: null, frequency: 'daily' },
        { title: 'Niente caffè dopo le 14', details: null, frequency: 'daily' },
      ],
    });
    expect(parseGeneratedProgram('niente json', null)).toBeNull();
    expect(parseGeneratedProgram('{"title":"x","items":[]}', null)).toBeNull();
  });
});
