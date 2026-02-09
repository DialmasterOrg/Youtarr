const {
  normalizeRating,
  mapAgeLimit,
  mapFromEntry,
  applyChannelDefault,
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
      expect(mapAgeLimit(0)).toBe('TV-G');
      expect(mapAgeLimit(7)).toBe('TV-PG');
      expect(mapAgeLimit(13)).toBe('TV-14');
      expect(mapAgeLimit(16)).toBe('PG-13');
      expect(mapAgeLimit(18)).toBe('R');
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

    it('maps age_limit of 0 to TV-G', () => {
      const result = mapFromEntry(null, 0);
      expect(result.normalized_rating).toBe('TV-G');
      expect(result.source).toBe('yt-dlp:age_limit=0');
    });

    it('returns null when no rating data is present', () => {
      const result = mapFromEntry(null, null);
      expect(result.normalized_rating).toBe(null);
      expect(result.source).toBe(null);
    });
  });

  describe('applyChannelDefault', () => {
    it('keeps existing video rating', () => {
      expect(applyChannelDefault('R', 'PG')).toBe('R');
    });

    it('applies channel default when video rating missing', () => {
      expect(applyChannelDefault(null, 'TV-14')).toBe('TV-14');
    });

    it('returns null when neither rating exists', () => {
      expect(applyChannelDefault(null, null)).toBe(null);
    });
  });
});
