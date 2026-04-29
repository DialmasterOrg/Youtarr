describe('serverRegistry', () => {
  let serverRegistry;
  let plexModuleMock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.doMock('../adapters/plexAdapter', () => jest.fn().mockImplementation((c) => ({ __type: 'plex', c })));
    jest.doMock('../adapters/jellyfinAdapter', () => jest.fn().mockImplementation((c) => ({ __type: 'jellyfin', c })));
    jest.doMock('../adapters/embyAdapter', () => jest.fn().mockImplementation((c) => ({ __type: 'emby', c })));
    plexModuleMock = { getBaseUrl: jest.fn() };
    jest.doMock('../../plexModule', () => plexModuleMock);
    serverRegistry = require('../serverRegistry');
  });

  test('returns only enabled adapters', () => {
    plexModuleMock.getBaseUrl.mockReturnValue('http://p');
    const cfg = {
      plexUrl: 'http://p', plexApiKey: 'tok',
      jellyfinEnabled: true, jellyfinUrl: 'http://j', jellyfinApiKey: 'k', jellyfinUserId: 'u',
      embyEnabled: false,
    };
    const adapters = serverRegistry.getEnabledAdapters(cfg);
    expect(adapters.map((a) => a.__type)).toEqual(['plex', 'jellyfin']);
  });

  test('Plex enabled when URL resolvable from plexIP/plexPort even if plexUrl is empty', () => {
    plexModuleMock.getBaseUrl.mockReturnValue('http://192.168.1.174:32400');
    const cfg = {
      plexUrl: '',
      plexIP: '192.168.1.174',
      plexPort: '32400',
      plexViaHttps: false,
      plexApiKey: 'tok',
    };
    const adapters = serverRegistry.getEnabledAdapters(cfg);
    expect(adapters.map((a) => a.__type)).toEqual(['plex']);
    // Adapter should receive the resolved URL, not the empty one from raw config
    expect(adapters[0].c.plexUrl).toBe('http://192.168.1.174:32400');
  });

  test('Plex disabled when no URL resolvable', () => {
    plexModuleMock.getBaseUrl.mockReturnValue(null);
    const cfg = { plexApiKey: 'tok' };
    const adapters = serverRegistry.getEnabledAdapters(cfg);
    expect(adapters).toEqual([]);
  });

  test('Plex disabled when API key missing even if URL resolves', () => {
    plexModuleMock.getBaseUrl.mockReturnValue('http://p');
    const cfg = { plexApiKey: '' };
    const adapters = serverRegistry.getEnabledAdapters(cfg);
    expect(adapters).toEqual([]);
  });

  test('Jellyfin requires enabled flag plus url/apiKey/userId', () => {
    plexModuleMock.getBaseUrl.mockReturnValue(null);
    const cfg = { jellyfinEnabled: true, jellyfinUrl: 'http://j', jellyfinApiKey: 'k' };
    // missing userId
    const adapters = serverRegistry.getEnabledAdapters(cfg);
    expect(adapters).toEqual([]);
  });
});
