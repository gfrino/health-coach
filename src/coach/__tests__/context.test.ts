import { getDefaultSettings } from '@/config/settingsSchema';

import { ageFromBirthDate, composeSystemPrompt, recentHistory } from '../context';
import { SAFETY_RULES } from '../prompts';

const now = new Date(2026, 8, 29, 18, 30);
const coach = {
  ...getDefaultSettings().coach,
  name: 'Aria',
  medicalApproach: 'tcm' as const,
  tone: 'direct' as const,
};

describe('composeSystemPrompt', () => {
  it('include identità, lingua, approccio, tono e regole di sicurezza fisse', () => {
    const p = composeSystemPrompt({ coach, language: 'de', now });
    expect(p).toContain('You are Aria');
    expect(p).toContain('Always write in German: it is the language of the app');
    // Ripetuta in fondo, dove i modelli piccoli la "sentono" di più.
    expect(p.lastIndexOf('Always write in German')).toBeGreaterThan(p.indexOf('SAFETY'));
    expect(p).toContain('Traditional Chinese Medicine');
    expect(p).toContain('Tone: direct');
    expect(p).toContain(SAFETY_RULES);
    expect(p).toMatch(
      /Never suggest stopping, reducing, changing or replacing prescribed medications/,
    );
    expect(p).toContain('144');
  });

  it('omette le sezioni vuote (minimizzazione)', () => {
    const p = composeSystemPrompt({
      coach,
      language: 'it',
      now,
      profile: { goals: [] },
      metrics: [],
      journal: [],
    });
    expect(p).not.toContain('USER PROFILE');
    expect(p).not.toContain('HEALTH DATA SNAPSHOT');
    expect(p).not.toContain('RECENT JOURNAL ENTRIES');
  });

  it('riassume profilo, farmaci, integratori e allergie', () => {
    const p = composeSystemPrompt({
      coach,
      language: 'it',
      now,
      profile: {
        sex: 'female',
        birthDate: '1980-10-15',
        heightCm: 170,
        weightKg: 65,
        goals: ['Dormire meglio'],
        conditions: [{ name: 'Ipertensione' }],
        medications: [
          { name: 'Ramipril', kind: 'medication', dosage: '5 mg' },
          { name: 'Magnesio', kind: 'supplement' },
        ],
        allergies: [{ substance: 'Penicillina', reaction: 'orticaria' }],
      },
    });
    expect(p).toContain('sex: female, age: 45, height: 170 cm, weight: 65 kg, BMI: 22.5');
    expect(p).toContain('Prescribed medications: Ramipril 5 mg');
    expect(p).toContain('Supplements: Magnesio');
    expect(p).toContain('Allergies: Penicillina (orticaria)');
    expect(p).toContain('Conditions: Ipertensione');
  });

  it('dichiara i dati mancanti e vieta di inventarli', () => {
    const p = composeSystemPrompt({ coach, language: 'it', now });
    expect(p).toContain(
      'Not available: health measurements (activity, sleep, heart, body); lab results; journal entries.',
    );
    expect(p).toContain('Never guess or invent them.');
    const withData = composeSystemPrompt({
      coach,
      language: 'it',
      now,
      metrics: [{ label: 'Steps', unit: 'count', avg7: 1 }],
      journal: [{ date: '2026-09-28', mood: 3 }],
    });
    expect(withData).toContain('Not available: lab results.');
  });

  it('mette la data corrente in fondo (prefisso stabile per la cache)', () => {
    const p = composeSystemPrompt({
      coach,
      language: 'it',
      now,
      memoryFacts: [{ id: 'f1', text: 'Corre la domenica' }],
    });
    expect(p.trim().split('\n').at(-1)).toBe('CURRENT DATE: 2026-09-29 18:30');
    expect(p.indexOf('WHAT YOU REMEMBER')).toBeLessThan(p.indexOf('CURRENT DATE'));
  });

  it('include metriche aggregate, esami fuori range e diario', () => {
    const p = composeSystemPrompt({
      coach,
      language: 'it',
      now,
      metrics: [{ label: 'Steps per day', unit: 'count', avg7: 8123.4, avg30: 7000, trend: 'up' }],
      labs: [{ name: 'LDL', value: 190, unit: 'mg/dL', refHigh: 130, date: '2026-09-01' }],
      journal: [{ date: '2026-09-28', mood: 2, energy: 3, text: 'Stanca' }],
    });
    expect(p).toContain('- Steps per day (count): 7-day avg 8123.4, 30-day avg 7000, trend up');
    expect(p).toContain('- 2026-09-01 LDL: 190 mg/dL (reference …–130) HIGH');
    expect(p).toContain('- 2026-09-28: mood 2/5, energy 3/5 — "Stanca"');
  });
});

describe('totali di oggi', () => {
  it("indica l'ora di lettura e che i totali sono parziali", () => {
    const at = new Date(2026, 8, 29, 18, 27).getTime();
    const p = composeSystemPrompt({ coach, language: 'it', now, todayTotalsAt: at });
    expect(p).toContain('read from the health app at 18:27');
    expect(p).toContain('so far today');
    expect(composeSystemPrompt({ coach, language: 'it', now })).not.toContain("TODAY'S TOTALS");
  });
});

describe('ageFromBirthDate', () => {
  it("calcola l'età tenendo conto del compleanno", () => {
    expect(ageFromBirthDate('1980-09-29', now)).toBe(46);
    expect(ageFromBirthDate('1980-09-30', now)).toBe(45);
    expect(ageFromBirthDate('non-una-data', now)).toBeNull();
  });
});

describe('recentHistory', () => {
  it('limita i messaggi e inizia sempre da un messaggio utente', () => {
    const msgs = [
      { role: 'assistant' as const, content: 'Benvenuto' },
      { role: 'user' as const, content: 'Ciao' },
      { role: 'assistant' as const, content: '' },
      { role: 'assistant' as const, content: 'Come stai?' },
    ];
    expect(recentHistory(msgs)).toEqual([
      { role: 'user', content: 'Ciao' },
      { role: 'assistant', content: 'Come stai?' },
    ]);
    expect(recentHistory([{ role: 'assistant', content: 'solo io' }])).toEqual([]);
  });
});

describe('altre misure', () => {
  it('una riga per misura presente, anche nel prompt compatto', () => {
    const p = composeSystemPrompt({
      coach,
      language: 'it',
      now,
      compact: true,
      extras: [
        {
          type: 'vo2max',
          unit: 'ml/kg/min',
          daily: false,
          latest: 41.5,
          latestDay: '2026-09-27',
          avg7: 41.5,
          avg30: 40.9,
        },
        {
          type: 'water',
          unit: 'ml',
          daily: true,
          latest: 1500,
          latestDay: '2026-09-29',
          avg7: 1800,
          avg30: 1700,
        },
      ],
      cycle: { lastStart: '2026-09-15', avgLength: 28 },
    });
    expect(p).toContain('OTHER MEASUREMENTS');
    expect(p).toContain('- VO2 max: 41.5 ml/kg/min (2026-09-27), 30-day avg 40.9 ml/kg/min');
    expect(p).toContain('- Water drunk: 1800 ml/day (7-day avg), 30-day avg 1700 ml/day');
    expect(p).toContain('last period started 2026-09-15, average cycle 28 days');
    expect(composeSystemPrompt({ coach, language: 'it', now })).not.toContain('OTHER MEASUREMENTS');
  });
});
