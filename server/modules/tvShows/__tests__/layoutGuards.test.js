jest.mock('../../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/playlist', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/video', () => ({ count: jest.fn() }));
jest.mock('../../../models/videoclassification', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/tvshow', () => ({ findAll: jest.fn() }));
jest.mock('../../configModule', () => ({ getDefaultSubfolder: jest.fn(), directoryPath: '/data' }));
jest.mock('../showStore', () => ({ findChannelShow: jest.fn() }));
jest.mock('../libraryLayouts', () => ({ getLayoutResolver: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');

describe('layoutGuards', () => {
  let layoutGuards;
  let Channel;
  let Playlist;
  let Video;
  let VideoClassification;
  let configModule;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Channel = require('../../../models/channel');
    Playlist = require('../../../models/playlist');
    Video = require('../../../models/video');
    VideoClassification = require('../../../models/videoclassification');
    configModule = require('../../configModule');
    layoutGuards = require('../layoutGuards');
    VideoClassification.findAll.mockResolvedValue([]);
    configModule.getDefaultSubfolder.mockReturnValue('TV');
    Channel.findAll.mockResolvedValue([]);
    Playlist.findAll.mockResolvedValue([]);
    Video.count.mockResolvedValue(0);
  });

  describe('assertNoDownloadRunning', () => {
    it('refuses with 409 while a download runs', () => {
      expect(() => layoutGuards.assertNoDownloadRunning(() => true, 'busy')).toThrow(expect.objectContaining({ status: 409 }));
    });

    it('allows the change when nothing runs or no check is given', () => {
      expect(() => layoutGuards.assertNoDownloadRunning(() => false, 'busy')).not.toThrow();
      expect(() => layoutGuards.assertNoDownloadRunning(undefined, 'busy')).not.toThrow();
    });
  });

  describe('channelHasDownloads', () => {
    it('counts the channel videos that still have files', async () => {
      Video.count.mockResolvedValue(2);
      await expect(layoutGuards.channelHasDownloads('UC1')).resolves.toBe(true);
      expect(Video.count).toHaveBeenCalledWith({ where: { channel_id: 'UC1', removed: false } });
    });

    it('counts episodes of the channel uploaded under another channel id', async () => {
      Video.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
      VideoClassification.findAll.mockResolvedValue([{ youtube_id: 'vevo1' }]);
      await expect(layoutGuards.channelHasDownloads('UC1')).resolves.toBe(true);
      expect(Video.count).toHaveBeenLastCalledWith({ where: { youtubeId: ['vevo1'], removed: false } });
    });

    it('reports no downloads when the channel has no videos or episodes with files', async () => {
      Video.count.mockResolvedValue(0);
      VideoClassification.findAll.mockResolvedValue([{ youtube_id: 'gone1' }]);
      await expect(layoutGuards.channelHasDownloads('UC1')).resolves.toBe(false);
    });
  });

  describe('mainFolderHasFiles', () => {
    let root;
    beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-folder-')); });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    const write = (relative) => {
      fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      fs.writeFileSync(path.join(root, relative), 'x');
    };

    it('ignores subfolders, the temp folder and dotfiles', async () => {
      write('__Kids/Channel/video [abcdefghijk].mp4');
      write('.youtarr_tmp/Channel/video [abcdefghijk].mp4');
      write('.plexignore');
      await expect(layoutGuards.mainFolderHasFiles(root)).resolves.toBe(false);
    });

    it('finds a channel folder with downloads', async () => {
      write('Channel/video [abcdefghijk]/video [abcdefghijk].mp4');
      await expect(layoutGuards.mainFolderHasFiles(root)).resolves.toBe(true);
    });

    it('treats a missing downloads folder as empty', async () => {
      await expect(layoutGuards.mainFolderHasFiles(path.join(root, 'missing'))).resolves.toBe(false);
    });
  });

  describe('usersOfFolder', () => {
    it('matches channels and playlists by the folder they resolve to', async () => {
      Channel.findAll.mockResolvedValue([
        { channel_id: 'A', sub_folder: '##USE_GLOBAL_DEFAULT##' },
        { channel_id: 'B', sub_folder: 'tv' },
        { channel_id: 'C', sub_folder: 'Kids' },
      ]);
      Playlist.findAll.mockResolvedValue([{ playlist_id: 'P', default_sub_folder: 'TV' }]);
      const users = await layoutGuards.usersOfFolder('TV');
      expect(users.channels.map((c) => c.channel_id)).toEqual(['A', 'B']);
      expect(users.playlists.map((p) => p.playlist_id)).toEqual(['P']);
    });

    it('resolves sentinels through a supplied resolver', async () => {
      Channel.findAll.mockResolvedValue([{ channel_id: 'A', sub_folder: '##USE_GLOBAL_DEFAULT##' }]);
      const users = await layoutGuards.usersOfFolder('Kids', { subFolderOf: () => 'Kids' });
      expect(users.channels).toHaveLength(1);
    });
  });

  describe('usersOfGlobalDefault', () => {
    it('selects channels and enabled playlists set to the global default', async () => {
      await layoutGuards.usersOfGlobalDefault();
      expect(Channel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { sub_folder: '##USE_GLOBAL_DEFAULT##' },
      }));
      expect(Playlist.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: { enabled: true, default_sub_folder: '##USE_GLOBAL_DEFAULT##' },
      }));
    });
  });

  describe('assertNoMp3Users', () => {
    it('refuses when an enabled channel downloads MP3, naming it', () => {
      const users = { channels: [{ title: 'Podcast', enabled: true, audio_format: 'mp3_only' }], playlists: [] };
      expect(() => layoutGuards.assertNoMp3Users(users, 'this folder')).toThrow(/Podcast/);
    });

    it('ignores disabled channels', () => {
      const users = { channels: [{ title: 'Old', enabled: false, audio_format: 'mp3_only' }], playlists: [] };
      expect(() => layoutGuards.assertNoMp3Users(users, 'this folder')).not.toThrow();
    });

    it('refuses an MP3 playlist', () => {
      const users = { channels: [], playlists: [{ title: 'Mix', audio_format: 'video_mp3' }] };
      expect(() => layoutGuards.assertNoMp3Users(users, 'this folder')).toThrow(expect.objectContaining({ status: 409 }));
    });
  });

  describe('assertVideoOnlyDestination', () => {
    beforeEach(() => {
      require('../libraryLayouts').getLayoutResolver.mockResolvedValue((folder) => (folder === 'TV' ? 'tv' : 'videos'));
    });

    it('refuses MP3 into a TV folder', async () => {
      await expect(layoutGuards.assertVideoOnlyDestination({ audioFormat: 'video_mp3', subFolderValue: 'TV' }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('resolves the global default sentinel', async () => {
      await expect(layoutGuards.assertVideoOnlyDestination({ audioFormat: 'mp3_only', subFolderValue: '##USE_GLOBAL_DEFAULT##' }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('allows MP3 into a videos folder', async () => {
      await expect(layoutGuards.assertVideoOnlyDestination({ audioFormat: 'mp3_only', subFolderValue: 'Kids' }))
        .resolves.toBeUndefined();
    });

    it('allows video into a TV folder without reading layouts', async () => {
      await layoutGuards.assertVideoOnlyDestination({ audioFormat: null, subFolderValue: 'TV' });
      expect(require('../libraryLayouts').getLayoutResolver).not.toHaveBeenCalled();
    });
  });

  describe('reorganizeRequiredError', () => {
    it('carries the change to review in a 409', () => {
      const err = layoutGuards.reorganizeRequiredError('Review it', { type: 'folderLayout', folder: 'Kids', layout: 'tv' });

      expect(err).toMatchObject({ status: 409, reorganizeRequired: true, change: { type: 'folderLayout', folder: 'Kids', layout: 'tv' } });
    });
  });

  describe('errorBody', () => {
    it('is the error message for a plain refusal', () => {
      expect(layoutGuards.errorBody(layoutGuards.guardError('No', 400))).toEqual({ error: 'No' });
    });

    it('adds the change to review and the error code', () => {
      const err = layoutGuards.reorganizeRequiredError('Review it', { type: 'channel', channelId: 'UC1', subFolder: 'TV' });
      err.code = 'X';

      expect(layoutGuards.errorBody(err)).toEqual({
        error: 'Review it', reorganizeRequired: true, change: { type: 'channel', channelId: 'UC1', subFolder: 'TV' }, code: 'X',
      });
    });
  });

  describe('assertNoTitleShows', () => {
    it('refuses a folder that holds active title shows, naming them', async () => {
      require('../../../models/tvshow').findAll.mockResolvedValue([{ name: 'Beyblade' }, { name: 'Hermitcraft' }]);
      await expect(layoutGuards.assertNoTitleShows('TV Shows')).rejects.toMatchObject({
        status: 400, message: expect.stringContaining('Beyblade, Hermitcraft'),
      });
      expect(require('../../../models/tvshow').findAll.mock.calls[0][0].where).toEqual({
        library_folder: 'TV Shows', kind: 'title', retired_at: null,
      });
    });

    it('lets a folder without title shows through', async () => {
      require('../../../models/tvshow').findAll.mockResolvedValue([]);
      await expect(layoutGuards.assertNoTitleShows('')).resolves.toBeUndefined();
    });
  });
});
