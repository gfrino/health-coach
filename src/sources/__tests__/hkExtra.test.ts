import itLocale from '@/i18n/locales/it.json';

import {
  availableOn,
  categoryValue,
  EXTRA_CUMULATIVE,
  EXTRA_LABELS,
  EXTRA_METRIC_UNITS,
  HC_ONLY_LABELS,
  HK_EXTRA_CATEGORIES,
  HK_EXTRA_QUANTITIES,
} from '../hkExtra';
import { permissionIdentifiers } from '../healthDataTypes';
import { CUMULATIVE_METRICS, METRIC_UNITS } from '../model';
import {
  HK_QUANTITY,
  normalizeExtraCategorySample,
  normalizeQuantitySample,
  normalizeStateOfMind,
} from '../normalize/healthKit';

const sample = <T extends object>(extra: T) => ({
  uuid: 'u1',
  startDate: new Date('2026-11-20T08:00:00'),
  endDate: new Date('2026-11-20T08:30:00'),
  ...extra,
});

describe('resto di Apple Salute', () => {
  it('ogni tipo ha unità, nome per il coach e nome sul telefono', () => {
    const types = [
      ...HK_EXTRA_QUANTITIES.map((x) => x.type),
      ...HK_EXTRA_CATEGORIES.map((x) => x.type),
      'stateOfMind',
      ...Object.keys(HC_ONLY_LABELS),
    ];
    const ids = [...HK_EXTRA_QUANTITIES, ...HK_EXTRA_CATEGORIES].map((x) => x.hk);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(types).size).toBe(types.length);
    const shown = itLocale.today.other.health as Record<string, string>;
    for (const t of Object.keys(EXTRA_METRIC_UNITS)) {
      expect(types).toContain(t);
      expect(EXTRA_LABELS[t]).toBeTruthy();
      expect(shown[t]).toBeTruthy();
      expect((METRIC_UNITS as Record<string, string>)[t]).toBeDefined();
    }
    // Le nuove metriche non sostituiscono quelle storiche.
    expect(HK_QUANTITY.HKQuantityTypeIdentifierStepCount!.type).toBe('steps');
    expect(HK_QUANTITY.HKQuantityTypeIdentifierAppleExerciseTime!.type).toBe('exerciseTime');
    expect(CUMULATIVE_METRICS.has('exerciseTime')).toBe(true);
    expect(EXTRA_CUMULATIVE.has('symptomHeadache')).toBe(false);
  });

  it('chiede su iPhone e su Android anche i tipi nuovi', () => {
    const ios = permissionIdentifiers('ios');
    expect(ios).toContain('HKQuantityTypeIdentifierTimeInDaylight');
    expect(ios).toContain('HKCategoryTypeIdentifierHeadache');
    expect(ios).toContain('HKStateOfMindTypeIdentifier');
    const android = permissionIdentifiers('android');
    expect(android.some((x) => x.startsWith('HK'))).toBe(false);
    expect(android).toEqual(expect.arrayContaining(['SkinTemperature', 'OvulationTest', 'Speed']));
  });

  it('salta i tipi che la versione di iOS non ha', () => {
    expect(availableOn(undefined, 16)).toBe(true);
    expect(availableOn(18, 17)).toBe(false);
    expect(availableOn(18, 27)).toBe(true);
  });

  it('legge eventi, sintomi, ore in piedi e test', () => {
    expect(categoryValue('count', 0)).toBe(1);
    expect(categoryValue('standHour', 0)).toBe(1);
    expect(categoryValue('standHour', 1)).toBe(0);
    // Gravità: non specificata = presente (1), assente 0, lieve 1, moderata 2, grave 3.
    expect([0, 1, 2, 3, 4].map((v) => categoryValue('severity', v))).toEqual([1, 0, 1, 2, 3]);
    expect(categoryValue('value', 2)).toBe(2);

    const headache = HK_EXTRA_CATEGORIES.find((x) => x.type === 'symptomHeadache')!;
    expect(normalizeExtraCategorySample(headache, sample({ value: 3 }))).toMatchObject({
      type: 'symptomHeadache',
      value: 2,
      unit: 'level',
      source: 'apple_health',
      sourceId: 'u1',
    });
  });

  it("usa l'unità indicata da HealthKit quando non ne chiede una e salta i dati di AlbA", () => {
    const power = normalizeQuantitySample(
      'HKQuantityTypeIdentifierRunningPower',
      sample({ quantity: 245.4, unit: 'W' }),
    );
    expect(power).toMatchObject({ type: 'runningPower', value: 245.4, unit: 'W' });
    const daylight = normalizeQuantitySample(
      'HKQuantityTypeIdentifierWalkingAsymmetryPercentage',
      sample({ quantity: 0.034, unit: '%' }),
    );
    expect(daylight).toMatchObject({ type: 'walkingAsymmetry', value: 3.4, unit: '%' });
    const own = normalizeQuantitySample(
      'HKQuantityTypeIdentifierBodyMass',
      sample({ quantity: 76.5, metadata: { AlbAFoodEntry: 'weight-1' } }),
    );
    expect(own).toBeNull();
    expect(normalizeStateOfMind(sample({ valence: -0.5 }))).toMatchObject({
      type: 'stateOfMind',
      value: -0.5,
    });
    expect(
      normalizeStateOfMind(sample({ valence: 0.5, metadata: { AlbAFoodEntry: 'journal-1' } })),
    ).toBeNull();
  });
});
