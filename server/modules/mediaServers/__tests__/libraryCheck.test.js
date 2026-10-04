const ROOT = '/data';

const folder = (name, layout, extra = {}) => ({ name, layout, isDefault: false, hasFiles: true, channels: 1, ...extra });
const server = (serverType, libraries, samples = []) => ({ serverType, libraries, samples });
const plexTv = (overrides = {}) => ({
  id: '41', name: 'YouTube TV', type: 'tv', agent: 'tv.plex.agents.nfo.series', scanner: 'Plex TV Series',
  locations: ['Q:\\Y\\__TV'], ...overrides,
});

describe('libraryCheck', () => {
  let libraryCheck;
  let configModule;
  let libraryFolders;
  let serverRegistry;
  let config;

  beforeEach(() => {
    jest.resetModules();
    config = { plexSubfolderLibraryMappings: [], plexYoutubeLibraryId: '37' };
    jest.doMock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
    jest.doMock('../../configModule', () => ({
      getConfig: jest.fn(() => config),
      updateConfig: jest.fn((next) => { config = next; }),
      directoryPath: ROOT,
    }));
    jest.doMock('../../tvShows/libraryFolders', () => ({ listLibraryFolders: jest.fn() }));
    jest.doMock('../serverRegistry', () => ({ getEnabledAdapters: jest.fn() }));
    jest.doMock('../libraryLocator', () => {
      const { matchLibraries } = jest.requireActual('../libraryMatcher');
      return {
        locate: jest.fn(async (adapter, folders) => {
          if (adapter.unreachable) throw Object.assign(new Error('connect ECONNREFUSED'), { isAxiosError: true });
          return {
            libraries: adapter.libraries,
            match: matchLibraries({ folders, libraries: adapter.libraries, samples: adapter.samples, containerRoot: ROOT }),
          };
        }),
      };
    });
    libraryCheck = require('../libraryCheck');
    configModule = require('../../configModule');
    libraryFolders = require('../../tvShows/libraryFolders');
    serverRegistry = require('../serverRegistry');
  });

  const run = async (folders, servers, options) => {
    libraryFolders.listLibraryFolders.mockResolvedValue(folders);
    serverRegistry.getEnabledAdapters.mockReturnValue(servers);
    return libraryCheck.check(options);
  };
  const reportOf = (result, folderName, serverType) => result.folders
    .find((entry) => entry.name === folderName).servers.find((entry) => entry.serverType === serverType);
  const codes = (report) => report.issues.map((issue) => issue.code);

  describe('TV folders', () => {
    test('is fine with a Plex TV library mapped for refreshes', async () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'TV', libraryId: '41' }];
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [server('plex', [plexTv()])]);

      const report = reportOf(result, 'TV', 'plex');
      expect(report.status).toBe('ok');
      expect(report.plexMapping).toEqual({ mappedLibraryId: '41', suggestedLibraryId: '41' });
    });

    test('suggests the Plex refresh mapping when the folder has none', async () => {
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [server('plex', [plexTv()])]);

      const report = reportOf(result, 'TV', 'plex');
      expect(report.plexMapping).toEqual({ mappedLibraryId: null, suggestedLibraryId: '41' });
      expect(codes(report)).toEqual(['plexMappingMissing']);
    });

    test('reports a refresh mapping to another library', async () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'TV', libraryId: '37' }];
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [server('plex', [plexTv()])]);

      expect(codes(reportOf(result, 'TV', 'plex'))).toEqual(['plexMappingMismatch']);
    });

    test('reports a missing TV library and the Plex root library that shows the episodes a second time', async () => {
      const result = await run([folder('', 'videos'), folder('Kids', 'videos'), folder('TV', 'tv')], [
        server('plex', [{ id: 'root', name: 'YouTube', type: 'videos', locations: ['Q:\\Y'] }, { id: 'k', name: 'Kids', type: 'videos', locations: ['Q:\\Y\\__Kids'] }]),
      ]);

      const report = reportOf(result, 'TV', 'plex');
      expect(report.status).toBe('missing');
      expect(codes(report)).toEqual(['noLibrary', 'overlap']);
    });

    test('treats a Jellyfin TV library inside another library as missing, since Jellyfin skips it', async () => {
      const result = await run([folder('', 'videos'), folder('Kids', 'videos'), folder('TV', 'tv')], [
        server('jellyfin', [
          { id: 'root', name: 'YouTube', type: 'mixed', locations: ['Q:\\Y'] },
          { id: 'tv', name: 'Shows', type: 'tv', locations: ['Q:\\Y\\__TV'] },
        ]),
      ]);

      const report = reportOf(result, 'TV', 'jellyfin');
      expect(report.status).toBe('missing');
      expect(codes(report)).toEqual(['nestedLibrary']);
      expect(report.issues[0].message).toContain('the TV library for it stays empty');
    });

    test('names the TV libraries that seem to hold the folder from different places', async () => {
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [
        server('plex', [
          plexTv(),
          plexTv({ id: '42', name: 'Old TV', locations: ['D:\\Old\\__TV'] }),
          { id: '2', name: 'YouTube', type: 'videos', locations: ['Q:\\Y\\__TV'] },
        ]),
      ]);

      const issue = reportOf(result, 'TV', 'plex').issues.find((entry) => entry.code === 'ambiguous');
      expect(issue.message).toContain('(YouTube TV, Old TV)');
    });

    test('reports two TV libraries pointed at the same folder', async () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'TV', libraryId: '41' }];
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [
        server('plex', [plexTv(), plexTv({ id: '42', name: 'YouTube TV (Personal Media)', agent: 'tv.plex.agents.none' })]),
      ]);

      const report = reportOf(result, 'TV', 'plex');
      expect(codes(report)).toContain('duplicateLibrary');
      expect(report.plexMapping.suggestedLibraryId).toBeNull();
    });

    test('reports a TV folder in a Movies library', async () => {
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [
        server('plex', [plexTv({ type: 'videos', agent: 'tv.plex.agents.none', scanner: 'Plex Movie' })]),
      ]);

      expect(codes(reportOf(result, 'TV', 'plex'))).toContain('wrongType');
    });

    test.each([
      [{ agent: 'tv.plex.agents.series' }, 'plexSeriesAgent'],
      [{ agent: 'com.plexapp.agents.none' }, 'plexLegacyAgent'],
      [{ scanner: 'Plex Series Scanner' }, 'plexLegacyAgent'],
    ])('reports Plex agent %o as %s', async (overrides, code) => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'TV', libraryId: '41' }];
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [server('plex', [plexTv(overrides)])]);

      expect(codes(reportOf(result, 'TV', 'plex'))).toEqual([code]);
    });

    test('reports a Jellyfin library that saves NFO files and looks episodes up online', async () => {
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [
        server('jellyfin', [{ id: 'tv', name: 'Shows', type: 'tv', locations: ['/media/__TV'], nfoSaver: true, onlineFetchers: true }]),
      ]);

      expect(codes(reportOf(result, 'TV', 'jellyfin'))).toEqual(['nfoSaver', 'onlineFetchers']);
    });

    test('warns about a library mounted at the folder under another name', async () => {
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [
        server('emby', [{ id: 'tv', name: 'Shows', type: 'tv', locations: ['/tvshows'] }], [{
          serverPath: '/tvshows/Chan/Season 2024/S2024E01011200 - T [abcDEF12345].mp4',
          containerPath: `${ROOT}/__TV/Chan/Season 2024/S2024E01011200 - T [abcDEF12345].mp4`,
        }]),
      ]);

      expect(codes(reportOf(result, 'TV', 'emby'))).toEqual(['folderNameMissing']);
    });

    test('accepts a Plex TV library at a TV main folder that also spans the subfolders', async () => {
      const result = await run([folder('', 'tv'), folder('Kids', 'videos')], [
        server('plex', [plexTv({ locations: ['Q:\\Y'] }), { id: 'k', name: 'Kids', type: 'videos', locations: ['Q:\\Y\\__Kids'] }]),
      ]);

      expect(reportOf(result, 'Kids', 'plex').status).toBe('ok');
    });
  });

  describe('Videos folders', () => {
    test('is fine inside a root library', async () => {
      const result = await run([folder('', 'videos'), folder('Kids', 'videos'), folder('TV', 'tv')], [
        server('emby', [{ id: 'root', name: 'YouTube', type: 'videos', locations: ['Q:\\Y'] }, { id: 'tv', name: 'TV', type: 'tv', locations: ['Q:\\Y\\__TV'] }]),
      ]);

      const report = reportOf(result, 'Kids', 'emby');
      expect(report.status).toBe('ok');
      expect(report.libraries).toEqual([expect.objectContaining({ id: 'root', relation: 'covers' })]);
    });

    test('reports a Videos folder in a TV library', async () => {
      const result = await run([folder('', 'videos'), folder('Kids', 'videos')], [
        server('jellyfin', [{ id: 'k', name: 'Kids', type: 'tv', locations: ['Q:\\Y\\__Kids'] }]),
      ]);

      expect(codes(reportOf(result, 'Kids', 'jellyfin'))).toEqual(['wrongType']);
    });

    test('reports a Jellyfin TV library at a TV main folder that also spans a Videos subfolder', async () => {
      const result = await run([folder('', 'tv'), folder('Kids', 'videos')], [
        server('jellyfin', [{ id: 'root', name: 'Shows', type: 'tv', locations: ['Q:\\Y'] }, { id: 'k', name: 'Kids', type: 'videos', locations: ['Q:\\Y\\__Kids'] }]),
      ]);

      expect(codes(reportOf(result, 'Kids', 'jellyfin'))).toEqual(['overlapTv']);
    });

    test('says when no library holds the folder', async () => {
      const result = await run([folder('', 'videos'), folder('Kids', 'videos'), folder('TV', 'tv')], [
        server('plex', [plexTv({ locations: ['Q:\\Y\\__TV'] })]),
      ]);

      expect(reportOf(result, 'Kids', 'plex').status).toBe('missing');
    });

    test('counts a music library as holding the folder (MP3 channels)', async () => {
      const result = await run([folder('', 'videos'), folder('Music', 'videos'), folder('TV', 'tv')], [
        server('plex', [plexTv(), { id: '40', name: 'YouTube Music', type: 'music', locations: ['Q:\\Y\\__Music'], nfoSaver: true }]),
      ]);

      const report = reportOf(result, 'Music', 'plex');
      expect(report.status).toBe('ok');
      expect(report.libraries).toEqual([expect.objectContaining({ id: '40', relation: 'exact' })]);
    });

    test('does not count a music library at a parent folder: it says nothing about the videos', async () => {
      const result = await run([folder('', 'videos'), folder('Kids', 'videos'), folder('TV', 'tv')], [
        server('plex', [plexTv(), { id: '40', name: 'YouTube Music', type: 'music', locations: ['Q:\\Y'] }]),
      ]);

      expect(reportOf(result, 'Kids', 'plex').status).toBe('missing');
    });

    test('does not count a music library as holding a TV folder', async () => {
      const result = await run([folder('', 'videos'), folder('TV', 'tv')], [
        server('plex', [{ id: '40', name: 'YouTube Music', type: 'music', locations: ['Q:\\Y\\__TV'] }]),
      ]);

      expect(reportOf(result, 'TV', 'plex').status).toBe('missing');
    });
  });

  test('reports a server it could not read', async () => {
    const result = await run([folder('', 'videos')], [{ serverType: 'emby', unreachable: true }]);

    expect(result.servers).toEqual([expect.objectContaining({ serverType: 'emby', reachable: false })]);
    expect(reportOf(result, '', 'emby').status).toBe('unreachable');
  });

  test('reports only the folders asked for', async () => {
    const result = await run([folder('', 'videos'), folder('TV', 'tv')], [server('plex', [plexTv()])], { folders: ['tv'] });

    expect(result.folders.map((entry) => entry.name)).toEqual(['TV']);
  });

  describe('checked as another layout (a reorganize preview)', () => {
    test('reports a Videos folder about to become a TV folder as a TV folder', async () => {
      const result = await run([folder('', 'videos'), folder('TV', 'videos')], [server('plex', [plexTv()])],
        { folders: ['TV'], layout: 'tv' });

      const entry = result.folders[0];
      expect(entry.layout).toBe('tv');
      expect(reportOf(result, 'TV', 'plex').plexMapping).toEqual({ mappedLibraryId: null, suggestedLibraryId: '41' });
      expect(codes(reportOf(result, 'TV', 'plex'))).toEqual(['plexMappingMissing']);
    });

    test('applies the layout only to the folders asked for', async () => {
      const result = await run([folder('', 'videos'), folder('TV', 'videos')], [server('plex', [plexTv()])], { layout: 'tv' });

      expect(result.folders.map((entry) => [entry.name, entry.layout])).toEqual([['', 'videos'], ['TV', 'videos']]);
    });
  });

  describe('applyPlexMapping', () => {
    beforeEach(() => {
      libraryFolders.listLibraryFolders.mockResolvedValue([folder('', 'videos'), folder('TV', 'tv')]);
      serverRegistry.getEnabledAdapters.mockReturnValue([server('plex', [plexTv()])]);
    });

    test('maps the folder to the one Plex TV library that holds it', async () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'Kids', libraryId: '12' }];

      expect(await libraryCheck.applyPlexMapping('TV', '41')).toEqual({
        mappedLibraryId: '41',
        plexSubfolderLibraryMappings: [{ subfolder: 'Kids', libraryId: '12' }, { subfolder: 'TV', libraryId: '41' }],
      });
      expect(configModule.updateConfig).toHaveBeenCalledWith(expect.objectContaining({
        plexSubfolderLibraryMappings: [{ subfolder: 'Kids', libraryId: '12' }, { subfolder: 'TV', libraryId: '41' }],
      }));
    });

    test('answers with the saved mappings when the folder already maps to that library', async () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'TV', libraryId: '41' }];

      expect(await libraryCheck.applyPlexMapping('TV', '41')).toEqual({
        mappedLibraryId: '41',
        plexSubfolderLibraryMappings: [{ subfolder: 'TV', libraryId: '41' }],
      });
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });

    test('never replaces an existing mapping', async () => {
      config.plexSubfolderLibraryMappings = [{ subfolder: 'TV', libraryId: '37' }];

      await expect(libraryCheck.applyPlexMapping('TV', '41')).rejects.toMatchObject({ status: 409 });
      expect(configModule.updateConfig).not.toHaveBeenCalled();
    });

    test('refuses a library that does not hold the folder', async () => {
      await expect(libraryCheck.applyPlexMapping('TV', '99')).rejects.toMatchObject({ status: 409 });
    });
  });
});
