const { showFolderNameProblem, sanitizeShowFolderName, folderNameKey } = require('../showFolderNames');

describe('showFolderNames', () => {
  describe('showFolderNameProblem', () => {
    it.each(['__kids', '.hidden', 'Season 01', 'Extras', 'a/b', ''])('flags %p', (name) => {
      expect(showFolderNameProblem(name)).not.toBeNull();
    });

    it('accepts an ordinary show name', () => {
      expect(showFolderNameProblem('Hermitcraft')).toBeNull();
    });
  });

  describe('sanitizeShowFolderName', () => {
    it('replaces characters folders can\'t hold like yt-dlp does', () => {
      expect(sanitizeShowFolderName('Life Series: Season 1?')).toBe('Life Series： Season 1？');
    });

    it('returns an empty name for nothing', () => {
      expect(sanitizeShowFolderName(null)).toBe('');
    });
  });

  describe('folderNameKey', () => {
    it('compares names ignoring case and accents', () => {
      expect(folderNameKey('TV', 'Pokémon')).toBe(folderNameKey('tv', 'POKEMON'));
    });

    it('tells library folders apart', () => {
      expect(folderNameKey('TV', 'Show')).not.toBe(folderNameKey('Anime', 'Show'));
    });
  });
});
