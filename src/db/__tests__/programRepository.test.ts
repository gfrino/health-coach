import { migrate } from '@/db/migrate';
import * as programRepository from '@/db/repositories/programRepository';
import { createTestDb } from '@/test/nodeSqliteDb';
import { adherence } from '@/programs/summary';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({
  programRepository: jest.requireActual('@/db/repositories/programRepository'),
}));

describe('programmi', () => {
  it('crea, spunta per giorno, modifica e conclude', async () => {
    const db = createTestDb();
    await migrate(db);
    const id = await programRepository.createProgram(db, {
      title: 'Dormire meglio',
      goal: 'Addormentarsi prima',
      category: 'sleep',
      startDay: '2026-10-01',
      durationDays: 14,
      items: [
        { title: 'Luci basse dopo le 21' },
        { title: 'Comprare tende oscuranti', frequency: 'once' },
      ],
    });
    let p = (await programRepository.getProgram(db, id))!;
    expect(p.items.map((i) => [i.title, i.frequency])).toEqual([
      ['Luci basse dopo le 21', 'daily'],
      ['Comprare tende oscuranti', 'once'],
    ]);
    const [daily, once] = p.items as [programRepository.ProgramItem, programRepository.ProgramItem];

    await programRepository.setItemDone(db, daily, '2026-10-01', true);
    await programRepository.setItemDone(db, once, '2026-10-01', true);
    // Il giorno dopo: la quotidiana è da rifare, quella "una volta" resta fatta.
    const next = await programRepository.doneItemIds(db, p.items, '2026-10-02');
    expect([...next]).toEqual([once.id]);
    await programRepository.setItemDone(db, once, '2026-10-02', false);
    expect((await programRepository.doneItemIds(db, p.items, '2026-10-01')).has(once.id)).toBe(
      false,
    );

    await programRepository.updateItem(db, daily.id, { title: 'Luci basse dopo le 20:30' });
    await programRepository.addItem(db, id, { title: 'A letto alle 22:45' });
    await programRepository.removeItem(db, once.id);
    await programRepository.updateProgram(db, id, { status: 'completed' });
    p = (await programRepository.getProgram(db, id))!;
    expect(p.status).toBe('completed');
    expect(p.items.map((i) => i.title)).toEqual(['Luci basse dopo le 20:30', 'A letto alle 22:45']);
    expect(await programRepository.listPrograms(db, 'active')).toEqual([]);

    await programRepository.deleteProgram(db, id);
    expect(await programRepository.getProgram(db, id)).toBeNull();
  });

  it('giorno del programma e costanza degli ultimi 7 giorni', () => {
    const p = {
      startDay: '2026-09-28',
      items: [
        { id: 'a', frequency: 'daily' },
        { id: 'b', frequency: 'daily' },
      ],
    } as programRepository.Program;
    expect(programRepository.programDay(p, '2026-09-28')).toBe(1);
    expect(programRepository.programDay(p, '2026-10-03')).toBe(6);
    // 5 giorni passati (28/9–2/10) × 2 azioni = 10; fatte 4.
    const checks = [
      { itemId: 'a', day: '2026-09-28' },
      { itemId: 'a', day: '2026-09-29' },
      { itemId: 'b', day: '2026-09-29' },
      { itemId: 'a', day: '2026-10-02' },
      { itemId: 'a', day: '2026-10-03' }, // oggi: non conta
    ];
    expect(adherence(p, checks, '2026-10-03')).toBe(40);
    expect(adherence(p, [], '2026-09-28')).toBeNull();
  });
});
