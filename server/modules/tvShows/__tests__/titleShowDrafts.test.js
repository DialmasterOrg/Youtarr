jest.mock('../../titleFilterRegex', () => ({ checkPatterns: jest.fn() }));

const titleFilterRegex = require('../../titleFilterRegex');
const { normalizeDrafts, defaultLibraryFolder, assertDraftsCompile, MAX_PATTERNS_PER_SHOW } = require('../titleShowDrafts');

const layoutOf = (folder) => (['TV Shows', 'Anime'].includes(folder) ? 'tv' : 'videos');
const context = { layoutOf, defaultLibraryFolder: 'TV Shows' };

function draft(overrides = {}) {
  return {
    name: 'Beyblade',
    patterns: [{ text: 'BEYBLADE EN Episode {episode}: {title}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'title' }],
    ...overrides,
  };
}

describe('titleShowDrafts', () => {
  describe('normalizeDrafts', () => {
    it('keys a new show by its position and an existing one by its id', () => {
      const [created, existing] = normalizeDrafts([draft(), draft({ id: 4, name: 'V-Force' })], context);
      expect([created.key, existing.key]).toEqual(['new:0', 'title:4']);
    });

    it('defaults the folder name to the sanitized show name', () => {
      const [show] = normalizeDrafts([draft({ name: 'Beyblade: V-Force?' })], context);
      expect(show.folderName).toBe('Beyblade： V-Force？');
    });

    it('defaults the library folder', () => {
      expect(normalizeDrafts([draft()], context)[0].libraryFolder).toBe('TV Shows');
    });

    it('stores a TV folder under its registered name, whatever the request\'s case', () => {
      const tvLayoutOf = (folder) => (folder.toLowerCase() === 'tv shows' ? 'tv' : 'videos');
      const drafts = normalizeDrafts([draft({ libraryFolder: 'tv shows' })], { layoutOf: tvLayoutOf, defaultLibraryFolder: 'TV Shows', tvFolders: ['TV Shows'] });
      expect(drafts[0].libraryFolder).toBe('TV Shows');
    });

    it('refuses a library folder that is not a TV folder', () => {
      expect(() => normalizeDrafts([draft({ libraryFolder: 'Kids' })], context)).toThrow('__Kids is not a TV folder');
    });

    it('asks for a TV folder when there is no default one', () => {
      expect(() => normalizeDrafts([draft()], { layoutOf, defaultLibraryFolder: null })).toThrow('Choose a TV folder');
    });

    it('refuses a folder name media servers treat as extras', () => {
      expect(() => normalizeDrafts([draft({ folderName: 'Extras' })], context)).toThrow('extras');
    });

    it('refuses two shows with the same folder in one library folder', () => {
      expect(() => normalizeDrafts([draft(), draft({ name: 'beyblade' })], context)).toThrow('same folder');
    });

    it('compiles each pattern', () => {
      const [show] = normalizeDrafts([draft()], context);
      expect(show.patterns[0]).toMatchObject({
        key: 'new:0#0',
        compiledRegex: '(?i)BEYBLADE\\s+EN\\s+Episode\\s+(?P<episode>[0-9]+):\\s+(?P<title>.+)$',
        seasonFixed: 1,
      });
    });

    it('names the show and pattern a pattern error belongs to', () => {
      const bad = draft({ patterns: [draft().patterns[0], { text: 'Ep {ep}', kind: 'simple', seasonSource: 'fixed', seasonFixed: 1, episodeSource: 'order' }] });
      expect(() => normalizeDrafts([bad], context)).toThrow('Beyblade, pattern 2: Unknown placeholder {ep}');
    });

    it('refuses sources that do not fit the pattern', () => {
      const bad = draft({ patterns: [{ text: 'Episode {episode}', kind: 'simple', seasonSource: 'title', episodeSource: 'title' }] });
      expect(() => normalizeDrafts([bad], context)).toThrow('{season}');
    });

    it('needs at least one pattern', () => {
      expect(() => normalizeDrafts([draft({ patterns: [] })], context)).toThrow('at least one pattern');
    });

    it('limits the number of patterns', () => {
      const patterns = Array.from({ length: MAX_PATTERNS_PER_SHOW + 1 }, () => draft().patterns[0]);
      expect(() => normalizeDrafts([draft({ patterns })], context)).toThrow(`${MAX_PATTERNS_PER_SHOW}`);
    });

    it('trims exclude terms and drops empty and repeated ones', () => {
      const [show] = normalizeDrafts([draft({ excludeTerms: [' Official Clip ', '', 'official clip', 'Dub'] })], context);
      expect(show.excludeTerms).toEqual(['Official Clip', 'Dub']);
    });

    it('keeps named seasons and drops empty names', () => {
      const [show] = normalizeDrafts([draft({ seasonNames: { 1: ' Beyblade ', 2: '', 3: 'G-Revolution' } })], context);
      expect(show.seasonNames).toEqual({ 1: 'Beyblade', 3: 'G-Revolution' });
    });

    it('refuses a season name for a season out of range', () => {
      expect(() => normalizeDrafts([draft({ seasonNames: { 200: 'Too far' } })], context)).toThrow('0 to 199');
    });

    it('names an upload-year season', () => {
      const [show] = normalizeDrafts([draft({ seasonNames: { 2024: 'The first year' } })], context);
      expect(show.seasonNames).toEqual({ 2024: 'The first year' });
    });

    it('refuses a season name beyond the years media servers read as seasons', () => {
      expect(() => normalizeDrafts([draft({ seasonNames: { 2501: 'Far future' } })], context)).toThrow('1928 to 2500');
    });

    it('refuses a show without a name', () => {
      expect(() => normalizeDrafts([draft({ name: '  ' })], context)).toThrow('needs a name');
    });

    it('refuses an input that is not a list', () => {
      expect(() => normalizeDrafts({ name: 'x' }, context)).toThrow('list');
    });
  });

  describe('defaultLibraryFolder', () => {
    it('uses the channel\'s folder when it is a TV folder', () => {
      expect(defaultLibraryFolder({ channelFolder: 'Anime', defaultFolder: 'TV Shows', tvFolders: ['Anime', 'TV Shows'], layoutOf })).toBe('Anime');
    });

    it('uses the default subfolder when it is a TV folder', () => {
      expect(defaultLibraryFolder({ channelFolder: 'Kids', defaultFolder: 'TV Shows', tvFolders: ['Anime', 'TV Shows'], layoutOf })).toBe('TV Shows');
    });

    it('uses the only TV folder', () => {
      expect(defaultLibraryFolder({ channelFolder: 'Kids', defaultFolder: '', tvFolders: ['Anime'], layoutOf })).toBe('Anime');
    });

    it('has none when there are several TV folders to choose from', () => {
      expect(defaultLibraryFolder({ channelFolder: 'Kids', defaultFolder: '', tvFolders: ['Anime', 'TV Shows'], layoutOf })).toBeNull();
    });
  });

  describe('assertDraftsCompile', () => {
    beforeEach(() => jest.clearAllMocks());

    it('checks every pattern, filter and exclude term in Python', async () => {
      titleFilterRegex.checkPatterns.mockImplementation(async (list) => list.map(() => null));
      const shows = normalizeDrafts([draft({ excludeTerms: ['Official Clip'] })], context);
      await assertDraftsCompile(shows);
      expect(titleFilterRegex.checkPatterns.mock.calls[0][0]).toEqual([
        shows[0].patterns[0].compiledRegex,
        shows[0].patterns[0].filterRegex,
        '(?i:Official\\s+Clip)',
      ]);
    });

    it('refuses a pattern Python can\'t compile, naming it', async () => {
      titleFilterRegex.checkPatterns.mockImplementation(async (list) => list.map((_, index) => (index === 0 ? 'bad escape' : null)));
      const shows = normalizeDrafts([draft()], context);
      await expect(assertDraftsCompile(shows)).rejects.toThrow('Beyblade, pattern 1: bad escape');
    });
  });
});
