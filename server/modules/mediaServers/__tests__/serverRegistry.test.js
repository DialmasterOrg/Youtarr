jest.mock('../adapters/plexAdapter', () => jest.fn().mockImplementation((c) => ({ __type: 'plex', c })));
jest.mock('../adapters/jellyfinAdapter', () => jest.fn().mockImplementation((c) => ({ __type: 'jellyfin', c })));
jest.mock('../adapters/embyAdapter', () => jest.fn().mockImplementation((c) => ({ __type: 'emby', c })));

describe('serverRegistry', () => {
  let serverRegistry;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.doMock('../adapters/plexAdapter', () => jest.fn().mockImplementation((c) => ({ __type: 'plex', c })));
    jest.doMock('../adapters/jellyfinAdapter', () => jest.fn().mockImplementation((c) => ({ __type: 'jellyfin', c })));
    jest.doMock('../adapters/embyAdapter', () => jest.fn().mockImplementation((c) => ({ __type: 'emby', c })));
    serverRegistry = require('../serverRegistry');
  });

  test('returns only enabled adapters', () => {
    const cfg = {
      plexUrl: 'http://p', plexApiKey: 'tok',
      jellyfinEnabled: true, jellyfinUrl: 'http://j', jellyfinApiKey: 'k', jellyfinUserId: 'u',
      embyEnabled: false,
    };
    const adapters = serverRegistry.getEnabledAdapters(cfg);
    expect(adapters.map((a) => a.__type)).toEqual(['plex', 'jellyfin']);
  });

  test('Plex only enabled when both url and apiKey present', () => {
    const cfg = { plexUrl: '', plexApiKey: 'tok' };
    const adapters = serverRegistry.getEnabledAdapters(cfg);
    expect(adapters).toEqual([]);
  });

  test('Jellyfin requires enabled flag plus url/apiKey/userId', () => {
    const cfg = { jellyfinEnabled: true, jellyfinUrl: 'http://j', jellyfinApiKey: 'k' };
    // missing userId
    const adapters = serverRegistry.getEnabledAdapters(cfg);
    expect(adapters).toEqual([]);
  });
});
