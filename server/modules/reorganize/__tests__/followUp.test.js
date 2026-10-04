jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ directoryPath: '/data', getConfig: jest.fn(() => ({})) }));
jest.mock('../../plexModule', () => ({ refreshLibrariesForSubfolders: jest.fn() }));
jest.mock('../../m3uGenerator', () => ({ generateChannelM3U: jest.fn(), generatePlaylistM3U: jest.fn() }));
jest.mock('../../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/tvshow', () => ({ findByPk: jest.fn() }));
jest.mock('../../../models/playlist', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/playlistvideo', () => ({ findAll: jest.fn() }));
jest.mock('../../sidecarWriter', () => ({ writeShowMetadata: jest.fn(), writeFolderArt: jest.fn() }));
jest.mock('../../mediaServers/mediaServerSync', () => ({ syncPlaylist: jest.fn() }));
jest.mock('../../mediaServers/serverRegistry', () => ({ getEnabledAdapters: jest.fn(() => []) }));
jest.mock('../../mediaServers/watchStatusPushBack', () => ({ scheduleFollowUps: jest.fn() }));
jest.mock('../../filesystem/directoryManager', () => ({ cleanupEmptyChannelDirectory: jest.fn() }));
jest.mock('../../filesystem/showFolderCleanup', () => {
  const actual = jest.requireActual('../../filesystem/showFolderCleanup');
  return { ...actual, cleanupOrphanShowFolder: jest.fn() };
});
jest.mock('../../tvShows/channelFolders', () => ({ showDirectory: (show) => `/data/__TV/${show.folder_name}` }));

const toTv = {
  youtubeId: 'abcdefghijk',
  channelId: 'UC1',
  plan: {
    oldVideoPath: '/data/__Kids/Chan/Chan - T - abcdefghijk/Chan - T [abcdefghijk].mp4',
    newVideoPath: '/data/__TV/Chan/Season 2024/S2024E01 - T [abcdefghijk].mp4',
    layout: 'tv', fromLayout: 'videos', libraryFolder: 'TV', fromLibraryFolder: 'Kids',
  },
  classification: { ownerChannelId: 'UC1' },
};
const toVideos = {
  youtubeId: 'bbbbbbbbbbb',
  channelId: 'UC2',
  plan: {
    oldVideoPath: '/data/__TV/Other/Season 2024/S2024E02 - U [bbbbbbbbbbb].mp4',
    newVideoPath: '/data/Other/Other - U [bbbbbbbbbbb].mp4',
    layout: 'videos', fromLayout: 'tv', libraryFolder: '', fromLibraryFolder: 'TV',
  },
  classification: null,
};

describe('reorganize followUp', () => {
  let followUp;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    require('../../../models/tvshow').findByPk.mockResolvedValue({ id: 5, folder_name: 'Chan' });
    require('../../../models/channel').findAll.mockResolvedValue([{ channel_id: 'UC2' }]);
    require('../../../models/playlistvideo').findAll.mockResolvedValue([{ playlist_id: 'PL1' }]);
    require('../../../models/playlist').findAll.mockResolvedValue([{ id: 4 }]);
    followUp = require('../followUp');
  });

  it('finds the channel or show folder a path sits in', () => {
    expect(followUp.rootFolderOf('/data/__TV/Chan/Season 2024/a.mp4')).toBe('/data/__TV/Chan');
    expect(followUp.rootFolderOf('/data/Chan/a.mp4')).toBe('/data/Chan');
    expect(followUp.rootFolderOf('/elsewhere/a.mp4')).toBeNull();
  });

  describe('finishFiles', () => {
    it('writes the metadata of shows that received episodes', async () => {
      await followUp.finishFiles({ items: [toTv], shows: [{ ownerChannelId: 'UC1', showId: 5, plot: 'About' }] });

      expect(require('../../sidecarWriter').writeShowMetadata).toHaveBeenCalledWith({
        show: { id: 5, folder_name: 'Chan' }, showDir: '/data/__TV/Chan', plot: 'About',
      });
    });

    it('writes channel art where videos arrived and removes the folders they left', async () => {
      await followUp.finishFiles({ items: [toTv, toVideos], shows: [] });

      expect(require('../../sidecarWriter').writeFolderArt).toHaveBeenCalledWith({ channelId: 'UC2', folderPath: '/data/Other' });
      expect(require('../../filesystem/directoryManager').cleanupEmptyChannelDirectory)
        .toHaveBeenCalledWith('/data/__Kids/Chan', '/data', { includeIgnorableFiles: true });
      expect(require('../../filesystem/showFolderCleanup').cleanupOrphanShowFolder).toHaveBeenCalledWith('/data/__TV/Other');
    });

    describe('a show folder that is a channel folder again', () => {
      const sameFolder = {
        ...toVideos,
        plan: {
          ...toVideos.plan,
          oldVideoPath: '/data/__Kids/Other/Season 2024/S2024E02 - U [bbbbbbbbbbb].mp4',
          newVideoPath: '/data/__Kids/Other/Other - U - bbbbbbbbbbb/Other - U [bbbbbbbbbbb].mp4',
          fromLibraryFolder: 'Kids',
          libraryFolder: 'Kids',
        },
      };
      let readFile;
      let unlink;

      beforeEach(() => {
        const fs = require('fs');
        readFile = jest.spyOn(fs.promises, 'readFile');
        unlink = jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
      });

      afterEach(() => {
        readFile.mockRestore();
        unlink.mockRestore();
      });

      it('loses Youtarr\'s tvshow.nfo', async () => {
        readFile.mockResolvedValue('<tvshow>\n  <uniqueid type="youtube" default="true">UC2</uniqueid>\n</tvshow>\n');

        await followUp.finishFiles({ items: [sameFolder], shows: [] });

        expect(readFile).toHaveBeenCalledWith('/data/__Kids/Other/tvshow.nfo', 'utf8');
        expect(unlink).toHaveBeenCalledWith('/data/__Kids/Other/tvshow.nfo');
      });

      it('keeps a tvshow.nfo Youtarr didn\'t write', async () => {
        readFile.mockResolvedValue('<tvshow><title>My own show</title></tvshow>');

        await followUp.finishFiles({ items: [sameFolder], shows: [] });

        expect(unlink).not.toHaveBeenCalled();
      });
    });

    it('regenerates the .m3u of channels now saving to a Videos folder', async () => {
      await followUp.finishFiles({ items: [toVideos], shows: [] });

      expect(require('../../m3uGenerator').generateChannelM3U).toHaveBeenCalledWith('UC2');
    });

    it('keeps going when one step fails', async () => {
      require('../../filesystem/directoryManager').cleanupEmptyChannelDirectory.mockRejectedValue(new Error('busy'));

      await expect(followUp.finishFiles({ items: [toTv, toVideos], shows: [] })).resolves.toBeUndefined();
      expect(require('../../m3uGenerator').generateChannelM3U).toHaveBeenCalled();
    });
  });

  describe('finishServers', () => {
    it('re-syncs playlists with moved videos, refreshes both libraries and schedules push-back', async () => {
      const adapter = { serverType: 'jellyfin', triggerLibraryScan: jest.fn() };
      require('../../mediaServers/serverRegistry').getEnabledAdapters.mockReturnValue([{ serverType: 'plex' }, adapter]);

      await followUp.finishServers({ items: [toTv] });

      expect(require('../../m3uGenerator').generatePlaylistM3U).toHaveBeenCalledWith(4);
      expect(require('../../mediaServers/mediaServerSync').syncPlaylist).toHaveBeenCalledWith(4);
      expect(require('../../plexModule').refreshLibrariesForSubfolders).toHaveBeenCalledWith(['Kids', 'TV']);
      expect(adapter.triggerLibraryScan).toHaveBeenCalled();
      expect(require('../../mediaServers/watchStatusPushBack').scheduleFollowUps).toHaveBeenCalled();
    });

    it('syncs the playlists again once the servers have had time to index the moved files', async () => {
      const scheduled = [];
      const schedule = jest.fn((fn, ms) => { scheduled.push({ fn, ms }); return { unref: jest.fn() }; });
      const { syncPlaylist } = require('../../mediaServers/mediaServerSync');

      await followUp.finishServers({ items: [toTv], resync: { schedule } });
      expect(scheduled.map((entry) => entry.ms)).toEqual(followUp.PLAYLIST_RESYNC_DELAYS_MS);
      syncPlaylist.mockClear();
      scheduled[0].fn();

      await new Promise((resolve) => setImmediate(resolve));
      expect(syncPlaylist).toHaveBeenCalledWith(4);
    });

    it('schedules push-back after a resumed run too, whose holds predate the restart', async () => {
      await followUp.finishServers({ items: [toTv] });

      expect(require('../../mediaServers/watchStatusPushBack').scheduleFollowUps).toHaveBeenCalled();
    });
  });
});
