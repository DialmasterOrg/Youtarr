import { getRatingLimit, isRatingAllowed } from '../ratings';

describe('ratings utility', () => {
  describe('getRatingLimit', () => {
    test('returns 7 for PG', () => {
      expect(getRatingLimit('PG')).toBe(7);
    });

    test('returns 18 for R', () => {
      expect(getRatingLimit('R')).toBe(18);
    });

    test('returns 0 for TV-Y', () => {
      expect(getRatingLimit('TV-Y')).toBe(0);
    });

    test('returns 0 for G', () => {
      expect(getRatingLimit('G')).toBe(0);
    });

    test('returns 16 for PG-13', () => {
      expect(getRatingLimit('PG-13')).toBe(16);
    });

    test('returns 18 for NC-17', () => {
      expect(getRatingLimit('NC-17')).toBe(18);
    });

    test('returns null for NR', () => {
      expect(getRatingLimit('NR')).toBeNull();
    });

    test('returns null for null input', () => {
      expect(getRatingLimit(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(getRatingLimit(undefined)).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(getRatingLimit('')).toBeNull();
    });

    test('returns null for unknown rating', () => {
      expect(getRatingLimit('XYZ')).toBeNull();
    });

    test('is case insensitive (lowercase pg)', () => {
      expect(getRatingLimit('pg')).toBe(7);
    });

    test('trims whitespace', () => {
      expect(getRatingLimit(' PG ')).toBe(7);
    });
  });

  describe('isRatingAllowed', () => {
    test('returns true when maxRating is empty (no limit set)', () => {
      expect(isRatingAllowed('R', '')).toBe(true);
    });

    test('returns true when maxRating is NR (NR has no limit)', () => {
      expect(isRatingAllowed('R', 'NR')).toBe(true);
    });

    test('returns true for unrated video (null rating) when maxRating is PG', () => {
      expect(isRatingAllowed(null, 'PG')).toBe(true);
    });

    test('returns true for unrated video (undefined rating) when maxRating is PG', () => {
      expect(isRatingAllowed(undefined, 'PG')).toBe(true);
    });

    test('returns true for unrated video (empty string) when maxRating is PG', () => {
      expect(isRatingAllowed('', 'PG')).toBe(true);
    });

    test('returns true when rating equals max (PG vs PG)', () => {
      expect(isRatingAllowed('PG', 'PG')).toBe(true);
    });

    test('returns true when rating is stricter than max (G vs PG)', () => {
      expect(isRatingAllowed('G', 'PG')).toBe(true);
    });

    test('returns false when rating is looser than max (R vs PG)', () => {
      expect(isRatingAllowed('R', 'PG')).toBe(false);
    });

    test('returns true for unknown rating (treated as unlimited)', () => {
      expect(isRatingAllowed('XYZ', 'PG')).toBe(true);
    });
  });
});
