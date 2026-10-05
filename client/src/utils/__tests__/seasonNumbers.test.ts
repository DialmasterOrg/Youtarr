import { isAssignableSeason, MAX_SEASON, MAX_YEAR_SEASON, MIN_YEAR_SEASON, SEASON_RANGE_TEXT } from '../seasonNumbers';

describe('seasonNumbers', () => {
  test('accepts title seasons 0 to 199', () => {
    expect([isAssignableSeason(0), isAssignableSeason(MAX_SEASON)]).toEqual([true, true]);
  });

  test('accepts upload years 1928 to 2500', () => {
    expect([isAssignableSeason(MIN_YEAR_SEASON), isAssignableSeason(2024), isAssignableSeason(MAX_YEAR_SEASON)]).toEqual([true, true, true]);
  });

  test('refuses numbers between the ranges, outside them, and non-integers', () => {
    expect([200, 1927, 2501, -1, 1.5, NaN, null].map(isAssignableSeason)).toEqual([false, false, false, false, false, false, false]);
  });

  test('describes both ranges', () => {
    expect(SEASON_RANGE_TEXT).toBe('0-199, or a year 1928-2500');
  });
});
