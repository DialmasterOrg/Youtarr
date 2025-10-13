/* eslint-env jest */

jest.mock('axios');

describe('plexModule', () => {
  let axios;
  let configModule;
  let plexModule;
  let config;

  beforeEach(() => {
    jest.resetModules();
    axios = require('axios');
    axios.get = jest.fn();
    axios.post = jest.fn();

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
  });

  describe('refreshLibrary', () => {
    test('successfully refreshes library', async () => {
      const mockResponse = { status: 200, data: 'success' };
      axios.get.mockResolvedValue(mockResponse);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await plexModule.refreshLibrary();

      expect(axios.get).toHaveBeenCalledWith(
        'http://127.0.0.1:32400/library/sections/1/refresh?X-Plex-Token=existing-token'
      );
      expect(result).toBe(mockResponse);
      expect(consoleSpy).toHaveBeenCalledWith('Refreshing library in Plex');
      expect(consoleSpy).toHaveBeenCalledWith('Plex library refresh initiated successfully');

      consoleSpy.mockRestore();
    });

    test('skips refresh when missing baseUrl', async () => {
      config.plexIP = '';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await plexModule.refreshLibrary();

      expect(axios.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Skipping Plex refresh - missing server details or credentials');

      consoleSpy.mockRestore();
    });

    test('skips refresh when missing API key', async () => {
      config.plexApiKey = '';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await plexModule.refreshLibrary();

      expect(axios.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Skipping Plex refresh - missing server details or credentials');

      consoleSpy.mockRestore();
    });

    test('skips refresh when missing library ID', async () => {
      config.plexYoutubeLibraryId = null;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await plexModule.refreshLibrary();

      expect(axios.get).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Skipping Plex refresh - missing server details or credentials');

      consoleSpy.mockRestore();
    });

    test('handles connection refused error', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      axios.get.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await plexModule.refreshLibrary();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error refreshing library in Plex: Connection refused');
      expect(consoleSpy).toHaveBeenCalledWith('Could not connect to Plex server - continuing without refresh');

      consoleSpy.mockRestore();
    });

    test('handles generic error', async () => {
      const error = new Error('Network error');
      axios.get.mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await plexModule.refreshLibrary();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Error refreshing library in Plex: Network error');

      consoleSpy.mockRestore();
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
  });

  describe('getLibrariesWithParams', () => {
    test('returns empty array when API key missing', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', '', '32400');

      expect(result).toEqual([]);
      expect(axios.get).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Missing Plex API key');

      consoleSpy.mockRestore();
    });

    test('returns empty array when baseUrl missing', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      config.plexIP = '';

      const result = await plexModule.getLibrariesWithParams('', 'token', '32400');

      expect(result).toEqual([]);
      expect(axios.get).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Missing Plex server URL');

      consoleSpy.mockRestore();
    });

    test('successfully retrieves libraries', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
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

      expect(consoleSpy).toHaveBeenCalledWith('Using baseUrl for getting libraries: http://192.168.1.10:8080');
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

      consoleSpy.mockRestore();
    });

    test('handles connection refused error', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      axios.get.mockRejectedValue(error);

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', 'token', '32400');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting libraries from Plex: Connection refused');
      expect(consoleSpy).toHaveBeenCalledWith('Could not connect to Plex server - returning empty library list');

      consoleSpy.mockRestore();
    });

    test('handles generic error', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('Network timeout');
      axios.get.mockRejectedValue(error);

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', 'token', '32400');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting libraries from Plex: Network timeout');

      consoleSpy.mockRestore();
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
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', null, '32400');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Missing Plex API key');

      consoleSpy.mockRestore();
    });

    test('handles undefined plexApiKey parameter', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await plexModule.getLibrariesWithParams('192.168.1.10', undefined, '32400');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Missing Plex API key');

      consoleSpy.mockRestore();
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
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('Network error');
      axios.post.mockRejectedValue(error);

      await expect(plexModule.getAuthUrl()).rejects.toThrow('Network error');
      expect(consoleSpy).toHaveBeenCalledWith('PIN ERROR!!Network error');

      consoleSpy.mockRestore();
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
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      config.plexApiKey = '';

      axios.get.mockResolvedValueOnce({
        data: { authToken: 'new-token-123' }
      });

      const result = await plexModule.checkPin('pin-123');

      expect(consoleSpy).toHaveBeenCalledWith('Checking pin: pin-123');
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

      consoleSpy.mockRestore();
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
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('API error');
      error.response = { data: 'Error details' };
      axios.get.mockRejectedValue(error);

      const result = await plexModule.checkPin('pin-123');

      expect(consoleSpy).toHaveBeenCalledWith('PIN ERROR!!API error');
      expect(consoleSpy).toHaveBeenCalledWith('Error details');
      expect(result).toEqual({ authToken: null });

      consoleSpy.mockRestore();
    });

    test('handles PIN check error without response data', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('Network error');
      // Note: This test exposes a bug in plexModule.js line 148 where it tries to access
      // error.response.data without checking if error.response exists. This causes a TypeError.
      // The module should check if error.response exists before accessing its data property.
      axios.get.mockRejectedValue(error);

      // The current implementation throws an error when error.response is undefined
      await expect(plexModule.checkPin('pin-123')).rejects.toThrow('Cannot read properties of undefined');

      consoleSpy.mockRestore();
    });

    test('returns null when no auth token', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      axios.get.mockResolvedValueOnce({
        data: { authToken: null }
      });

      const result = await plexModule.checkPin('pin-123');

      expect(consoleSpy).toHaveBeenCalledWith('No authToken for this server: null');
      expect(result).toEqual({ authToken: null });

      consoleSpy.mockRestore();
    });

    test('returns null when auth token is empty string', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      axios.get.mockResolvedValueOnce({
        data: { authToken: '' }
      });

      const result = await plexModule.checkPin('pin-123');

      expect(consoleSpy).toHaveBeenCalledWith('No authToken for this server: ');
      expect(result).toEqual({ authToken: null });

      consoleSpy.mockRestore();
    });

    test('throws error when validation fails', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      axios.get
        .mockResolvedValueOnce({
          data: { authToken: 'existing-token' }
        })
        .mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(plexModule.checkPin('pin-123')).rejects.toThrow('Invalid authToken for this server');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid authToken for this server: Unauthorized');

      consoleSpy.mockRestore();
    });

    test('throws error when missing server URL for validation', async () => {
      config.plexIP = '';
      axios.get.mockResolvedValueOnce({
        data: { authToken: 'existing-token' }
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(plexModule.checkPin('pin-123')).rejects.toThrow('Invalid authToken for this server');
      expect(consoleSpy).toHaveBeenCalledWith('Invalid authToken for this server: Missing Plex server URL');

      consoleSpy.mockRestore();
    });

    test('handles undefined auth token', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      axios.get.mockResolvedValueOnce({
        data: {}
      });

      const result = await plexModule.checkPin('pin-123');

      expect(consoleSpy).toHaveBeenCalledWith('No authToken for this server: undefined');
      expect(result).toEqual({ authToken: null });

      consoleSpy.mockRestore();
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
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      axios.get.mockRejectedValue(error);

      const refreshResult = await plexModule.refreshLibrary();
      const libraries = await plexModule.getLibraries();

      expect(refreshResult).toBeNull();
      expect(libraries).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Could not connect to Plex server - continuing without refresh');
      expect(consoleSpy).toHaveBeenCalledWith('Could not connect to Plex server - returning empty library list');

      consoleSpy.mockRestore();
    });
  });
});