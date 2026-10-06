describe('libraryLocator', () => {
  let libraryLocator;
  let Video;
  let subfolderModule;

  const adapter = (libraries, samples = {}) => ({
    serverType: 'plex',
    listLibraries: jest.fn().mockResolvedValue(libraries),
    sampleItemPaths: jest.fn(async (library) => samples[library.id] || []),
  });

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
    jest.doMock('../../configModule', () => ({ directoryPath: '/usr/src/app/data' }));
    jest.doMock('../../subfolderModule', () => ({ getAll: jest.fn().mockResolvedValue(['__TV Shows', '__Kids']) }));
    jest.doMock('../../../models', () => ({ Video: { findAll: jest.fn().mockResolvedValue([]) } }));
    libraryLocator = require('../libraryLocator');
    ({ Video } = require('../../../models'));
    subfolderModule = require('../../subfolderModule');
  });

  test('lists the main folder and every registered subfolder', async () => {
    expect(await libraryLocator.folderNames()).toEqual(['', 'TV Shows', 'Kids']);
    expect(subfolderModule.getAll).toHaveBeenCalled();
  });

  test('finds the main folder from a sampled file of one of Youtarr\'s downloads', async () => {
    const server = adapter([{ id: '1', type: 'videos', locations: ['/media/youtube'] }], {
      1: ['/media/youtube/Chan/Chan - T - abcDEF12345/Chan - T [abcDEF12345].mp4'],
    });
    Video.findAll.mockResolvedValue([{
      youtubeId: 'abcDEF12345',
      filePath: '/usr/src/app/data/Chan/Chan - T - abcDEF12345/Chan - T [abcDEF12345].mp4',
      audioFilePath: null,
    }]);

    const { match } = await libraryLocator.locate(server);

    expect(match.mainKnown).toBe(true);
    expect(match.scope).toEqual(new Set(['1']));
  });

  test('does not sample libraries of other kinds', async () => {
    const server = adapter([{ id: '9', type: 'other', locations: ['/photos'] }]);

    await libraryLocator.locate(server, ['']);

    expect(server.sampleItemPaths).not.toHaveBeenCalled();
  });

  test('has no scope when the server cannot be read', async () => {
    const server = adapter([]);
    server.listLibraries.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await libraryLocator.scopeFor(server)).toBeNull();
  });

  test('scopes to the libraries named after a subfolder and the main folder above them', async () => {
    const server = adapter([
      { id: '41', type: 'tv', locations: ['Q:\\Y\\__TV Shows'] },
      { id: '7', type: 'tv', locations: ['D:\\TV'] },
    ], { 7: ['D:\\TV\\Some Show\\Season 01\\Some Show - S01E01 - Pilot.mkv'] });

    expect(await libraryLocator.scopeFor(server)).toEqual(new Set(['41']));
  });

  describe('a library whose sample says nothing about its content', () => {
    const named = { id: '41', type: 'tv', locations: ['Q:\\Y\\__TV Shows'] };

    // Adapters resolve [] for an empty library and for one they could not read.
    test('stays in scope while its sample shows no files', async () => {
      const server = adapter([named, { id: '7', type: 'tv', locations: ['/kids'] }], { 7: [] });

      expect(await libraryLocator.scopeFor(server)).toEqual(new Set(['41', '7']));
    });

    test('stays in scope when it holds YouTube downloads Youtarr does not know', async () => {
      const server = adapter([named, { id: '7', type: 'tv', locations: ['/kids'] }], {
        7: ['/kids/Chan/Season 2024/S2024E01011200 - Title [abcDEF12345].mp4'],
      });

      expect(await libraryLocator.scopeFor(server)).toEqual(new Set(['41', '7']));
    });

    test('leaves out a library whose files are not YouTube downloads', async () => {
      const server = adapter([named, { id: '7', type: 'tv', locations: ['/kids'] }], {
        7: ['/kids/Some Show/Season 01/Some Show - S01E01 - Pilot.mkv'],
      });

      expect(await libraryLocator.scopeFor(server)).toEqual(new Set(['41']));
    });

    test('leaves out libraries of other kinds', async () => {
      const server = adapter([named, { id: '9', type: 'other', locations: ['/photos'] }]);

      expect(await libraryLocator.scopeFor(server)).toEqual(new Set(['41']));
    });

    test('has no scope at all while the main folder is unknown', async () => {
      const server = adapter([{ id: '7', type: 'tv', locations: ['/kids'] }], { 7: [] });

      expect(await libraryLocator.scopeFor(server)).toBeNull();
    });
  });
});
