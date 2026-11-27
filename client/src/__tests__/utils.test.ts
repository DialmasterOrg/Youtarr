import { formatDuration, formatYTDate } from '../utils';

describe('formatDuration', () => {
  it.each([
    [17, '17s'],
    [305, '5m5s'],
    [3900, '1h5m'],
    [27254, '7h34m'],
  ])('shows %s seconds as its two largest units: %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it.each([
    [600, '10m'],
    [3600, '1h'],
    [3630, '1h'],
  ])('leaves a zero smaller unit out of %s seconds: %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it.each([[null], [0]])('returns nothing for %s', (seconds) => {
    expect(formatDuration(seconds)).toBe('');
  });
});

describe('formatYTDate', () => {
  it('returns Unknown when date is null', () => {
    expect(formatYTDate(null)).toBe('Unknown');
  });

  it('formats a date string by removing leading zeros from month and day', () => {
    expect(formatYTDate('20230102')).toBe('1/2/2023');
  });

  it('keeps double-digit months intact', () => {
    expect(formatYTDate('20231005')).toBe('10/5/2023');
  });
});
