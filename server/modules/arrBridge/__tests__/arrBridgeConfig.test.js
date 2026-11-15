/* eslint-env jest */
const {
  DEFAULT_CATEGORIES,
  DEFAULT_EXCLUDE_TERMS,
  NEWZNAB_CATEGORIES,
  readSettings,
  isEnabled,
  isAuthorized,
  generateKey,
  kindForCategories,
} = require('../arrBridgeConfig');

const KEY = 'a'.repeat(64);

describe('arrBridgeConfig', () => {
  describe('readSettings', () => {
    test('returns the defaults for a config without bridge fields', () => {
      expect(readSettings({})).toEqual({
        enabled: false,
        apiKey: null,
        categories: DEFAULT_CATEGORIES,
        looseMatching: false,
        excludeTerms: DEFAULT_EXCLUDE_TERMS,
        minTvSeconds: 600,
        minMovieSeconds: 3600,
        stagingPath: null,
        retentionDays: 7,
      });
    });

    test('is enabled only for a literal true', () => {
      expect(readSettings({ arrBridgeEnabled: true }).enabled).toBe(true);
      expect(readSettings({ arrBridgeEnabled: 'true' }).enabled).toBe(false);
      expect(readSettings({ arrBridgeEnabled: 1 }).enabled).toBe(false);
    });

    test('falls back to the default categories when the list is not an array', () => {
      expect(readSettings({ arrBridgeCategories: 'tv' }).categories).toEqual(DEFAULT_CATEGORIES);
    });

    test('drops category names that could leave the staging folder', () => {
      const settings = readSettings({
        arrBridgeCategories: [{ name: '../x' }, { name: 'a/b' }, { name: '*' }, { name: '' }, null, 'tv'],
      });
      expect(settings.categories).toEqual(DEFAULT_CATEGORIES);
    });

    test('keeps one entry per category name, ignoring case', () => {
      const settings = readSettings({
        arrBridgeCategories: [{ name: 'tv-4k', subfolder: 'Shows' }, { name: 'TV-4K' }],
      });
      expect(settings.categories).toEqual([{ name: 'tv-4k', subfolder: 'Shows' }]);
    });

    test('clears a category subfolder that is not a valid subfolder name', () => {
      const settings = readSettings({ arrBridgeCategories: [{ name: 'tv', subfolder: '../../etc' }] });
      expect(settings.categories).toEqual([{ name: 'tv', subfolder: null }]);
    });

    test('keeps at most ten categories', () => {
      const many = Array.from({ length: 15 }, (_, index) => ({ name: `cat${index}` }));
      expect(readSettings({ arrBridgeCategories: many }).categories).toHaveLength(10);
    });

    test('uses the default minimum for a negative or non-numeric value', () => {
      expect(readSettings({ arrBridgeMinTvMinutes: -5 }).minTvSeconds).toBe(600);
      expect(readSettings({ arrBridgeMinMovieMinutes: 'long' }).minMovieSeconds).toBe(3600);
    });

    test('accepts a zero minimum and caps a huge one', () => {
      expect(readSettings({ arrBridgeMinTvMinutes: 0 }).minTvSeconds).toBe(0);
      expect(readSettings({ arrBridgeMinMovieMinutes: 100000 }).minMovieSeconds).toBe(600 * 60);
    });

    test('normalizes exclude terms and falls back when the list is unusable', () => {
      expect(readSettings({ arrBridgeExcludeTerms: [' Trailer ', '', 7, 'Fan Edit'] }).excludeTerms)
        .toEqual(['trailer', 'fan edit']);
      expect(readSettings({ arrBridgeExcludeTerms: 'trailer' }).excludeTerms).toEqual(DEFAULT_EXCLUDE_TERMS);
    });

    test('accepts an explicitly empty exclude list', () => {
      expect(readSettings({ arrBridgeExcludeTerms: [] }).excludeTerms).toEqual([]);
    });

    test('accepts only an absolute staging path without parent segments', () => {
      expect(readSettings({ arrBridgeStagingPath: '/downloads/staging/' }).stagingPath).toBe('/downloads/staging');
      expect(readSettings({ arrBridgeStagingPath: 'relative/path' }).stagingPath).toBeNull();
      expect(readSettings({ arrBridgeStagingPath: '/data/../etc' }).stagingPath).toBeNull();
      expect(readSettings({ arrBridgeStagingPath: 12 }).stagingPath).toBeNull();
    });

    test('keeps a retention between 1 and 365 days', () => {
      expect(readSettings({ arrBridgeStagingRetentionDays: 30 }).retentionDays).toBe(30);
      expect(readSettings({ arrBridgeStagingRetentionDays: 0 }).retentionDays).toBe(7);
      expect(readSettings({ arrBridgeStagingRetentionDays: 2.5 }).retentionDays).toBe(7);
    });

    test('reports a stored key and ignores an empty one', () => {
      expect(readSettings({ arrBridgeApiKey: KEY }).apiKey).toBe(KEY);
      expect(readSettings({ arrBridgeApiKey: '' }).apiKey).toBeNull();
    });
  });

  describe('isAuthorized', () => {
    const config = { arrBridgeEnabled: true, arrBridgeApiKey: KEY };

    test('accepts the stored key', () => {
      expect(isAuthorized(config, KEY)).toBe(true);
    });

    test('rejects a wrong key of another length', () => {
      expect(isAuthorized(config, 'wrong')).toBe(false);
    });

    test('rejects a candidate that is not a string', () => {
      expect(isAuthorized(config, [KEY])).toBe(false);
      expect(isAuthorized(config, undefined)).toBe(false);
    });

    test('rejects every key while the bridge is off', () => {
      expect(isAuthorized({ arrBridgeEnabled: false, arrBridgeApiKey: KEY }, KEY)).toBe(false);
    });

    test('rejects every key while none is stored', () => {
      expect(isAuthorized({ arrBridgeEnabled: true }, '')).toBe(false);
    });
  });

  test('isEnabled follows the flag', () => {
    expect(isEnabled({ arrBridgeEnabled: true })).toBe(true);
    expect(isEnabled({})).toBe(false);
    expect(isEnabled(null)).toBe(false);
  });

  test('generateKey returns 64 hex characters, different each time', () => {
    const first = generateKey();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(generateKey()).not.toBe(first);
  });

  describe('kindForCategories', () => {
    test('a movie category wins over a TV one', () => {
      expect(kindForCategories([2000, 5030], 'search')).toBe('movie');
    });

    test('TV categories mean TV', () => {
      expect(kindForCategories([5030, 5040], 'search')).toBe('tv');
    });

    test('falls back to the function when there are no categories', () => {
      expect(kindForCategories([], 'tvsearch')).toBe('tv');
      expect(kindForCategories([], 'movie')).toBe('movie');
      expect(kindForCategories([], 'search')).toBeNull();
    });
  });

  test('advertises the categories Radarr tests for', () => {
    const movies = NEWZNAB_CATEGORIES.find((category) => category.id === 2000);
    expect(movies.subcategories.map((sub) => sub.id)).toEqual([2010, 2020, 2030, 2040, 2045, 2050, 2060]);
    const tv = NEWZNAB_CATEGORIES.find((category) => category.id === 5000);
    expect(tv.subcategories.map((sub) => sub.id)).toEqual([5030, 5040]);
  });
});
