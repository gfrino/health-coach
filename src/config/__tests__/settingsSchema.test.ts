import { defaultUnitsForRegion, getDefaultSettings, settingsSchema } from '../settingsSchema';

describe('settingsSchema', () => {
  it('i default sono validi', () => {
    expect(settingsSchema.safeParse(getDefaultSettings('CH')).success).toBe(true);
  });

  it('unità in base al Paese', () => {
    expect(defaultUnitsForRegion('CH')).toEqual({
      weight: 'kg',
      distance: 'km',
      temperature: 'c',
      glucose: 'mmol/L',
    });
    expect(defaultUnitsForRegion('US')).toEqual({
      weight: 'lb',
      distance: 'mi',
      temperature: 'f',
      glucose: 'mg/dL',
    });
    expect(defaultUnitsForRegion('IT').glucose).toBe('mg/dL');
    expect(defaultUnitsForRegion(null).weight).toBe('kg');
  });
});
