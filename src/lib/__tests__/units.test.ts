import { getDefaultSettings } from '@/config/settingsSchema';

import {
  formatDistance,
  formatDuration,
  formatGlucose,
  formatTemperature,
  formatWeight,
} from '../units';

const metric = getDefaultSettings('CH').units;
const us = getDefaultSettings('US').units;

describe('unità', () => {
  it('converte solo in visualizzazione', () => {
    expect(formatWeight(80, metric, 'en')).toBe('80 kg');
    expect(formatWeight(80, us, 'en')).toBe('176.4 lb');
    expect(formatDistance(8000, us, 'en')).toBe('5 mi');
    expect(formatGlucose(99, metric, 'en')).toBe('5.5 mmol/L');
    expect(formatGlucose(99, us, 'en')).toBe('99 mg/dL');
    expect(formatTemperature(37, us, 'en')).toBe('98.6 °F');
  });

  it('durate leggibili', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(425)).toBe('7 h 05');
  });
});
