const {
  normalizeRating,
  mapAgeLimit,
  mapFromEntry,
  determineEffectiveRating,
  mapToNumericRating,
} = require('../ratingMapper');

describe('ratingMapper', () => {
  describe('normalizeRating', () => {
    it('maps MPAA and TVPG codes case-insensitively', () => {
      expect(normalizeRating('mpaaR')).toBe('R');
      expect(normalizeRating('MPAAR')).toBe('R');
      expect(normalizeRating('tvpg14')).toBe('TV-14');
      expect(normalizeRating('TvPgMa')).toBe('TV-MA');
    });

    it('returns null for unknown ratings', () => {
      expect(normalizeRating('unknown')).toBe(null);
      expect(normalizeRating('')).toBe(null);
      expect(normalizeRating(null)).toBe(null);
    });
  });

  describe('mapAgeLimit', () => {
    it('maps age limits to normalized ratings', () => {
      expect(mapAgeLimit(7)).toBe('TV-PG');
      expect(mapAgeLimit(13)).toBe('TV-14');
      expect(mapAgeLimit(16)).toBe('PG-13');
      expect(mapAgeLimit(18)).toBe('R');
    });

    it('returns null for age limit 0 (unrated)', () => {
      expect(mapAgeLimit(0)).toBe(null);
    });

    it('returns null for invalid values', () => {
      expect(mapAgeLimit(undefined)).toBe(null);
      expect(mapAgeLimit(null)).toBe(null);
      expect(mapAgeLimit('invalid')).toBe(null);
    });
  });

  describe('mapFromEntry', () => {
    it('prefers MPAA ratings when available', () => {
      const result = mapFromEntry({ mpaaRating: 'mpaaPg13', tvpgRating: 'tvpg14' }, null);
      expect(result.normalized_rating).toBe('PG-13');
      expect(result.source).toBe('youtube:mpaaPg13');
    });

    it('falls back to TVPG ratings when MPAA is absent', () => {
      const result = mapFromEntry({ tvpgRating: 'tvpg14' }, null);
      expect(result.normalized_rating).toBe('TV-14');
      expect(result.source).toBe('youtube:tvpg14');
    });

    it('handles YouTube age-restricted rating', () => {
      const result = mapFromEntry({ ytRating: 'ytAgeRestricted' }, null);
      expect(result.normalized_rating).toBe('R');
      expect(result.source).toBe('youtube:ytAgeRestricted');
    });

    it('falls back to age_limit when no explicit rating exists', () => {
      const result = mapFromEntry(null, 18);
      expect(result.normalized_rating).toBe('R');
      expect(result.source).toBe('yt-dlp:age_limit=18');
    });

    it('maps age_limit of 0 to null (unrated)', () => {
      const result = mapFromEntry(null, 0);
      expect(result.normalized_rating).toBe(null);
      expect(result.source).toBe(null);
    });

    it('returns null when no rating data is present', () => {
      const result = mapFromEntry(null, null);
      expect(result.normalized_rating).toBe(null);
      expect(result.source).toBe(null);
    });
  });

  describe('determineEffectiveRating', () => {
    it('prioritizes manual override over everything', () => {
      const jsonData = { content_rating: { mpaaRating: 'mpaaPg13' }, age_limit: 18 };
      expect(determineEffectiveRating(jsonData, 'TV-14', 'R')).toEqual({
        normalized_rating: 'R',
        numeric_rating: 4,
        rating_source: 'Manual Override'
      });
    });

    it('treats manual override "NR" as null', () => {
      const jsonData = { content_rating: { mpaaRating: 'mpaaPg13' }, age_limit: 18 };
      expect(determineEffectiveRating(jsonData, 'TV-14', 'NR')).toEqual({
        normalized_rating: null,
        numeric_rating: null,
        rating_source: 'Manual Override'
      });
    });

    it('applies channel default when no manual override', () => {
      const jsonData = { content_rating: null, age_limit: null };
      expect(determineEffectiveRating(jsonData, 'TV-14', undefined)).toEqual({
        normalized_rating: 'TV-14',
        numeric_rating: 3,
        rating_source: 'Channel Default'
      });
    });

    it('ignores channel default "NR"', () => {
      const jsonData = { content_rating: null, age_limit: null };
      expect(determineEffectiveRating(jsonData, 'NR', undefined)).toEqual({
        normalized_rating: null,
        numeric_rating: null,
        rating_source: null
      });
    });

    it('falls back to metadata rating when no override or channel default', () => {
      const jsonData = { content_rating: { mpaaRating: 'mpaaPg13' }, age_limit: null };
      expect(determineEffectiveRating(jsonData, null, undefined)).toEqual({
        normalized_rating: 'PG-13',
        numeric_rating: 3,
        rating_source: 'youtube:mpaaPg13'
      });
    });

    it('returns null when no rating information available', () => {
      const jsonData = { content_rating: null, age_limit: null };
      expect(determineEffectiveRating(jsonData, null, undefined)).toEqual({
        normalized_rating: null,
        numeric_rating: null,
        rating_source: null
      });
    });
  });

  describe('mapToNumericRating', () => {
    it('maps G and G equivalents to 1', () => {
      expect(mapToNumericRating('G')).toBe(1);
      expect(mapToNumericRating('TV-Y')).toBe(1);
      expect(mapToNumericRating('TV-G')).toBe(1);
    });

    it('maps PG and PG equivalents to 2', () => {
      expect(mapToNumericRating('PG')).toBe(2);
      expect(mapToNumericRating('TV-PG')).toBe(2);
    });

    it('maps PG-13 and PG-13 equivalents to 3', () => {
      expect(mapToNumericRating('PG-13')).toBe(3);
      expect(mapToNumericRating('TV-14')).toBe(3);
    });

    it('maps R and R equivalents to 4', () => {
      expect(mapToNumericRating('R')).toBe(4);
      expect(mapToNumericRating('TV-MA')).toBe(4);
      expect(mapToNumericRating('NC-17')).toBe(4);
    });

    it('returns null for NR and unknown ratings', () => {
      expect(mapToNumericRating(null)).toBe(null);
      expect(mapToNumericRating('')).toBe(null);
      expect(mapToNumericRating('unknown')).toBe(null);
      expect(mapToNumericRating('NR')).toBe(null);
    });
  });
});
