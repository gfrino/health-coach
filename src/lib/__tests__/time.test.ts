import { addMinutes, toIsoDate, trendOf } from '../time';

describe('addMinutes', () => {
  it('somma e sottrae minuti con giro sulle 24 ore', () => {
    expect(addMinutes('20:30', 15)).toBe('20:45');
    expect(addMinutes('23:50', 15)).toBe('00:05');
    expect(addMinutes('00:00', -15)).toBe('23:45');
  });
});

describe('toIsoDate', () => {
  it('valida e formatta', () => {
    expect(toIsoDate('5', '3', '1980')).toBe('1980-03-05');
    expect(toIsoDate('31', '2', '1980')).toBeNull();
    expect(toIsoDate('1', '1', '80')).toBeNull();
    expect(toIsoDate('1', '1', '2999')).toBeNull();
  });
});

describe('trendOf', () => {
  it.each([
    [110, 100, 'up'],
    [90, 100, 'down'],
    [102, 100, 'stable'],
    [null, 100, null],
    [5, 0, null],
  ])('%p vs %p → %p', (a7, a30, expected) => {
    expect(trendOf(a7, a30)).toBe(expected);
  });
});
