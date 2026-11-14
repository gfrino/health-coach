import { migrate } from '@/db/migrate';
import * as healthDataRepository from '@/db/repositories/healthDataRepository';
import * as programRepository from '@/db/repositories/programRepository';
import { createTestDb } from '@/test/nodeSqliteDb';

import { autoCheckPrograms } from '../autoCheck';
import { inferAutoRule, inferDays, parseDays, ruleSatisfied, weekdayOf } from '../schedule';
import { adherence, loadProgramContext } from '../summary';
import { programsSection } from '@/coach/context';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({
  programRepository: jest.requireActual('@/db/repositories/programRepository'),
  healthDataRepository: jest.requireActual('@/db/repositories/healthDataRepository'),
  healthQueries: jest.requireActual('@/db/repositories/healthQueries'),
}));

describe('giorni e spunta automatica', () => {
  it('deduce i giorni dal titolo e li legge dal modello', () => {
    expect(inferDays('Lunedì — 10 minuti di stretching, forza e core')).toEqual([1]);
    expect(inferDays('Camminata martedì e giovedì')).toEqual([2, 4]);
    expect(inferDays('Luci basse dopo le 21')).toBeNull();
    expect(parseDays(['mon', 'wed', 'Friday'])).toEqual([1, 3, 5]);
    expect(parseDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).toBeNull();
    expect(weekdayOf('2026-11-09')).toBe(1); // lunedì
    expect(weekdayOf('2026-11-15')).toBe(7); // domenica
  });

  it('riconosce le azioni fisiche (minuti e tipo) e ignora le altre', () => {
    const r = inferAutoRule('Lunedì — 10 minuti di stretching, forza e core');
    expect(r).toMatchObject({ kind: 'workout', minMinutes: 10 });
    expect(r?.kind === 'workout' && r.activities).toEqual(
      expect.arrayContaining(['flexibility', 'strength', 'coreTraining']),
    );
    expect(inferAutoRule('Camminata veloce di 20 min dopo pranzo')).toEqual({
      kind: 'workout',
      activities: ['walking', 'hiking'],
      minMinutes: 20,
    });
    expect(inferAutoRule('Fare 8.000 passi')).toEqual({ kind: 'steps', min: 8000 });
    expect(inferAutoRule('Allenamento a scelta')).toMatchObject({ activities: null });
    expect(inferAutoRule('Bere 2 litri di acqua')).toBeNull();
    expect(inferAutoRule('Evitare la palestra la sera')).toBeNull();
  });

  it('somma i minuti degli allenamenti che corrispondono', () => {
    const rule = inferAutoRule('20 min di camminata')!;
    const day = (types: [string, number][]) => ({
      workouts: types.map(([activityType, durationMin]) => ({ activityType, durationMin })),
      steps: null,
    });
    expect(
      ruleSatisfied(
        rule,
        day([
          ['walking', 12],
          ['walking', 9],
        ]),
      ),
    ).toBe(true);
    expect(ruleSatisfied(rule, day([['running', 30]]))).toBe(false);
  });

  it('spunta da un allenamento, rispetta la spunta tolta e informa il coach', async () => {
    const db = createTestDb();
    await migrate(db);
    // Programma come quello creato dal coach: un'azione per giorno della settimana.
    const id = await programRepository.createProgram(db, {
      title: 'Stretching, forza e core: 10 minuti',
      startDay: '2026-11-08',
      durationDays: 7,
      items: [
        { title: 'Lunedì — 10 minuti di stretching, forza e core' },
        { title: 'Martedì — 10 minuti di stretching, forza e core' },
        { title: 'Luci basse dopo le 21' },
      ],
    });
    const [mon, tue, lights] = (await programRepository.getProgram(db, id))!.items as [
      programRepository.ProgramItem,
      programRepository.ProgramItem,
      programRepository.ProgramItem,
    ];
    expect(mon.days).toEqual([1]);
    expect(lights.auto).toBeNull();

    // Martedì 10/11: allenamento di flessibilità di 12 minuti da Apple Fitness.
    const at = new Date('2026-11-10T07:30:00').getTime();
    await healthDataRepository.upsertWorkouts(db, [
      {
        activityType: 'flexibility',
        startAt: at,
        endAt: at + 12 * 60_000,
        durationS: 720,
        energyKcal: 40,
        distanceM: null,
        source: 'apple_health',
        sourceId: 'w1',
        metadata: undefined,
      },
    ]);
    const now = new Date('2026-11-10T20:00:00');
    expect(await autoCheckPrograms(db, now)).toBe(1);
    let today = await programRepository.dayChecks(db, [mon, tue, lights], '2026-11-10');
    expect([...today]).toEqual([[tue.id, 'auto']]);

    // L'utente toglie la spunta: il prossimo controllo non la rimette.
    await programRepository.setItemDone(db, tue, '2026-11-10', false);
    expect(await autoCheckPrograms(db, now)).toBe(0);
    today = await programRepository.dayChecks(db, [mon, tue, lights], '2026-11-10');
    expect(today.size).toBe(0);

    // Lunedì fatto a mano: il coach lo vede il giorno dopo (non "nessuna azione fatta").
    await programRepository.setItemDone(db, mon, '2026-11-09', true);
    await programRepository.setItemDone(db, tue, '2026-11-10', true);
    const ctx = await loadProgramContext(db, new Date('2026-11-11T09:00:00'));
    const text = programsSection(ctx)!;
    expect(text).toContain(
      'Lunedì — 10 minuti di stretching, forza e core (on mon; not planned today; last 7 days 1/1 planned days',
    );
    expect(text).toContain('last done 2026-11-10');
    expect(text).toContain('Luci basse dopo le 21 (daily; not done yet today; last 7 days 0/3');
  });

  it('la costanza conta solo i giorni previsti', () => {
    const p = {
      startDay: '2026-11-02',
      items: [{ id: 'a', frequency: 'daily', days: [1, 3] }],
    } as unknown as programRepository.Program;
    // Dal 2 al 8 novembre: lunedì 2 e mercoledì 4 previsti, fatto solo lunedì.
    expect(adherence(p, [{ itemId: 'a', day: '2026-11-02' }], '2026-11-09')).toBe(50);
  });
});
