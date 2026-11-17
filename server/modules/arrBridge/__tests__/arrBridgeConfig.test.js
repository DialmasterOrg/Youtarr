/* eslint-env jest */
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_CATEGORIES,
  SETTING_KEYS,
  getSettingsError,
  cleanSettings,
  correctStoredSettings,
  parseConnectionInput,
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
        resolution: null,
        labelLimit: null,
        removeAfterImport: false,
        sonarr: null,
        radarr: null,
      });
    });

    test('removes the library copy after an import only when switched on', () => {
      expect(readSettings({ arrBridgeRemoveAfterImport: true }).removeAfterImport).toBe(true);
      expect(readSettings({ arrBridgeRemoveAfterImport: 'yes' }).removeAfterImport).toBe(false);
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

    test('reads the resolution for grabs, and follows the preferred resolution for anything else', () => {
      expect(readSettings({ arrBridgeResolution: '1080' }).resolution).toBe('1080');
      expect(readSettings({ arrBridgeResolution: '' }).resolution).toBeNull();
      expect(readSettings({ arrBridgeResolution: '1440' }).resolution).toBeNull();
      expect(readSettings({ arrBridgeResolution: 1080 }).resolution).toBeNull();
    });

    test('reads the label limit as a number, and no limit for anything else', () => {
      expect(readSettings({ arrBridgeLabelLimit: '720' }).labelLimit).toBe(720);
      expect(readSettings({ arrBridgeLabelLimit: '480' }).labelLimit).toBe(480);
      expect(readSettings({ arrBridgeLabelLimit: '' }).labelLimit).toBeNull();
      expect(readSettings({ arrBridgeLabelLimit: '2160' }).labelLimit).toBeNull();
      expect(readSettings({ arrBridgeLabelLimit: 720 }).labelLimit).toBeNull();
    });

    test('reports a stored key and ignores an empty one', () => {
      expect(readSettings({ arrBridgeApiKey: KEY }).apiKey).toBe(KEY);
      expect(readSettings({ arrBridgeApiKey: '' }).apiKey).toBeNull();
    });
  });

  describe('Sonarr and Radarr connections', () => {
    const SONARR_KEY = 'abc123def456';

    test('reads a Sonarr connection and trims the URL', () => {
      const settings = readSettings({
        arrBridgeSonarrUrl: 'http://sonarr:8989/sonarr/',
        arrBridgeSonarrApiKey: ` ${SONARR_KEY} `,
      });
      expect(settings.sonarr).toEqual({ url: 'http://sonarr:8989/sonarr', apiKey: SONARR_KEY });
      expect(settings.radarr).toBeNull();
    });

    test('reads a Radarr connection on its own', () => {
      const settings = readSettings({
        arrBridgeRadarrUrl: 'https://radarr.example.com',
        arrBridgeRadarrApiKey: SONARR_KEY,
      });
      expect(settings.radarr).toEqual({ url: 'https://radarr.example.com', apiKey: SONARR_KEY });
      expect(settings.sonarr).toBeNull();
    });

    test('a connection needs both a URL and a key', () => {
      expect(readSettings({ arrBridgeSonarrUrl: 'http://sonarr:8989' }).sonarr).toBeNull();
      expect(readSettings({ arrBridgeSonarrApiKey: SONARR_KEY }).sonarr).toBeNull();
    });

    test.each([
      ['another scheme', 'ftp://sonarr:8989'],
      ['a script URL', 'javascript:alert(1)'],
      ['credentials in the URL', 'http://user:pw@sonarr:8989'],
      ['a query string', 'http://sonarr:8989/?a=1'],
      ['a fragment', 'http://sonarr:8989/#x'],
      ['text that is no URL', 'not a url'],
      ['an overlong URL', `http://sonarr:8989/${'a'.repeat(600)}`],
      ['a non-string', 8989],
    ])('rejects %s', (_label, url) => {
      expect(readSettings({ arrBridgeSonarrUrl: url, arrBridgeSonarrApiKey: SONARR_KEY }).sonarr).toBeNull();
    });

    test.each([
      ['whitespace inside', 'a b'],
      ['a header injection', 'abc\r\nX-Evil: 1'],
      ['an overlong key', 'a'.repeat(200)],
      ['an empty key', '   '],
      ['a non-string', 12345678],
    ])('rejects a key with %s', (_label, apiKey) => {
      expect(readSettings({ arrBridgeSonarrUrl: 'http://sonarr:8989', arrBridgeSonarrApiKey: apiKey }).sonarr).toBeNull();
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

  describe('settings saved from the Settings page', () => {
    const DEFAULTS = {
      arrBridgeEnabled: false,
      arrBridgeCategories: [{ name: 'tv', subfolder: null }, { name: 'movies', subfolder: null }],
      arrBridgeLooseMatching: false,
      arrBridgeExcludeTerms: [...DEFAULT_EXCLUDE_TERMS],
      arrBridgeMinTvMinutes: 10,
      arrBridgeMinMovieMinutes: 60,
      arrBridgeStagingPath: '',
      arrBridgeStagingRetentionDays: 7,
      arrBridgeResolution: '',
      arrBridgeLabelLimit: '',
      arrBridgeRemoveAfterImport: false,
    };
    const categories = (count) => Array.from({ length: count }, (_, index) => ({ name: `cat${index}`, subfolder: null }));

    test('names the eleven settings', () => {
      expect([...SETTING_KEYS].sort()).toEqual(Object.keys(DEFAULTS).sort());
    });

    test('accepts the defaults', () => {
      expect(getSettingsError(DEFAULTS)).toBeNull();
    });

    test('only checks keys that are present', () => {
      expect(getSettingsError({})).toBeNull();
      expect(getSettingsError({ darkModeEnabled: 'whatever' })).toBeNull();
    });

    test.each([
      ['two names that differ only by case', [{ name: 'tv' }, { name: 'TV' }]],
      ['an 11th category', categories(11)],
      ['an empty list', []],
      ['a path-like name', [{ name: '../x' }]],
      ['a name with a space', [{ name: 'a b' }]],
      ['a subfolder that is a path', [{ name: 'tv', subfolder: '../outside' }]],
      ['something that is not a list', 'tv'],
    ])('rejects categories with %s', (_label, value) => {
      expect(getSettingsError({ arrBridgeCategories: value })).toMatch(/^Sonarr\/Radarr categories:/);
    });

    // The subfolder list in Settings can hold a legacy name the validator
    // refuses, and the generic message would not say which choice to change.
    test('names the category whose subfolder cannot be used', () => {
      expect(getSettingsError({
        arrBridgeCategories: [{ name: 'movies', subfolder: null }, { name: 'tv', subfolder: 'Kids & Co' }],
      })).toBe(
        'Sonarr/Radarr categories: the subfolder chosen for "tv" cannot be used. Subfolder name can only contain letters, numbers, spaces, hyphens, and underscores'
      );
    });

    test('accepts a category with a subfolder, an empty one or none', () => {
      expect(getSettingsError({
        arrBridgeCategories: [{ name: 'tv', subfolder: 'Shows' }, { name: 'tv-4k', subfolder: '' }, { name: 'movies' }],
      })).toBeNull();
    });

    test.each([
      ['a term over 60 characters', ['x'.repeat(61)]],
      ['a term that is not text', ['trailer', 5]],
      ['an empty term', ['trailer', '  ']],
      ['101 terms', Array.from({ length: 101 }, (_, index) => `term${index}`)],
      ['something that is not a list', 'trailer'],
    ])('rejects excluded words with %s', (_label, value) => {
      expect(getSettingsError({ arrBridgeExcludeTerms: value })).toMatch(/^Sonarr\/Radarr excluded words:/);
    });

    test('accepts an empty list of excluded words', () => {
      expect(getSettingsError({ arrBridgeExcludeTerms: [] })).toBeNull();
    });

    test.each([-1, 601, 'ten', Number.NaN, null])('rejects a minimum length of %p', (value) => {
      expect(getSettingsError({ arrBridgeMinTvMinutes: value })).toMatch(/^Sonarr\/Radarr minimum length/);
      expect(getSettingsError({ arrBridgeMinMovieMinutes: value })).toMatch(/^Sonarr\/Radarr minimum length/);
    });

    test.each([0, 366, 1.5, '7'])('rejects a retention of %p days', (value) => {
      expect(getSettingsError({ arrBridgeStagingRetentionDays: value })).toMatch(/^Sonarr\/Radarr staged file retention/);
    });

    test.each(['data/staging', '/data/../etc', 5, `/${'x'.repeat(500)}`])('rejects the staging path %p', (value) => {
      expect(getSettingsError({ arrBridgeStagingPath: value })).toMatch(/^Sonarr\/Radarr staging path/);
    });

    test('accepts an empty staging path and an absolute one', () => {
      expect(getSettingsError({ arrBridgeStagingPath: '' })).toBeNull();
      expect(getSettingsError({ arrBridgeStagingPath: '/downloads/.arr-staging/' })).toBeNull();
    });

    // Sonarr and Radarr on Windows know the folder by a drive or a share.
    test.each([
      ['E:\\Youtube16TB\\.arr-staging\\', 'E:\\Youtube16TB\\.arr-staging'],
      ['E:/Youtube16TB/.arr-staging', 'E:\\Youtube16TB\\.arr-staging'],
      ['\\\\nas\\videos\\.arr-staging', '\\\\nas\\videos\\.arr-staging'],
    ])('accepts the Windows staging path %p, and its saved form needs no correction', (value, savedForm) => {
      expect(getSettingsError({ arrBridgeStagingPath: value })).toBeNull();
      const saved = cleanSettings({ arrBridgeStagingPath: value });

      expect(saved.arrBridgeStagingPath).toBe(savedForm);
      expect(correctStoredSettings(saved)).toEqual([]);
      expect(readSettings(saved).stagingPath).toBe(savedForm);
    });

    test.each(['E:\\', 'E:\\Videos\\..\\Windows', '\\\\nas'])('rejects the Windows staging path %p', (value) => {
      expect(getSettingsError({ arrBridgeStagingPath: value })).toMatch(/^Sonarr\/Radarr staging path/);
    });

    test.each(['yes', 1, null])('rejects %p for a switch', (value) => {
      expect(getSettingsError({ arrBridgeEnabled: value })).toMatch(/^Sonarr\/Radarr/);
      expect(getSettingsError({ arrBridgeLooseMatching: value })).toMatch(/^Sonarr\/Radarr/);
      expect(getSettingsError({ arrBridgeRemoveAfterImport: value })).toMatch(/^Sonarr\/Radarr/);
    });

    test('a hand-edited remove-after-import value that is not a switch is turned off', () => {
      expect(correctStoredSettings({ arrBridgeRemoveAfterImport: 'yes' }))
        .toEqual([{ key: 'arrBridgeRemoveAfterImport', previous: 'yes', replacement: false }]);
    });

    test('cleanSettings returns the saved form of the keys that are present', () => {
      expect(cleanSettings({
        arrBridgeExcludeTerms: [' Trailer ', 'trailer', 'Recap'],
        arrBridgeStagingPath: '/downloads/.arr-staging//',
        arrBridgeCategories: [{ name: 'tv', subfolder: '' }, { name: 'movies', subfolder: ' Films ', extra: 1 }],
        darkModeEnabled: true,
      })).toEqual({
        arrBridgeExcludeTerms: ['trailer', 'recap'],
        arrBridgeStagingPath: '/downloads/.arr-staging',
        arrBridgeCategories: [{ name: 'tv', subfolder: null }, { name: 'movies', subfolder: 'Films' }],
      });
    });

    // Otherwise a value saved today is "corrected" at the next startup.
    test.each(['/x /', '/x/ ', ' /downloads/.arr-staging// ', '/a/b/'])(
      'the saved form of the staging path %p needs no correction afterwards',
      (stagingPath) => {
        expect(getSettingsError({ arrBridgeStagingPath: stagingPath })).toBeNull();
        const saved = cleanSettings({ arrBridgeStagingPath: stagingPath });

        expect(saved.arrBridgeStagingPath).not.toMatch(/\s$|\/$/);
        expect(correctStoredSettings(saved)).toEqual([]);
      }
    );

    // "İ" lower-cases to two characters: such a word passed the length check
    // and was then dropped without a message when the list was saved.
    test('never accepts an excluded word that saving would drop', () => {
      const word = 'İ'.repeat(40);

      expect(getSettingsError({ arrBridgeExcludeTerms: [word] })).toMatch(/^Sonarr\/Radarr excluded words:/);
      expect(cleanSettings({ arrBridgeExcludeTerms: ['İstanbul'] }).arrBridgeExcludeTerms).toHaveLength(1);
    });

    test.each(['', '2160', '1080', '720', '480'])('accepts the resolution "%s"', (value) => {
      expect(getSettingsError({ arrBridgeResolution: value })).toBeNull();
    });

    // Sonarr and Radarr have no quality for 1440p or 360p.
    test.each(['1440', '360', 'best', 1080, null])('refuses the resolution %p', (value) => {
      expect(getSettingsError({ arrBridgeResolution: value })).toMatch(/^Sonarr\/Radarr resolution/);
    });

    test('a hand-edited resolution that cannot be saved goes back to following the preferred resolution', () => {
      expect(correctStoredSettings({ arrBridgeResolution: '1440' }))
        .toEqual([{ key: 'arrBridgeResolution', previous: '1440', replacement: '' }]);
      expect(correctStoredSettings({ arrBridgeResolution: '720' })).toEqual([]);
    });

    test.each(['', '1080', '720', '480'])('accepts the label limit "%s"', (value) => {
      expect(getSettingsError({ arrBridgeLabelLimit: value })).toBeNull();
    });

    test.each(['2160', '1440', 'best', 720, null])('refuses the label limit %p', (value) => {
      expect(getSettingsError({ arrBridgeLabelLimit: value })).toMatch(/^Sonarr\/Radarr label limit/);
    });

    test('a hand-edited label limit that cannot be saved goes back to no limit', () => {
      expect(correctStoredSettings({ arrBridgeLabelLimit: '2160' }))
        .toEqual([{ key: 'arrBridgeLabelLimit', previous: '2160', replacement: '' }]);
      expect(correctStoredSettings({ arrBridgeLabelLimit: '480' })).toEqual([]);
    });

    test('correctStoredSettings replaces hand-edited values that could not be saved', () => {
      const corrections = correctStoredSettings({
        arrBridgeCategories: [{ name: '../x' }],
        arrBridgeMinTvMinutes: 'ten',
        arrBridgeStagingRetentionDays: 0,
        arrBridgeExcludeTerms: 'trailer',
        arrBridgeEnabled: 'yes',
        arrBridgeStagingPath: 'relative/path',
      });
      expect(corrections).toEqual([
        { key: 'arrBridgeEnabled', previous: 'yes', replacement: false },
        { key: 'arrBridgeCategories', previous: [{ name: '../x' }], replacement: DEFAULTS.arrBridgeCategories },
        { key: 'arrBridgeExcludeTerms', previous: 'trailer', replacement: [...DEFAULT_EXCLUDE_TERMS] },
        { key: 'arrBridgeMinTvMinutes', previous: 'ten', replacement: 10 },
        { key: 'arrBridgeStagingPath', previous: 'relative/path', replacement: '' },
        { key: 'arrBridgeStagingRetentionDays', previous: 0, replacement: 7 },
      ]);
    });

    test('correctStoredSettings keeps the usable part of a hand-edited list', () => {
      expect(correctStoredSettings({
        arrBridgeCategories: [{ name: 'tv', subfolder: 'Shows' }, { name: 'bad name' }],
        arrBridgeExcludeTerms: ['Trailer', 7, 'recap'],
        arrBridgeMinMovieMinutes: 5000,
      })).toEqual([
        {
          key: 'arrBridgeCategories',
          previous: [{ name: 'tv', subfolder: 'Shows' }, { name: 'bad name' }],
          replacement: [{ name: 'tv', subfolder: 'Shows' }],
        },
        { key: 'arrBridgeExcludeTerms', previous: ['Trailer', 7, 'recap'], replacement: ['trailer', 'recap'] },
        { key: 'arrBridgeMinMovieMinutes', previous: 5000, replacement: 600 },
      ]);
    });

    test('correctStoredSettings leaves valid and absent settings alone', () => {
      expect(correctStoredSettings(DEFAULTS)).toEqual([]);
      expect(correctStoredSettings({})).toEqual([]);
    });

    test('what correctStoredSettings leaves or produces can always be saved', () => {
      const stored = {
        arrBridgeCategories: [{ name: 'tv', subfolder: '../x' }, { name: 'TV' }],
        arrBridgeExcludeTerms: ['ok', 'x'.repeat(80)],
        arrBridgeMinTvMinutes: -4,
        arrBridgeStagingRetentionDays: 9999,
      };
      const corrected = { ...stored };
      for (const { key, replacement } of correctStoredSettings(stored)) corrected[key] = replacement;
      expect(getSettingsError(corrected)).toBeNull();
    });

    test('the default exclude terms include parody and abridged', () => {
      expect(DEFAULT_EXCLUDE_TERMS).toEqual(expect.arrayContaining(['parody', 'abridged']));
    });

    test('the config template matches the defaults', () => {
      const template = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../../../../config/config.example.json'), 'utf8')
      );
      for (const [key, value] of Object.entries(DEFAULTS)) expect(template[key]).toEqual(value);
      expect(readSettings(template)).toEqual(readSettings({}));
    });
  });

  describe('parseConnectionInput', () => {
    test('returns a trimmed connection for a valid address and key', () => {
      expect(parseConnectionInput(' http://sonarr:8989/sonarr/ ', ' abc123 ')).toEqual({
        connection: { url: 'http://sonarr:8989/sonarr', apiKey: 'abc123' },
      });
    });

    test.each(['ftp://sonarr', 'http://user:pw@sonarr:8989', 'http://sonarr:8989/?a=1', 'sonarr:8989', '', undefined, 5])(
      'explains what is wrong with the address %p',
      (url) => {
        expect(parseConnectionInput(url, 'abc123')).toEqual({
          error: 'Enter the address as http:// or https://, without a username, password or query',
        });
      }
    );

    test.each(['', '   ', undefined, 5])('asks for the key when it is %p', (apiKey) => {
      expect(parseConnectionInput('http://sonarr:8989', apiKey)).toEqual({ error: 'Enter the API key' });
    });

    test.each(['a b', 'abc\r\nX-Evil: 1', 'k'.repeat(129)])('refuses the key %p', (apiKey) => {
      expect(parseConnectionInput('http://sonarr:8989', apiKey)).toEqual({
        error: 'The API key may only contain letters, digits and symbols, without spaces',
      });
    });
  });
});
