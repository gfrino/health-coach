import { foodSection } from '@/coach/context';

import { eatenAtFor, shiftDay } from '../days';
import { parseFoodEstimate } from '../estimate';
import { estimateTarget, MIN_TARGET } from '../target';

jest.mock('@/db', () => ({}));

describe('obiettivo calorico stimato', () => {
  const base = {
    sex: 'male' as const,
    age: 51,
    weightKg: 77.7,
    heightCm: 180,
    activeKcal: 500,
    goals: [],
  };

  it('Mifflin-St Jeor × 1,2 più le calorie attive', () => {
    const t = estimateTarget(base)!;
    expect(t.bmr).toBe(1652); // 777 + 1125 - 255 + 5
    expect(t.kcal).toBe(2480); // 1652 × 1,2 + 500, a decine
  });

  it('corregge per dimagrire o aumentare, mai sotto la soglia', () => {
    expect(estimateTarget({ ...base, goals: ['loseWeight'] })!.kcal).toBe(2080);
    expect(estimateTarget({ ...base, goals: ['gainWeight'] })!.kcal).toBe(2780);
    expect(
      estimateTarget({
        ...base,
        sex: 'female',
        weightKg: 45,
        heightCm: 150,
        activeKcal: null,
        goals: ['loseWeight'],
      })!.kcal,
    ).toBe(MIN_TARGET);
  });

  it('senza età, peso o altezza nessun obiettivo', () => {
    expect(estimateTarget({ ...base, heightCm: null })).toBeNull();
    expect(estimateTarget({ ...base, age: 14 })).toBeNull();
  });
});

describe('stima dei cibi dalla risposta a righe', () => {
  it('legge righe con unità, virgole e intestazione', () => {
    const items = parseFoodEstimate(
      [
        'name | quantity | kcal | protein g | carbs g | fat g | fiber g | sugar g | saturated fat g | sodium mg',
        '- **Uova strapazzate** | 2 uova | 182 kcal | 12,6 g | 1 | 14 | 0 | 0,5 | 4,5 | 180 mg',
        'Pane integrale | 1 fetta, 30 g | 75 | 3 | 13 | 1 | 2 | 1 | 0.2 | 140',
        'Caffè | 1 tazzina | 2 | | |',
        'Cappuccino | 1 tazza | ~90 | circa 4,5 g | 80-100 |',
        'nota senza numeri',
      ].join('\n'),
    );
    const none = { fiber: null, sugar: null, saturatedFat: null, sodium: null };
    expect(items).toEqual([
      {
        name: 'Uova strapazzate',
        quantity: '2 uova',
        calories: 182,
        protein: 12.6,
        carbs: 1,
        fat: 14,
        fiber: 0,
        sugar: 0.5,
        saturatedFat: 4.5,
        sodium: 180,
      },
      {
        name: 'Pane integrale',
        quantity: '1 fetta, 30 g',
        calories: 75,
        protein: 3,
        carbs: 13,
        fat: 1,
        fiber: 2,
        sugar: 1,
        saturatedFat: 0.2,
        sodium: 140,
      },
      {
        name: 'Caffè',
        quantity: '1 tazzina',
        calories: 2,
        protein: null,
        carbs: null,
        fat: null,
        ...none,
      },
      {
        name: 'Cappuccino',
        quantity: '1 tazza',
        calories: 90,
        protein: 4.5,
        carbs: 90,
        fat: null,
        ...none,
      },
    ]);
    expect(parseFoodEstimate('NONE')).toEqual([]);
  });
});

describe('giorni del diario', () => {
  it('sposta i giorni e sceglie l’ora del pasto per i giorni passati', () => {
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    const now = new Date('2026-10-04T21:15:00');
    expect(eatenAtFor('2026-10-04', 'breakfast', now)).toBe(now.getTime());
    expect(new Date(eatenAtFor('2026-10-03', 'dinner', now)).getHours()).toBe(20);
  });
});

describe('diario alimentare nel prompt del coach', () => {
  const food = {
    today: [{ id: 'f1', meal: 'breakfast', name: 'Porridge', quantity: '60 g', kcal: 230 }],
    todayTotals: { calories: 230, protein: 8, carbs: 40, fat: 4 },
    avg7: { calories: 1980, days: 5 },
    target: { kcal: 2200, custom: false },
  };

  it('mostra voci con id, totali, media e obiettivo', () => {
    const s = foodSection(food)!;
    expect(s).toContain('[f1] breakfast: Porridge (60 g) · 230 kcal');
    expect(s).toContain('Today so far: 230 kcal');
    expect(s).toContain('daily target 2200 kcal (estimated by the app');
    expect(s).toContain('last 5 logged days: 1980 kcal');
  });

  it('versione corta per il telefono e niente sezione senza dati', () => {
    expect(foodSection(food, true)).not.toContain('[f1]');
    expect(foodSection(null)).toBeNull();
  });
});
