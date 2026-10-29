import {
  EXTERNAL_RATING_BANDS,
  formatExternalRatingBand,
  getExternalRatingBand,
} from '../externalRatingPolicy';

describe('external rating policy labels', () => {
  test('maps every internal level to explicit movie and TV ratings', () => {
    expect(EXTERNAL_RATING_BANDS).toEqual([
      expect.objectContaining({ level: 1, movieRatings: ['G'], tvRatings: ['TV-Y', 'TV-G'] }),
      expect.objectContaining({ level: 2, movieRatings: ['PG'], tvRatings: ['TV-Y7', 'TV-PG'] }),
      expect.objectContaining({ level: 3, movieRatings: ['PG-13'], tvRatings: ['TV-14'] }),
      expect.objectContaining({ level: 4, movieRatings: ['R', 'NC-17'], tvRatings: ['TV-MA'] }),
    ]);
  });

  test('formats a rating ceiling without exposing the numeric implementation detail', () => {
    expect(formatExternalRatingBand(3)).toBe('Teen · Movies PG-13 · TV TV-14');
    expect(getExternalRatingBand(99).label).toBe('Mature');
  });
});
