const { parseIso8601Duration } = require('../durationParser');

describe('parseIso8601Duration', () => {
  test('parses hours, minutes, seconds', () => {
    expect(parseIso8601Duration('PT1H2M3S')).toBe(3723);
  });

  test('parses minutes and seconds only', () => {
    expect(parseIso8601Duration('PT15M33S')).toBe(933);
  });

  test('parses seconds only', () => {
    expect(parseIso8601Duration('PT42S')).toBe(42);
  });

  test('parses zero', () => {
    expect(parseIso8601Duration('PT0S')).toBe(0);
  });

  test('returns null for invalid input', () => {
    expect(parseIso8601Duration('invalid')).toBeNull();
    expect(parseIso8601Duration('')).toBeNull();
    expect(parseIso8601Duration(null)).toBeNull();
    expect(parseIso8601Duration(undefined)).toBeNull();
  });

  test('handles live streams (PT0S) and large durations', () => {
    expect(parseIso8601Duration('PT10H')).toBe(36000);
  });
});
