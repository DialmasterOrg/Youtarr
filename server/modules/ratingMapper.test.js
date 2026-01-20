const {
  normalizeRating,
  mapAgeLimit,
  mapFromEntry,
  applyChannelDefault,
  getRatingAgeLimit,
} = require('./ratingMapper');

describe('ratingMapper', () => {
  describe('normalizeRating', () => {
    it('should map MPAA ratings correctly', () => {
      expect(normalizeRating('mpaaR')).toBe('R');
      expect(normalizeRating('mpaaPg13')).toBe('PG-13');
      expect(normalizeRating('mpaaG')).toBe('G');
    });

    it('should map TVPG ratings correctly', () => {
      expect(normalizeRating('tvpg14')).toBe('TV-14');
      expect(normalizeRating('tvpgMa')).toBe('TV-MA');
      expect(normalizeRating('tvpgY')).toBe('TV-Y');
    });

    it('should return null for unmapped ratings', () => {
      expect(normalizeRating('unknownRating')).toBeNull();
      expect(normalizeRating(null)).toBeNull();
      expect(normalizeRating('')).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(normalizeRating('MPAAR')).toBe('R');
      expect(normalizeRating('TvPg14')).toBe('TV-14');
    });
  });

  describe('mapAgeLimit', () => {
    it('should map age 18+ to R', () => {
      expect(mapAgeLimit(18)).toBe('R');
      expect(mapAgeLimit(21)).toBe('R');
    });

    it('should map age 16-17 to PG-13', () => {
      expect(mapAgeLimit(16)).toBe('PG-13');
      expect(mapAgeLimit(17)).toBe('PG-13');
    });

    it('should map age 13-15 to TV-14', () => {
      expect(mapAgeLimit(13)).toBe('TV-14');
      expect(mapAgeLimit(15)).toBe('TV-14');
    });

    it('should map age 7-12 to TV-PG', () => {
      expect(mapAgeLimit(7)).toBe('TV-PG');
      expect(mapAgeLimit(12)).toBe('TV-PG');
    });

    it('should map age 0-6 to TV-G', () => {
      expect(mapAgeLimit(0)).toBe('TV-G');
      expect(mapAgeLimit(6)).toBe('TV-G');
    });

    it('should return null for invalid values', () => {
      expect(mapAgeLimit(null)).toBeNull();
      expect(mapAgeLimit(undefined)).toBeNull();
      expect(mapAgeLimit('invalid')).toBeNull();
    });
  });

  describe('mapFromEntry', () => {
    it('should prefer MPAA rating when available', () => {
      const contentRating = { mpaaRating: 'mpaaR', tvpgRating: 'tvpg14' };
      const result = mapFromEntry(contentRating, null);
      expect(result.normalized_rating).toBe('R');
      expect(result.source).toContain('mpaaR');
    });

    it('should fall back to TVPG rating if no MPAA', () => {
      const contentRating = { tvpgRating: 'tvpg14' };
      const result = mapFromEntry(contentRating, null);
      expect(result.normalized_rating).toBe('TV-14');
      expect(result.source).toContain('tvpg14');
    });

    it('should fall back to age_limit if no explicit rating', () => {
      const result = mapFromEntry(null, 18);
      expect(result.normalized_rating).toBe('R');
      expect(result.source).toContain('age_limit');
    });

    it('should return null rating if no information available', () => {
      const result = mapFromEntry(null, null);
      expect(result.normalized_rating).toBeNull();
      expect(result.source).toBeNull();
    });

    it('should handle age-restricted flag', () => {
      const contentRating = { ytRating: 'ytAgeRestricted' };
      const result = mapFromEntry(contentRating, null);
      expect(result.normalized_rating).toBe('R');
    });

    it('should respect custom priority order', () => {
      const contentRating = { mpaaRating: 'mpaaR', tvpgRating: 'tvpg14' };
      const result = mapFromEntry(contentRating, null, 'tvpg,mpaa');
      expect(result.normalized_rating).toBe('TV-14');
    });
  });

  describe('applyChannelDefault', () => {
    it('should return video rating if available', () => {
      const result = applyChannelDefault('R', 'PG');
      expect(result).toBe('R');
    });

    it('should use channel default if video has no rating', () => {
      const result = applyChannelDefault(null, 'PG');
      expect(result).toBe('PG');
    });

    it('should return null if both are unavailable', () => {
      const result = applyChannelDefault(null, null);
      expect(result).toBeNull();
    });
  });

  describe('getRatingAgeLimit', () => {
    it('should return age limits for ratings', () => {
      expect(getRatingAgeLimit('TV-14')).toBe(13);
      expect(getRatingAgeLimit('PG-13')).toBe(16);
      expect(getRatingAgeLimit('R')).toBe(18);
    });

    it('should return null for unknown ratings', () => {
      expect(getRatingAgeLimit('NR')).toBeNull();
      expect(getRatingAgeLimit('unknown')).toBeNull();
    });
  });
});
