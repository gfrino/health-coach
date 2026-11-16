import { migrate } from '@/db/migrate';
import * as healthDataRepository from '@/db/repositories/healthDataRepository';
import * as programRepository from '@/db/repositories/programRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import { autoCheckPrograms } from '../autoCheck';
import {
  addDays,
  buildWeek,
  dayInProgram,
  defaultProgramDay,
  lastProgramDay,
  shiftWeek,
  weekStart,
} from '../week';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `w-${++mockSeq}` }));
jest.mock('@/db', () => ({
  programRepository: jest.requireActual('@/db/repositories/programRepository'),
  healthDataRepository: jest.requireActual('@/db/repositories/healthDataRepository'),
  healthQueries: jest.requireActual('@/db/repositories/healthQueries'),
}));

const prog = { startDay: '2026-11-05', durationDays: 14 };

describe('settimana dei programmi', () => {
  it('calcola lunedì, giorni del programma e frecce', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // cambio d'ora
    expect(weekStart('2026-11-15')).toBe('2026-11-09');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    expect(dayInProgram(prog, '2026-11-04', '2026-11-15')).toBe(false);
    expect(dayInProgram(prog, '2026-11-16', '2026-11-15')).toBe(false); // futuro
    expect(dayInProgram(prog, '2026-11-12', '2026-11-15')).toBe(true);
    // Indietro: stesso giorno la settimana prima.
    expect(shiftWeek(prog, '2026-11-12', '2026-11-15', -1)).toBe('2026-11-05');
    // Domenica 15 → domenica 8 (dentro il programma).
    expect(shiftWeek(prog, '2026-11-15', '2026-11-15', -1)).toBe('2026-11-08');
    // Lunedì 9 → lunedì 2 non c'è: il giorno più vicino di quella settimana (giovedì 5).
    expect(shiftWeek(prog, '2026-11-09', '2026-11-15', -1)).toBe('2026-11-05');
    // Avanti oltre oggi: niente, o l'ultimo giorno disponibile.
    expect(shiftWeek(prog, '2026-11-15', '2026-11-15', 1)).toBeNull();
    expect(shiftWeek(prog, '2026-11-12', '2026-11-17', 1)).toBe('2026-11-17');
    expect(shiftWeek(prog, '2026-11-15', '2026-11-17', 1)).toBe('2026-11-17');
  });

  it("programma finito: si mostra l'ultimo giorno e le frecce saltano le settimane vuote", () => {
    const ended = { startDay: '2026-10-27', durationDays: 7 }; // 27 ott – 2 nov
    expect(lastProgramDay(ended, '2026-11-16')).toBe('2026-11-02');
    expect(defaultProgramDay(ended, '2026-11-16')).toBe('2026-11-02');
    // Da oggi (settimana 16–22 nov, vuota): indietro salta la settimana 9–15 e arriva a domenica 2.
    expect(shiftWeek(ended, '2026-11-16', '2026-11-16', -1)).toBe('2026-11-02');
    expect(shiftWeek(ended, '2026-11-02', '2026-11-16', -1)).toBe('2026-10-27');
    expect(shiftWeek(ended, '2026-10-27', '2026-11-16', -1)).toBeNull();
    expect(shiftWeek(ended, '2026-11-02', '2026-11-16', 1)).toBeNull();
    // In corso: di default oggi.
    expect(defaultProgramDay(prog, '2026-11-15')).toBe('2026-11-15');
  });

  it('conta previste e fatte per ogni giorno della settimana', () => {
    const items = [
      { id: 'a', frequency: 'daily', days: [1, 3] },
      { id: 'b', frequency: 'daily', days: null },
      { id: 'c', frequency: 'once', days: null },
    ] as unknown as programRepository.ProgramItem[];
    const week = buildWeek({ ...prog, items }, '2026-11-11', '2026-11-11', [
      { itemId: 'a', day: '2026-11-09' },
      { itemId: 'b', day: '2026-11-09' },
      { itemId: 'b', day: '2026-11-10' },
      { itemId: 'c', day: '2026-11-10' },
    ]);
    expect(week.map((d) => [d.day.slice(8), d.planned, d.done, d.enabled])).toEqual([
      ['09', 2, 2, true],
      ['10', 1, 1, true],
      ['11', 2, 0, true],
      ['12', 1, 0, false],
      ['13', 1, 0, false],
      ['14', 1, 0, false],
      ['15', 1, 0, false],
    ]);
  });

  it('spunta un allenamento funzionale arrivato giorni dopo e accetta spunte nel passato', async () => {
    const db = createTestDb();
    await migrate(db);
    const id = await programRepository.createProgram(db, {
      title: 'Stretching, forza e core: 10 minuti',
      startDay: '2026-11-09',
      durationDays: 7,
      items: [
        {
          title: 'Domenica — 10 minuti di stretching, forza e core',
          details: 'Spunta solo la domenica: 10 minuti complessivi.',
        },
        { title: 'Lunedì — 10 minuti di stretching, forza e core' },
      ],
    });
    const [sun, mon] = (await programRepository.getProgram(db, id))!.items as [
      programRepository.ProgramItem,
      programRepository.ProgramItem,
    ];
    // Domenica 15/11, 09:39–09:50: Functional Strength Training di 10:30 dall'Apple Watch.
    const at = new Date('2026-11-15T09:39:00').getTime();
    await healthDataRepository.upsertWorkouts(db, [
      {
        activityType: 'functionalStrength',
        startAt: at,
        endAt: at + 630_000,
        durationS: 630,
        energyKcal: 26,
        distanceM: null,
        source: 'apple_health',
        sourceId: 'fs1',
        metadata: undefined,
      },
    ]);
    // Sincronizzato solo il mercoledì dopo: viene spuntato lo stesso.
    expect(await autoCheckPrograms(db, new Date('2026-11-18T08:00:00'))).toBe(1);
    expect([...(await programRepository.dayChecks(db, [sun], '2026-11-15'))]).toEqual([
      [sun.id, 'auto'],
    ]);
    // Lunedì 9 fatto ma dimenticato: lo si spunta tornando alla settimana prima.
    await programRepository.setItemDone(db, mon, '2026-11-09', true);
    const checks = await programRepository.checksBetween(
      db,
      [sun, mon],
      '2026-11-09',
      '2026-11-15',
    );
    expect(checks.map((c) => c.day).sort()).toEqual(['2026-11-09', '2026-11-15']);
  });
});
