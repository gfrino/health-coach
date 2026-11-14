import { migrate } from '@/db/migrate';
import * as foodRepository from '@/db/repositories/foodRepository';
import { createTestDb } from '@/test/nodeSqliteDb';
import { foodSection } from '@/coach/context';

import { estimateInstruction, parseFoodEstimate } from '../estimate';
import {
  catalogueTracker,
  cleanExtras,
  customTracker,
  NO_TRACKERS,
  type Tracker,
} from '../trackers';

let mockSeq = 0;
jest.mock('@/db/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/db', () => ({}));

const trackers = [catalogueTracker('fructose'), customTracker('Istamina', 'mg')!];

describe('valori in più nel diario alimentare', () => {
  it('chiede e legge le colonne in più per le voci tracciate', () => {
    const prompt = estimateInstruction('Italian', 'una mela', false, trackers);
    expect(prompt).toContain('sodium mg | fructose g | Istamina mg');
    const [apple] = parseFoodEstimate(
      'Mela | 1 media, 180 g | 95 | 0.5 | 25 | 0.3 | 4.4 | 19 | 0 | 2 | 11 | 0',
      trackers,
    );
    expect(apple?.extras).toEqual({ fructose: 11, c_istamina: 0 });
    // Senza voci tracciate niente colonne in più.
    expect(parseFoodEstimate('Mela | 1 | 95 | 0.5 | 25 | 0.3', [])[0]?.extras).toBeUndefined();
  });

  it('salva, somma per giorno e passa i totali al coach', async () => {
    const db = createTestDb();
    await migrate(db);
    const eatenAt = new Date('2026-11-14T10:00:00').getTime();
    await foodRepository.createEntry(db, {
      name: 'Mela',
      calories: 95,
      eatenAt,
      extras: { fructose: 11 },
    });
    const id = await foodRepository.createEntry(db, {
      name: 'Succo',
      calories: 110,
      eatenAt,
      extras: { fructose: 12.5, c_istamina: 3 },
    });
    // Modifica senza valori in più (es. dal coach): restano quelli salvati.
    await foodRepository.updateEntry(db, id, { name: 'Succo d’arancia', calories: 110 });
    const day = await foodRepository.listDay(db, '2026-11-14');
    const totals = foodRepository.totals(day);
    expect(totals.extras).toEqual({ fructose: 23.5, c_istamina: 3 });
    const [daily] = await foodRepository.dailyTotals(db, '2026-11-14', '2026-11-14');
    expect(daily?.extras).toEqual({ fructose: 23.5, c_istamina: 3 });

    const text = foodSection({
      today: [],
      todayTotals: totals,
      avg7: null,
      target: null,
      trackers: [
        { id: 'fructose', name: 'fructose', unit: 'g' },
        { id: 'c_istamina', name: 'Istamina', unit: 'mg' },
      ],
    })!;
    expect(text).toContain('fructose 23.5 g [id fructose], Istamina 3 mg [id c_istamina]');
  });

  it('scarta valori non validi', () => {
    expect(cleanExtras({ fructose: -1, caffeine: '80', 'bad key': 3 })).toEqual({ caffeine: 80 });
    expect(customTracker('  ', 'g')).toBeNull();
  });

  it('il selettore delle voci restituisce sempre la stessa lista vuota (Zustand 5)', () => {
    // Un array nuovo a ogni lettura fa ridisegnare la scheda Cibo all'infinito (crash in 1.23.0).
    const state = { settings: { food: {} as { trackers?: Tracker[] } } };
    const select = (s: typeof state) => s.settings.food.trackers ?? NO_TRACKERS;
    expect(select(state)).toBe(select(state));
  });
});
