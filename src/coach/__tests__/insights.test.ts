import { SleepStage, type StageInterval } from '@/sources/model';

import { composeSystemPrompt } from '../context';
import { buildInsights, hm } from '../insights';
import { getDefaultSettings } from '@/config/settingsSchema';

const today = '2026-09-29';
const day = (n: number) => {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const series = (f: (n: number) => number, days = 30) =>
  Array.from({ length: days }, (_, i) => ({ day: day(days - 1 - i), value: f(days - 1 - i) }));

describe('buildInsights', () => {
  it('confronta il sonno con la media e suggerisce il focus', () => {
    const nights = Array.from({ length: 30 }, (_, i) => {
      const n = 29 - i;
      return { day: day(n), asleepMin: n < 7 ? 330 : 450, stages: [] as StageInterval[] };
    });
    nights[29]!.stages = [{ stage: SleepStage.Deep, startAt: 0, endAt: 60 * 60000 }];
    const r = buildInsights({ today, nights });
    expect(r.lines[0]).toContain('last night');
    expect(r.lines[0]).toContain('deep 1 h 00 min');
    expect(r.lines[0]).toMatch(/less than your 30-night average/);
    expect(r.lines[0]).toContain('nights under 6 h');
    expect(r.focus).toMatch(/^sleep/);
    expect(r.recent[0]).toContain('5 h 30 min');
  });

  it('esclude oggi (parziale) dalla media dei passi', () => {
    const steps = series((n) => (n === 0 ? 1200 : 9000));
    const r = buildInsights({ today, steps });
    expect(r.lines[0]).toContain('9,000/day');
    expect(r.lines[0]).toContain('in line with');
    expect(r.lines[0]).toContain('today so far 1,200');
    expect(r.focus).toBeNull();
  });

  it('segnala HRV in calo e frequenza a riposo in salita', () => {
    const r = buildInsights({
      today,
      hrv: series((n) => (n < 7 ? 40 : 60)),
      restingHeartRate: series((n) => (n < 7 ? 64 : 58)),
    });
    expect(r.lines.join(' ')).toMatch(/Resting heart rate: 64 bpm.*above/);
    expect(r.lines.join(' ')).toMatch(/HRV: 40 ms.*below/);
    expect(r.focus).toMatch(/^recovery/);
  });

  it('hm formatta ore e minuti', () => {
    expect(hm(431)).toBe('7 h 11 min');
  });
});

describe('prompt compatto', () => {
  it('include i fatti chiave (sonno compreso) e la guida alle risposte', () => {
    const insights = buildInsights({
      today,
      nights: [{ day: today, asleepMin: 431, stages: [] }],
      steps: series(() => 9000),
    });
    const p = composeSystemPrompt({
      coach: getDefaultSettings().coach,
      language: 'it',
      now: new Date(`${today}T20:00:00`),
      compact: true,
      insights,
      metrics: [{ label: 'Steps per day', unit: 'count', avg7: 9000 }],
    });
    expect(p).toContain('KEY FACTS');
    expect(p).toContain('7 h 11 min');
    expect(p).toContain('HOW TO ANSWER');
    expect(p).not.toContain('HEALTH DATA SNAPSHOT');
  });
});
