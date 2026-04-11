/* eslint-env jest */

jest.mock('axios');
jest.mock('../../logger');

describe('plexModule', () => {
  let axios;
  let configModule;
  let plexModule;
  let logger;
  let config;

  beforeEach(() => {
    jest.resetModules();
    axios = require('axios');
    axios.get = jest.fn();
    axios.post = jest.fn();

    logger = require('../../logger');
    jest.clearAllMocks();

    config = {
      plexIP: '127.0.0.1',
      plexApiKey: 'existing-token',
      plexYoutubeLibraryId: '1',
      plexPort: '32400',
      plexUrl: null,
      uuid: 'test-uuid-1234'
    };

    configModule = {
      getConfig: jest.fn(() => config),
      updateConfig: jest.fn()
    };

    jest.doMock('../configModule', () => configModule);
    plexModule = require('../plexModule');
  });

  afterEach(() => {
    delete process.env.PLEX_URL;
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('getBaseUrl', () => {
    test('uses managed PLEX_URL when provided', () => {
      process.env.PLEX_URL = 'http://plex:32400';
      const result = plexModule.getBaseUrl('192.168.1.10', config, '8080');
      expect(result).toBe('http://plex:32400');
    });

    test('uses plexUrl from config when no env var', () => {
      config.plexUrl = 'http://config-plex:8888';
      const result = plexModule.getBaseUrl('192.168.1.10', config, '7777');
      expect(result).toBe('http://config-plex:8888');
    });

    test('falls back to IP and port when no URL available', () => {
      const result = plexModule.getBaseUrl('192.168.1.10', config, '8080');
      expect(result).toBe('http://192.168.1.10:8080');
    });

    test('uses config IP when preferredIp not provided', () => {
      const result = plexModule.getBaseUrl(null, config, '32400');
      expect(result).toBe('http://127.0.0.1:32400');
    });

    test('returns null when no IP or URL available', () => {
      config.plexIP = '';
      const result = plexModule.getBaseUrl('', config, '');
      expect(result).toBeNull();
    });

    test('defaults to port 32400 when no port provided', () => {
      const result = plexModule.getBaseUrl('192.168.1.10', config, null);
      expect(result).toBe('http://192.168.1.10:32400');
    });

    test('strips non-numeric characters from port', () => {
      const result = plexModule.getBaseUrl('192.168.1.10', config, 'port:8080');
      expect(result).toBe('http://192.168.1.10:8080');
    });

    test('defaults to 32400 for invalid port', () => {
      const result = plexModule.getBaseUrl('192.168.1.10', config, 'abc');
      expect(result).toBe('http://192.168.1.10:32400');
    });

    test('trims trailing slashes from URL', () => {
      config.plexUrl = 'http://plex:32400///';
      const result = plexModule.getBaseUrl(null, config, null);
      expect(result).toBe('http://plex:32400');
    });

    test('handles empty string port', () => {
      const result = plexModule.getBaseUrl('192.168.1.10', config, '');
      expect(result).toBe('http://192.168.1.10:32400');
    });

    test('handles whitespace in port', () => {
      const result = plexModule.getBaseUrl('192.168.1.10', config, '  8080  ');
      expect(result).toBe('http://192.168.1.10:8080');
    });

    test('handles zero as port', () => {
      const result = plexModule.getBaseUrl('192.168.1.10', config, 0);
      expect(result).toBe('http://192.168.1.10:0');
    });

    test('handles undefined config', () => {
      configModule.getConfig.mockReturnValue({ plexIP: '10.0.0.1', plexPort: '32401' });
      const result = plexModule.getBaseUrl('192.168.1.10', undefined, '8080');
      expect(result).toBe('http://192.168.1.10:8080');
    });

    test('uses https when plexViaHttps is true in config', () => {
      config.plexViaHttps = true;
      const result = plexModule.getBaseUrl('192.168.1.10', config, '8080');
      expect(result).toBe('https://192.168.1.10:8080');
    });

    test('uses http when plexViaHttps is false in config', () => {
      config.plexViaHttps = false;
      const result = plexModule.getBaseUrl('192.168.1.10', config, '8080');
      expect(result).toBe('http://192.168.1.10:8080');
    });

    test('uses http when plexViaHttps is undefined in config', () => {
      config.plexViaHttps = undefined;
      const result = plexModule.getBaseUrl('192.168.1.10', config, '8080');
      expect(result).toBe('http://192.168.1.10:8080');
    });

    test('preferredUseHttps parameter overrides config', () => {
      config.plexViaHttps = false;
      const result = plexModule.getBaseUrl('192.168.1.10', config, '8080', true);
      expect(result).toBe('https://192.168.1.10:8080');
    });

    test('preferredUseHttps false overrides config true', () => {
      config.plexViaHttps = true;
      const result = plexModule.getBaseUrl('192.168.1.10', config, '8080', false);
      expect(result).toBe('http://192.168.1.10:8080');
    });
  });

  describe('refreshLibrary', () => {
    test('successfully refreshes library using global config ID', async () => {
      const mockResponse = { status: 200, data: 'success' };
      axios.get.mockResolvedValue(mockResponse);

      const result = await plexModule.refreshLibrary();

      expect(axios.get).toHaveBeenCalledWith(
        'http://127.0.0.1:32400/library/sections/1/refresh?X-Plex-Token=existing-token'
      );
      expect(result).toBe(mockResponse);
      expect(logger.info).toHaveBeenCalledWith(
        { libraryId: '1' },
        'Refreshing Plex library'
      );
      expect(logger.info).toHaveBeenCalledWith(
        { libraryId: '1' },
        'Plex library refresh initiated successfully'
      );
    });

    test('uses explicit libraryId argument when provided', async () => {
      axios.get.mockResolvedValue({ status: 200 });

      await plexModule.refreshLibrary('5');

      expect(axios.get).toHaveBeenCalledWith(
        'http://127.0.0.1:32400/library/sections/5/refresh?X-Plex-Token=existing-token'
      );
    });

    test('skips refresh when missing baseUrl', async () => {
      config.plexIP = '';

      const result = await plexModule.refreshLibrary();

      expect(axios.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Skipping Plex refresh - missing server details or credentials');
    });

    test('skips refresh when missing API key', async () => {
      config.plexApiKey = '';

      const result = await plexModule.refreshLibrary();

      expect(axios.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Skipping Plex refresh - missing server details or credentials');
    });

    test('skips refresh when missing library ID', async () => {
      config.plexYoutubeLibraryId = null;

      const result = await plexModule.refreshLibrary();

      expect(axios.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('Skipping Plex refresh - missing server details or credentials');
    });

    test('handles connection refused error', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      axios.get.mockRejectedValue(error);

      const result = await plexModule.refreshLibrary();

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Failed to refresh Plex library');
      expect(logger.warn).toHaveBeenCalledWith('Could not connect to Plex server - continuing without refresh');
    });

    test('handles generic error', async () => {
      const error = new Error('Network error');
      axios.get.mockRejectedValue(error);

      const result = await plexModule.refreshLibrary();

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Failed to refresh Plex library');
    });

    test('skips refresh when libraryId is non-numeric', async () => {
      const result = await plexModule.refreshLibrary('../../admin');

      expect(axios.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        { libraryId: '../../admin' },
        'Skipping Plex refresh - invalid non-numeric library ID'
      );
    });

    test('skips refresh when libraryId contains letters', async () => {
      const result = await plexModule.refreshLibrary('abc');

      expect(axios.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test('allows valid numeric libraryId', async () => {
      axios.get.mockResolvedValue({ status: 200 });

      await plexModule.refreshLibrary('42');

      expect(axios.get).toHaveBeenCalledWith(
        'http://127.0.0.1:32400/library/sections/42/refresh?X-Plex-Token=existing-token'
      );
    });

    test('uses PLEX_URL from environment when available', async () => {
      process.env.PLEX_URL = 'http://env-plex:8080';
      axios.get.mockResolvedValue({ status: 200 });

      await plexModule.refreshLibrary();

      expect(axios.get).toHaveBeenCalledWith(
        'http://env-plex:8080/library/sections/1/refresh?X-Plex-Token=existing-token'
      );
    });
  });

  describe('getLibraryIdForSubfolder', () => {
    test('returns matching libraryId when a mapping exists for the subfolder', () => {
      config.plexSubfolderLibraryMappings = [
        { subfolder: 'kids', libraryId: '2' },
        { subfolder: 'music', libraryId: '3' },
      ];

      expect(plexModule.getLibraryIdForSubfolder('kids')).toBe('2');
      expect(plexModule.getLibraryIdForSubfolder('music')).toBe('3');
    });

    test('returns global plexYoutubeLibraryId when no mapping matches', () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'kids', libraryId: '2' }];

      expect(plexModule.getLibraryIdForSubfolder('unknown')).toBe('1');
    });

    test('returns mapping for root (null) subfolder', () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: null, libraryId: '4' }];

      expect(plexModule.getLibraryIdForSubfolder(null)).toBe('4');
    });

    test('falls back to global ID when mappings array is empty', () => {
      config.plexSubfolderLibraryMappings = [];

      expect(plexModule.getLibraryIdForSubfolder('anything')).toBe('1');
    });

    test('falls back to global ID when plexSubfolderLibraryMappings is undefined', () => {
      delete config.plexSubfolderLibraryMappings;

      expect(plexModule.getLibraryIdForSubfolder('kids')).toBe('1');
    });

    test('skips null and non-object entries in mappings array without throwing', () => {
      config.plexSubfolderLibraryMappings = [
        null,
        undefined,
        'bad-string',
        42,
        { subfolder: 'kids', libraryId: '2' },
      ];

      expect(plexModule.getLibraryIdForSubfolder('kids')).toBe('2');
      expect(plexModule.getLibraryIdForSubfolder('unknown')).toBe('1');
    });
  });

  describe('refreshLibraryForSubfolder', () => {
    test('refreshes the library mapped to the given subfolder', async () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'kids', libraryId: '2' }];
      axios.get.mockResolvedValue({ status: 200 });

      await plexModule.refreshLibraryForSubfolder('kids');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/library/sections/2/refresh')
      );
    });

    test('falls back to global library when no mapping for subfolder', async () => {
      config.plexSubfolderLibraryMappings = [];
      axios.get.mockResolvedValue({ status: 200 });

      await plexModule.refreshLibraryForSubfolder('unknown');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/library/sections/1/refresh')
      );
    });

    test('uses global library for null (root) subfolder when no root mapping', async () => {
      config.plexSubfolderLibraryMappings = [];
      axios.get.mockResolvedValue({ status: 200 });

      await plexModule.refreshLibraryForSubfolder(null);

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/library/sections/1/refresh')
      );
    });
  });

  describe('refreshLibrariesForSubfolders', () => {
    test('refreshes each distinct library once', async () => {
      config.plexSubfolderLibraryMappings = [
        { subfolder: 'kids', libraryId: '2' },
        { subfolder: 'music', libraryId: '3' },
      ];
      axios.get.mockResolvedValue({ status: 200 });

      await plexModule.refreshLibrariesForSubfolders(['kids', 'music', null]);

      // kids -> 2, music -> 3, null -> 1 (fallback): 3 distinct IDs → 3 calls
      expect(axios.get).toHaveBeenCalledTimes(3);
    });

    test('deduplicates when two different subfolders map to the same library ID', async () => {
      config.plexSubfolderLibraryMappings = [
        { subfolder: 'kids', libraryId: '2' },
        { subfolder: 'cartoons', libraryId: '2' }, // same target library as kids
      ];
      axios.get.mockResolvedValue({ status: 200 });

      await plexModule.refreshLibrariesForSubfolders(['kids', 'cartoons']);

      // Both resolve to library '2' — only one HTTP call should be made
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/library/sections/2/refresh')
      );
    });

    test('refreshes global fallback library when all subfolders are unmapped', async () => {
      config.plexSubfolderLibraryMappings = [];
      axios.get.mockResolvedValue({ status: 200 });

      await plexModule.refreshLibrariesForSubfolders([null, 'foo', 'bar']);

      // All three map to the global ID '1': deduplicated to one call
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/library/sections/1/refresh')
      );
    });

    test('handles empty subfolders array without making any calls', async () => {
      await plexModule.refreshLibrariesForSubfolders([]);

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('continues refreshing remaining libraries when one fails', async () => {
      config.plexSubfolderLibraryMappings = [
        { subfolder: 'kids', libraryId: '2' },
        { subfolder: 'music', libraryId: '3' },
      ];
      // Library '2' fails; library '3' must still be called and the promise must resolve
      axios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ status: 200 });

      await expect(
        plexModule.refreshLibrariesForSubfolders(['kids', 'music'])
      ).resolves.toBeUndefined();

      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshLibraryForSubfolder - error handling', () => {
    test('resolves to null when the underlying refresh fails', async () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'kids', libraryId: '2' }];
      // Force the axios call inside refreshLibrary to throw synchronously after try/catch
      // by making getBaseUrl produce a value but axios.get throwing past the catch
      // In practice refreshLibrary catches all errors and returns null, so this confirms
      // that the method resolves (does not throw) even when the underlying call fails.
      axios.get.mockRejectedValue(new Error('Unexpected'));

      await expect(plexModule.refreshLibraryForSubfolder('kids')).resolves.toBeNull();
    });
  });

  describe('getLibraries', () => {
    test('delegates to getLibrariesWithParams with config values', async () => {
      axios.get.mockResolvedValue({
        data: {
          MediaContainer: {
            Directory: [
              {
                key: '1',
                title: 'YouTube',
                Location: [{ id: 1, path: '/data/youtube' }]
              }
            ]
          }
        }
      });

      const result = await plexModule.getLibraries();

      expect(axios.get).toHaveBeenCalledWith(
        'http://127.0.0.1:32400/library/sections?X-Plex-Token=existing-token'
      );
      expect(result).toEqual([
        {
          id: '1',
          title: 'YouTube',
          locations: [{ id: 1, path: '/data/youtube' }]
        }
      ]);
    });

    test('uses https when config has plexViaHttps enabled', async () => {
      config.plexViaHttps = true;
      axios.get.mockResolvedValue({
        data: {
          MediaContainer: {
            Directory: [
              {
                key: '1',
                title: 'YouTube',
                Location: [{ id: 1, path: '/data/youtube' }]
              }
            ]
          }
        }
      });

      const result = await plexModule.getLibraries();

      expect(axios.get).toHaveBeenCalledWith(
        'https://127.0.0.1:32400/library/sections?X-Plex-Token=existing-token'
      );
      expect(result).toEqual([
        {
          id: '1',
          title: 'YouTube',
          locations: [{ id: 1, path: '/data/youtube' }]
        }
      ]);
    });
  });

  describe('getLibrariesWithParams', () => {
    test('returns empty array when API key missing', async () => {
      const result = await plexModule.getLibrariesWithParams('192.168.1.10', '', '32400');

      expect(result).toEqual([]);
      expect(axios.get).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Missing Plex API key');
    });

    test('returns empty array when baseUrl missing', async () => {
      config.plexIP = '';

      const result = await plexModule.getLibrariesWithParams('', 'token', '32400');

      expect(result).toEqual([]);
      expect(axios.get).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Missing Plex server URL');
    });

    test('successfully retrieves libraries', async () => {
      axios.get.mockResolvedValue({
        data: {
          MediaContainer: {
            Directory: [
              {
                key: '1',
                title: 'Movies',
                Location: [
                  { id: 1, path: '/movies' },
                  { id: 2, path: '/more-movies' }
                ]
              },
              {
                key: '2',
                title: 'TV Shows',
                Location: [{ id: 3, path: '/tv' }]
              }
            ]
          }
        }
      });

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', 'token', '8080');

      expect(logger.info).toHaveBeenCalledWith(
        'Attempting to fetch Plex libraries via URL: http://192.168.1.10:8080'
      );
      expect(axios.get).toHaveBeenCalledWith(
        'http://192.168.1.10:8080/library/sections?X-Plex-Token=token'
      );
      expect(result).toEqual([
        {
          id: '1',
          title: 'Movies',
          locations: [
            { id: 1, path: '/movies' },
            { id: 2, path: '/more-movies' }
          ]
        },
        {
          id: '2',
          title: 'TV Shows',
          locations: [{ id: 3, path: '/tv' }]
        }
      ]);
    });

    test('handles connection refused error', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      axios.get.mockRejectedValue(error);

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', 'token', '32400');

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Failed to get Plex libraries');
      expect(logger.warn).toHaveBeenCalledWith('Could not connect to Plex server - returning empty library list');
    });

    test('handles generic error', async () => {
      const error = new Error('Network timeout');
      axios.get.mockRejectedValue(error);

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', 'token', '32400');

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Failed to get Plex libraries');
    });

    test('uses PLEX_URL from environment', async () => {
      process.env.PLEX_URL = 'http://env-plex:9999';
      axios.get.mockResolvedValue({
        data: {
          MediaContainer: {
            Directory: []
          }
        }
      });

      await plexModule.getLibrariesWithParams(null, 'token', null);

      expect(axios.get).toHaveBeenCalledWith(
        'http://env-plex:9999/library/sections?X-Plex-Token=token'
      );
    });

    test('handles null plexApiKey parameter', async () => {
      const result = await plexModule.getLibrariesWithParams('192.168.1.10', null, '32400');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('Missing Plex API key');
    });

    test('handles undefined plexApiKey parameter', async () => {
      const result = await plexModule.getLibrariesWithParams('192.168.1.10', undefined, '32400');

      expect(result).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('Missing Plex API key');
    });

    test('uses https when plexViaHttps is true', async () => {
      axios.get.mockResolvedValue({
        data: {
          MediaContainer: {
            Directory: [
              {
                key: '1',
                title: 'Movies',
                Location: [{ id: 1, path: '/movies' }]
              }
            ]
          }
        }
      });

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', 'token', '8080', true);

      expect(logger.info).toHaveBeenCalledWith(
        'Attempting to fetch Plex libraries via URL: https://192.168.1.10:8080'
      );
      expect(axios.get).toHaveBeenCalledWith(
        'https://192.168.1.10:8080/library/sections?X-Plex-Token=token'
      );
      expect(result).toHaveLength(1);
    });

    test('uses http when plexViaHttps is false', async () => {
      axios.get.mockResolvedValue({
        data: {
          MediaContainer: {
            Directory: [
              {
                key: '1',
                title: 'Movies',
                Location: [{ id: 1, path: '/movies' }]
              }
            ]
          }
        }
      });

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', 'token', '8080', false);

      expect(logger.info).toHaveBeenCalledWith(
        'Attempting to fetch Plex libraries via URL: http://192.168.1.10:8080'
      );
      expect(axios.get).toHaveBeenCalledWith(
        'http://192.168.1.10:8080/library/sections?X-Plex-Token=token'
      );
      expect(result).toHaveLength(1);
    });

    test('uses config plexViaHttps when parameter not provided', async () => {
      config.plexViaHttps = true;
      axios.get.mockResolvedValue({
        data: {
          MediaContainer: {
            Directory: [
              {
                key: '1',
                title: 'Movies',
                Location: [{ id: 1, path: '/movies' }]
              }
            ]
          }
        }
      });

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', 'token', '8080');

      expect(logger.info).toHaveBeenCalledWith(
        'Attempting to fetch Plex libraries via URL: https://192.168.1.10:8080'
      );
      expect(axios.get).toHaveBeenCalledWith(
        'https://192.168.1.10:8080/library/sections?X-Plex-Token=token'
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getAuthUrl', () => {
    test('successfully creates auth URL and PIN', async () => {
      axios.post.mockResolvedValue({
        data: {
          id: 12345,
          code: 'ABC123'
        }
      });

      const result = await plexModule.getAuthUrl();

      expect(axios.post).toHaveBeenCalledWith(
        'https://plex.tv/api/v2/pins',
        { strong: true },
        {
          headers: {
            'X-Plex-Product': 'Youtarr',
            'X-Plex-Client-Identifier': 'test-uuid-1234'
          }
        }
      );
      expect(result).toEqual({
        authUrl: 'https://app.plex.tv/auth#?clientID=test-uuid-1234&code=ABC123&context%5Bdevice%5D%5Bproduct%5D=Youtarr',
        pinId: 12345
      });
    });

    test('handles PIN creation error', async () => {
      const error = new Error('Network error');
      axios.post.mockRejectedValue(error);

      await expect(plexModule.getAuthUrl()).rejects.toThrow('Network error');
      expect(logger.error).toHaveBeenCalledWith({ err: error }, 'Failed to generate Plex auth URL');
    });

    test('uses correct headers', async () => {
      axios.post.mockResolvedValue({
        data: { id: 1, code: 'TEST' }
      });

      await plexModule.getAuthUrl();

      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        {
          headers: {
            'X-Plex-Product': 'Youtarr',
            'X-Plex-Client-Identifier': 'test-uuid-1234'
          }
        }
      );
    });
  });

  describe('checkPin', () => {
    test('sets token when no existing token', async () => {
      config.plexApiKey = '';

      axios.get.mockResolvedValueOnce({
        data: { authToken: 'new-token-123' }
      });

      const result = await plexModule.checkPin('pin-123');

      expect(logger.debug).toHaveBeenCalledWith({ pinId: 'pin-123' }, 'Checking Plex PIN');
      expect(axios.get).toHaveBeenCalledWith(
        'https://plex.tv/api/v2/pins/pin-123',
        {
          headers: {
            'X-Plex-Client-Identifier': 'test-uuid-1234'
          }
        }
      );
      expect(configModule.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          plexApiKey: 'new-token-123'
        })
      );
      expect(result).toEqual({ authToken: 'new-token-123' });
    });

    test('validates token when existing token matches', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: { authToken: 'existing-token' }
        })
        .mockResolvedValueOnce({
          data: { machineIdentifier: 'plex-server-123' }
        });

      const result = await plexModule.checkPin('pin-123');

      expect(axios.get).toHaveBeenNthCalledWith(2,
        'http://127.0.0.1:32400/identity',
        {
          headers: {
            'X-Plex-Token': 'existing-token'
          }
        }
      );
      expect(result).toEqual({ authToken: 'existing-token' });
    });

    test('returns invalid when tokens do not match', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: { authToken: 'different-token' }
        })
        .mockResolvedValueOnce({
          data: { machineIdentifier: 'plex-server-123' }
        });

      const result = await plexModule.checkPin('pin-123');

      expect(result).toEqual({ authToken: 'invalid' });
    });

    test('handles PIN check error with response data', async () => {
      const error = new Error('API error');
      error.response = { data: 'Error details' };
      axios.get.mockRejectedValue(error);

      const result = await plexModule.checkPin('pin-123');

      expect(logger.error).toHaveBeenCalledWith({ err: error, pinId: 'pin-123' }, 'Failed to check Plex PIN');
      expect(logger.error).toHaveBeenCalledWith(
        { responseData: 'Error details' },
        'Plex PIN check error response'
      );
      expect(result).toEqual({ authToken: null });
    });

    test('handles PIN check error without response data', async () => {
      const error = new Error('Network error');
      axios.get.mockRejectedValue(error);

      const result = await plexModule.checkPin('pin-123');

      expect(logger.error).toHaveBeenCalledWith({ err: error, pinId: 'pin-123' }, 'Failed to check Plex PIN');
      // Should NOT call logger.error with responseData since error.response is undefined
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.objectContaining({ responseData: expect.anything() }),
        'Plex PIN check error response'
      );
      expect(result).toEqual({ authToken: null });
    });

    test('returns null when no auth token', async () => {
      axios.get.mockResolvedValueOnce({
        data: { authToken: null }
      });

      const result = await plexModule.checkPin('pin-123');

      expect(logger.debug).toHaveBeenCalledWith('No authToken returned from Plex');
      expect(result).toEqual({ authToken: null });
    });

    test('returns null when auth token is empty string', async () => {
      axios.get.mockResolvedValueOnce({
        data: { authToken: '' }
      });

      const result = await plexModule.checkPin('pin-123');

      expect(logger.debug).toHaveBeenCalledWith('No authToken returned from Plex');
      expect(result).toEqual({ authToken: null });
    });

    test('throws error when validation fails', async () => {
      const error = new Error('Unauthorized');
      axios.get
        .mockResolvedValueOnce({
          data: { authToken: 'existing-token' }
        })
        .mockRejectedValueOnce(error);

      await expect(plexModule.checkPin('pin-123')).rejects.toThrow('Invalid authToken for this server');
      expect(logger.warn).toHaveBeenCalledWith({ err: error }, 'Invalid authToken for this Plex server');
    });

    test('throws error when missing server URL for validation', async () => {
      config.plexIP = '';
      const error = new Error('Missing Plex server URL');
      axios.get.mockResolvedValueOnce({
        data: { authToken: 'existing-token' }
      });

      await expect(plexModule.checkPin('pin-123')).rejects.toThrow('Invalid authToken for this server');
      expect(logger.warn).toHaveBeenCalledWith({ err: error }, 'Invalid authToken for this Plex server');
    });

    test('handles undefined auth token', async () => {
      axios.get.mockResolvedValueOnce({
        data: {}
      });

      const result = await plexModule.checkPin('pin-123');

      expect(logger.debug).toHaveBeenCalledWith('No authToken returned from Plex');
      expect(result).toEqual({ authToken: null });
    });

    test('uses PLEX_URL for identity check when available', async () => {
      process.env.PLEX_URL = 'http://custom-plex:8080';
      axios.get
        .mockResolvedValueOnce({
          data: { authToken: 'existing-token' }
        })
        .mockResolvedValueOnce({
          data: { machineIdentifier: 'plex-server-123' }
        });

      await plexModule.checkPin('pin-123');

      expect(axios.get).toHaveBeenNthCalledWith(2,
        'http://custom-plex:8080/identity',
        {
          headers: {
            'X-Plex-Token': 'existing-token'
          }
        }
      );
    });

  });

  describe('Integration scenarios', () => {
    test('full authentication flow', async () => {
      config.plexApiKey = '';

      axios.post.mockResolvedValue({
        data: { id: 999, code: 'XYZ789' }
      });

      axios.get.mockResolvedValueOnce({
        data: { authToken: 'auth-token-456' }
      });

      const authResult = await plexModule.getAuthUrl();
      expect(authResult.pinId).toBe(999);

      const pinResult = await plexModule.checkPin(authResult.pinId);
      expect(pinResult).toEqual({ authToken: 'auth-token-456' });
      expect(configModule.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          plexApiKey: 'auth-token-456'
        })
      );
    });

    test('library refresh after configuration', async () => {
      axios.get
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({
          data: {
            MediaContainer: {
              Directory: [
                {
                  key: '1',
                  title: 'YouTube',
                  Location: [{ id: 1, path: '/youtube' }]
                }
              ]
            }
          }
        });

      await plexModule.refreshLibrary();
      const libraries = await plexModule.getLibraries();

      expect(libraries).toHaveLength(1);
      expect(libraries[0].title).toBe('YouTube');
    });

    test('handles complete server unavailability', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      axios.get.mockRejectedValue(error);

      const refreshResult = await plexModule.refreshLibrary();
      const libraries = await plexModule.getLibraries();

      expect(refreshResult).toBeNull();
      expect(libraries).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('Could not connect to Plex server - continuing without refresh');
      expect(logger.warn).toHaveBeenCalledWith('Could not connect to Plex server - returning empty library list');
    });
  });
});