import { getDefaultSettings } from '@/config/settingsSchema';

import { checkinCandidate, checkinSlots, firstSentence, SCHEDULED_KINDS } from '../digests';
import { pickNotification, type ProactiveInput } from '../rules';

const prefs = getDefaultSettings().proactivity; // mattino 08:00, sera 20:30
const at = (h: number, m = 0, day = 30) => new Date(2026, 8, day, h, m); // 30/9/2026 = mercoledì

function input(over: Partial<ProactiveInput> = {}): Omit<ProactiveInput, 'now' | 'sent'> {
  const nights = Array.from({ length: 10 }, (_, i) => ({
    day: `2026-09-${String(21 + i).padStart(2, '0')}`,
    asleepMin: 420,
    endAt: new Date(2026, 8, 21 + i, 6, 30).getTime(),
  }));
  return {
    today: '2026-09-30',
    nights,
    stepsToday: 8000,
    steps7: 9000,
    stepsPrev7: 8000,
    rhr7: 55,
    rhr30: 55,
    hrv7: 50,
    hrv30: 50,
    baselineDays: 30,
    prefs,
    ...over,
  };
}

describe('check-in programmati', () => {
  it('programma mattino e sera dei prossimi 7 giorni, solo nel futuro', () => {
    const slots = checkinSlots(prefs, at(9));
    expect(slots[0]).toMatchObject({ id: 'evening:2026-09-30', kind: 'evening' });
    expect(slots[1]).toMatchObject({ id: 'morning:2026-10-01', kind: 'morning' });
    expect(slots[1]?.at).toEqual(new Date(2026, 9, 1, 8, 0));
    expect(slots).toHaveLength(13);
    expect(slots.every((s) => s.at.getTime() > at(9).getTime())).toBe(true);
  });

  it('modalità passiva: nessun check-in; senza report giornaliero solo la domenica sera', () => {
    expect(checkinSlots({ ...prefs, mode: 'passive' }, at(9))).toEqual([]);
    const evenings = checkinSlots(
      { ...prefs, reports: { daily: false, weekly: true, monthly: false } },
      at(9),
    ).filter((s) => s.kind === 'evening');
    expect(evenings.map((s) => s.day)).toEqual(['2026-10-04']);
  });

  it('il mattino usa la notte già sincronizzata, altrimenti testo generico', () => {
    const slot = checkinSlots(prefs, at(6, 50))[0]!;
    expect(slot.id).toBe('morning:2026-09-30');
    expect(checkinCandidate(slot, input())).toMatchObject({ kind: 'morning' });
    // La notte di oggi non c'è ancora.
    const noNight = input({ nights: input().nights.slice(0, -1) });
    expect(checkinCandidate(slot, noNight)).toBeNull();
    // Giorni futuri: sempre generico.
    const tomorrow = checkinSlots(prefs, at(6, 50)).find((s) => s.day === '2026-10-01')!;
    expect(checkinCandidate(tomorrow, input())).toBeNull();
  });

  it('gli avvisi immediati non ripetono i check-in programmati', () => {
    const full = { ...input(), now: at(7, 45), sent: [] };
    expect(pickNotification(full)?.kind).toBe('morning');
    expect(pickNotification(full, SCHEDULED_KINDS)).toBeNull();
    const debt = {
      ...full,
      nights: full.nights.map((n) => ({ ...n, asleepMin: 300 })),
    };
    expect(pickNotification(debt, SCHEDULED_KINDS)?.kind).toBe('sleepDebt');
  });

  it('prima frase per la notifica, senza markdown', () => {
    expect(firstSentence('**Hai dormito 7 h 10.** Ottimo! Oggi punta a camminare.')).toBe(
      'Hai dormito 7 h 10.',
    );
    expect(firstSentence('a'.repeat(200)).length).toBe(150);
  });
});
