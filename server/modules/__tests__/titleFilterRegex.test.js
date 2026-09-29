// Runs the real Python script: the point of this module is matching Python's
// re semantics exactly, which a mocked child process could not verify.
const titleFilterRegex = require('../titleFilterRegex');

describe('titleFilterRegex', () => {
  describe('checkSyntax', () => {
    test('accepts a valid pattern', () => {
      expect(titleFilterRegex.checkSyntax('Episode \\d+')).toEqual({ valid: true });
    });

    test('accepts Python-only named groups', () => {
      expect(titleFilterRegex.checkSyntax('(?P<num>\\d+)')).toEqual({ valid: true });
    });

    test('rejects a pattern that does not compile', () => {
      const result = titleFilterRegex.checkSyntax('[unclosed');
      expect(result.valid).toBe(false);
    });

    test('reports the Python compile error', () => {
      const result = titleFilterRegex.checkSyntax('[unclosed');
      expect(result.error).toMatch(/Invalid regex pattern/);
    });
  });

  describe('matchTitles', () => {
    test('returns one result per title in order', async () => {
      await expect(titleFilterRegex.matchTitles('Episode \\d+', ['Episode 12', 'Trailer', 'Episode 3']))
        .resolves.toEqual([true, false, true]);
    });

    test('matches case-sensitively like yt-dlp', async () => {
      await expect(titleFilterRegex.matchTitles('review', ['REVIEW'])).resolves.toEqual([false]);
    });

    test('honors an inline (?i) flag', async () => {
      await expect(titleFilterRegex.matchTitles('(?i)review', ['REVIEW'])).resolves.toEqual([true]);
    });

    test('handles non-ASCII titles', async () => {
      await expect(titleFilterRegex.matchTitles('Café', ['Le Café 🎬'])).resolves.toEqual([true]);
    });

    test('resolves an empty list without spawning Python', async () => {
      await expect(titleFilterRegex.matchTitles('[unclosed', [])).resolves.toEqual([]);
    });

    test('rejects when the pattern does not compile', async () => {
      await expect(titleFilterRegex.matchTitles('[unclosed', ['x'])).rejects.toThrow(/Invalid regex pattern/);
    });
  });
});
