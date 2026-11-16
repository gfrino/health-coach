import { migrate } from '@/db/migrate';
import * as profileRepository from '@/db/repositories/profileRepository';
import { estimateTarget } from '@/food/target';
import { createTestDb } from '@/test/nodeSqliteDb';

import { goalsForPrompt, normalizeGoals } from '../goals';
import { weightGoalLines, weightGoalProgress, weightTrend } from '../progress';

jest.mock('@/db', () => ({}));

describe('obiettivi', () => {
  it('converte i testi tradotti salvati dalle versioni precedenti in chiavi', () => {
    expect(
      normalizeGoals([
        'Lose weight',
        'Aumentare la massa muscolare',
        'fitness',
        'Correre una 10 km',
      ]),
    ).toEqual(['loseWeight', 'gainMuscle', 'fitness', 'Correre una 10 km']);
    expect(goalsForPrompt(['loseWeight', 'Correre una 10 km'])).toEqual([
      'lose weight',
      'Correre una 10 km',
    ]);
  });

  it('salva il punto di partenza quando si fissa il peso obiettivo', async () => {
    const db = createTestDb();
    await migrate(db);
    await profileRepository.saveProfile(
      db,
      { weightKg: 77.7, goals: ['Lose weight'] },
      '2026-11-14',
    );
    await profileRepository.saveProfile(
      db,
      { targetWeightKg: 72, targetDate: '2027-03-01' },
      '2026-11-14',
    );
    const p = await profileRepository.getProfile(db);
    expect(p).toMatchObject({
      goals: ['loseWeight'],
      targetWeightKg: 72,
      targetDate: '2027-03-01',
      goalStartWeightKg: 77.7,
      goalStartDate: '2026-11-14',
    });
    // Peso aggiornato più tardi: il punto di partenza non cambia.
    await profileRepository.saveProfile(db, { weightKg: 76 }, '2026-12-01');
    expect((await profileRepository.getProfile(db)).goalStartWeightKg).toBe(77.7);
  });

  it("calcola quanto manca, l'andamento e il ritmo necessario", () => {
    const weights = [
      { day: '2026-11-01', value: 78.4 },
      { day: '2026-11-05', value: 78.0 },
      { day: '2026-11-09', value: 77.9 },
      { day: '2026-11-13', value: 77.5 },
    ];
    expect(weightTrend(weights)).toBeCloseTo(-0.48, 1);
    const g = weightGoalProgress(
      {
        goals: ['loseWeight'],
        weightKg: 77.7,
        targetWeightKg: 72,
        targetDate: '2027-03-01',
        goalStartWeightKg: 78.4,
        goalStartDate: '2026-11-01',
      },
      weights,
      '2026-11-14',
    )!;
    expect(g).toMatchObject({
      direction: 'lose',
      currentKg: 77.5,
      remainingKg: 5.5,
      reached: false,
    });
    expect(g.done).toBeCloseTo(0.14, 2);
    expect(g.neededKgWeek).toBeCloseTo(0.36, 1);
    expect(g.onTrack).toBe(true);
    expect(g.etaDate! < '2027-03-01').toBe(true);
    expect(weightGoalLines(g).join(' ')).toContain('5.5 kg to go');
    expect(g.trendNote).toBeNull();
  });

  it('niente data prevista se il peso è quasi fermo o ci vorrebbe più di un anno', () => {
    const profile = {
      goals: ['loseWeight'],
      weightKg: 77,
      targetWeightKg: 70,
      targetDate: null,
      goalStartWeightKg: 77,
      goalStartDate: '2026-10-20',
    };
    // -0,06 kg a settimana: 7 kg richiederebbero più di due anni (prima: "verso febbraio 2029").
    const flat = weightGoalProgress(
      profile,
      [
        { day: '2026-10-20', value: 77.3 },
        { day: '2026-10-27', value: 77.0 },
        { day: '2026-11-03', value: 77.4 },
        { day: '2026-11-10', value: 77.1 },
        { day: '2026-11-15', value: 77.0 },
      ],
      '2026-11-16',
    )!;
    expect(Math.abs(flat.trendKgWeek!)).toBeLessThan(0.1);
    expect(flat.etaDate).toBeNull();
    expect(flat.trendNote).toBe('flat');
    expect(weightGoalLines(flat).join(' ')).toContain('essentially stable');
    // -0,12 kg a settimana: direzione giusta ma oltre un anno.
    const slow = weightGoalProgress(
      profile,
      [
        { day: '2026-10-19', value: 77.5 },
        { day: '2026-10-26', value: 77.38 },
        { day: '2026-11-02', value: 77.26 },
        { day: '2026-11-09', value: 77.14 },
        { day: '2026-11-16', value: 77.02 },
      ],
      '2026-11-16',
    )!;
    expect(slow.etaDate).toBeNull();
    expect(slow.trendNote).toBe('slow');
  });

  it('le calorie seguono il ritmo, entro limiti sicuri', () => {
    const base = {
      sex: 'male' as const,
      age: 51,
      weightKg: 77.7,
      heightCm: 176,
      activeKcal: 500,
      goals: ['loseWeight'],
    };
    const plain = estimateTarget(base)!;
    expect(plain.adjustment).toBe(-400);
    const paced = estimateTarget({
      ...base,
      weightGoal: { direction: 'lose', neededKgWeek: 0.36, reached: false },
    })!;
    expect(paced.adjustment).toBe(-396);
    expect(paced.paceKgWeek).toBe(0.36);
    // Ritmo troppo rapido: si ferma all'1% del peso a settimana.
    const capped = estimateTarget({
      ...base,
      weightGoal: { direction: 'lose', neededKgWeek: 2, reached: false },
    })!;
    expect(capped.paceKgWeek).toBe(0.75);
  });
});
