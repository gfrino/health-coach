import { getDefaultSettings } from '@/config/settingsSchema';

import {
  evaluateNotifications,
  inQuietHours,
  pickNotification,
  type ProactiveInput,
} from '../rules';

const prefs = getDefaultSettings().proactivity; // max 2/giorno, sera 20:30, silenzio 22:00–07:30
const at = (h: number, m = 0, day = 30) => new Date(2026, 8, day, h, m); // 30/9/2026 = mercoledì

function input(now: Date, over: Partial<ProactiveInput> = {}): ProactiveInput {
  const nights = Array.from({ length: 10 }, (_, i) => ({
    day: `2026-09-${String(21 + i).padStart(2, '0')}`,
    asleepMin: 420,
    endAt: new Date(2026, 8, 21 + i, 6, 30).getTime(),
  }));
  return {
    now,
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
    sent: [],
    ...over,
  };
}

describe('notifiche proattive', () => {
  it('mattina: riepilogo della notte dopo il risveglio', () => {
    const c = pickNotification(input(at(7, 45)));
    expect(c).toMatchObject({ id: 'morning:2026-09-30', kind: 'morning' });
    expect(c?.params.duration).toBe('7 h 00');
    expect(c?.params.variant).toBe('usual');
  });

  it('ore di silenzio e modalità passiva: nessuna notifica', () => {
    expect(inQuietHours(at(23), '22:00', '07:30')).toBe(true);
    expect(inQuietHours(at(7, 0), '22:00', '07:30')).toBe(true);
    expect(inQuietHours(at(12), '22:00', '07:30')).toBe(false);
    expect(pickNotification(input(at(7, 0)))).toBeNull();
    expect(evaluateNotifications(input(at(8), { prefs: { ...prefs, mode: 'passive' } }))).toEqual(
      [],
    );
  });

  it('non ripete e rispetta il limite giornaliero', () => {
    const sentMorning = { id: 'morning:2026-09-30', kind: 'morning', sentAt: at(7, 45).getTime() };
    expect(pickNotification(input(at(9, 30), { sent: [sentMorning] }))).toBeNull();
    const two = [sentMorning, { id: 'x', kind: 'activity', sentAt: at(10).getTime() }];
    expect(pickNotification(input(at(21), { sent: two }))).toBeNull();
  });

  it('avvisi: debito di sonno e recupero peggiorato', () => {
    const shortNights = input(at(12, 30)).nights.map((n, i) =>
      i >= 6 ? { ...n, asleepMin: 320 } : n,
    );
    const kinds = evaluateNotifications(
      input(at(12, 30), { nights: shortNights, rhr7: 60, rhr30: 55 }),
    ).map((c) => c.kind);
    expect(kinds).toEqual(expect.arrayContaining(['sleepDebt', 'recovery']));
  });

  it('sera: pochi passi prima del riepilogo, poi riepilogo serale', () => {
    expect(pickNotification(input(at(18, 30), { stepsToday: 2500 }))?.kind).toBe('activity');
    expect(pickNotification(input(at(20, 45)))?.kind).toBe('daily');
  });

  it('domenica sera: riepilogo settimanale', () => {
    const sunday = new Date(2026, 9, 4, 20, 45);
    const c = evaluateNotifications(input(sunday, { today: '2026-10-04' })).find(
      (x) => x.kind === 'weekly',
    );
    expect(c?.id).toBe('weekly:2026-W40');
  });
});
