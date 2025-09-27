/* eslint-env jest */

jest.mock('axios');

describe('plexModule URL handling', () => {
  let axiosGetMock;
  let config;

  beforeEach(() => {
    jest.resetModules();
    axiosGetMock = require('axios').get;
    axiosGetMock.mockReset();

    config = {
      plexIP: '127.0.0.1',
      plexApiKey: 'existing-token',
      plexYoutubeLibraryId: '1',
      plexPort: '32400',
      plexUrl: null
    };

    jest.doMock('../configModule', () => ({
      getConfig: jest.fn(() => config),
      updateConfig: jest.fn()
    }));
  });

  afterEach(() => {
    delete process.env.PLEX_URL;
    jest.resetModules();
  });

  test('uses managed PLEX_URL when provided', async () => {
    process.env.PLEX_URL = 'http://plex:32400';

    axiosGetMock.mockResolvedValue({
      data: {
        MediaContainer: {
          Directory: [
            {
              key: '2',
              title: 'Movies',
              Location: [{ id: 7, path: '/movies' }]
            }
          ]
        }
      }
    });

    const plexModule = require('../plexModule');

    const libraries = await plexModule.getLibrariesWithParams('', 'managed-token');

    expect(axiosGetMock).toHaveBeenCalledWith(
      'http://plex:32400/library/sections?X-Plex-Token=managed-token'
    );
    expect(libraries).toEqual([
      {
        id: '2',
        title: 'Movies',
        locations: [{ id: 7, path: '/movies' }]
      }
    ]);
  });

  test('falls back to plexIP when no managed URL is set', async () => {
    axiosGetMock.mockResolvedValue({
      data: {
        MediaContainer: {
          Directory: []
        }
      }
    });

    const plexModule = require('../plexModule');

    await plexModule.getLibrariesWithParams('192.168.1.10', 'manual-token');

    expect(axiosGetMock).toHaveBeenCalledWith(
      'http://192.168.1.10:32400/library/sections?X-Plex-Token=manual-token'
    );
  });

  test('uses provided test port when supplied', async () => {
    axiosGetMock.mockResolvedValue({
      data: {
        MediaContainer: {
          Directory: []
        }
      }
    });

    const plexModule = require('../plexModule');

    await plexModule.getLibrariesWithParams('192.168.1.10', 'manual-token', '23456');

    expect(axiosGetMock).toHaveBeenCalledWith(
      'http://192.168.1.10:23456/library/sections?X-Plex-Token=manual-token'
    );
  });

  test('falls back to default port when provided value is non-numeric', async () => {
    axiosGetMock.mockResolvedValue({
      data: {
        MediaContainer: {
          Directory: []
        }
      }
    });

    const plexModule = require('../plexModule');

    await plexModule.getLibrariesWithParams('192.168.1.10', 'manual-token', 'abc');

    expect(axiosGetMock).toHaveBeenCalledWith(
      'http://192.168.1.10:32400/library/sections?X-Plex-Token=manual-token'
    );
  });

  test('returns empty list when no server info available', async () => {
    config.plexIP = '';

    const plexModule = require('../plexModule');

    const libraries = await plexModule.getLibrariesWithParams('', 'token');

    expect(libraries).toEqual([]);
    expect(axiosGetMock).not.toHaveBeenCalled();
  });
});
