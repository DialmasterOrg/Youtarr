jest.mock('../../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/playlist', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/video', () => ({ count: jest.fn() }));
jest.mock('../../../models/videoclassification', () => ({ findAll: jest.fn().mockResolvedValue([]) }));
jest.mock('../../configModule', () => ({ getDefaultSubfolder: jest.fn(), directoryPath: '/data' }));
jest.mock('../libraryLayouts', () => ({ getLayoutResolver: jest.fn(), listTvFolders: jest.fn() }));
jest.mock('../showStore', () => ({
  findChannelShow: jest.fn(),
  createChannelShow: jest.fn(),
  relocateChannelShow: jest.fn(),
}));
jest.mock('../../filesystem/showFolderCleanup', () => ({ cleanupOrphanShowFolder: jest.fn().mockResolvedValue([]) }));

const path = require('path');

const LAYOUTS = { TV: 'tv', 'Kids TV': 'tv' };
const layoutOf = (folder) => LAYOUTS[folder] || 'videos';

describe('channelLayout', () => {
  let channelLayout;
  let Video;
  let configModule;
  let libraryLayouts;
  let showStore;
  const channel = { channel_id: 'UC1', title: 'Mark Rober', folder_name: 'Mark Rober', sub_folder: 'Kids', audio_format: null };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Video = require('../../../models/video');
    configModule = require('../../configModule');
    libraryLayouts = require('../libraryLayouts');
    showStore = require('../showStore');
    channelLayout = require('../channelLayout');
    Video.count.mockResolvedValue(0);
    configModule.getDefaultSubfolder.mockReturnValue('Kids');
    libraryLayouts.getLayoutResolver.mockResolvedValue(layoutOf);
    libraryLayouts.listTvFolders.mockResolvedValue(['TV']);
    showStore.findChannelShow.mockResolvedValue(null);
  });

  describe('checkChannelSettingsChange', () => {
    const check = (overrides) => channelLayout.checkChannelSettingsChange({ channel, ...overrides });

    it('allows a channel without downloads to switch to a TV folder', async () => {
      await expect(check({ newSubFolder: 'TV' })).resolves.toMatchObject({
        oldFolder: 'Kids', newFolder: 'TV', oldLayout: 'videos', newLayout: 'tv', involvesTv: true,
      });
    });

    it('refuses an MP3 download type in a TV folder', async () => {
      await expect(check({ newSubFolder: 'TV', newAudioFormat: 'mp3_only' })).rejects.toMatchObject({ status: 400 });
    });

    it('sends a channel with downloads switching layouts to the reorganize', async () => {
      Video.count.mockResolvedValue(3);
      await expect(check({ newSubFolder: 'TV' })).rejects.toMatchObject({
        status: 409, reorganizeRequired: true, change: { type: 'channel', channelId: 'UC1', subFolder: 'TV' },
      });
    });

    it('sends a TV channel with downloads moving to another TV folder to the reorganize', async () => {
      Video.count.mockResolvedValue(3);
      await expect(check({ channel: { ...channel, sub_folder: 'TV' }, newSubFolder: 'Kids TV' }))
        .rejects.toMatchObject({ status: 409, reorganizeRequired: true });
    });

    it('sends a channel with downloads to the reorganize even while a download runs', async () => {
      Video.count.mockResolvedValue(3);
      await expect(check({ newSubFolder: 'TV', isDownloadRunning: () => true }))
        .rejects.toMatchObject({ reorganizeRequired: true });
    });

    it('refuses a direct switch while a download runs', async () => {
      await expect(check({ newSubFolder: 'TV', isDownloadRunning: () => true }))
        .rejects.toThrow(channelLayout.MESSAGES.running);
    });

    it('refuses any change while a reorganize moves the channel\'s files', async () => {
      const lock = require('../../reorganize/reorganizeLock');
      const token = lock.acquire({ label: 'Mark Rober' });
      lock.setScope(token, { channelIds: ['UC1'] });
      try {
        await expect(check({ newAudioFormat: null })).rejects.toMatchObject({ status: 409, code: 'REORGANIZE_RUNNING' });
      } finally {
        lock.release(token);
      }
    });

    it('keeps allowing videos-folder moves for channels with downloads', async () => {
      Video.count.mockResolvedValue(3);
      await expect(check({ newSubFolder: 'Music' })).resolves.toMatchObject({ involvesTv: false });
    });
  });

  describe('applyChannelFolderChange', () => {
    const toTv = { oldFolder: 'Kids', newFolder: 'TV', oldLayout: 'videos', newLayout: 'tv' };

    it('creates the show at the new folder and remembers the folder it left', async () => {
      await channelLayout.applyChannelFolderChange({ channel, previousSubFolder: '##USE_GLOBAL_DEFAULT##', change: toTv });
      expect(showStore.createChannelShow).toHaveBeenCalledWith({
        channelId: 'UC1',
        name: 'Mark Rober',
        folderName: 'Mark Rober',
        libraryFolder: 'TV',
        previousVideosFolder: '##USE_GLOBAL_DEFAULT##',
      });
    });

    it.each([null, ''])('remembers a root channel (sub_folder %p) as the root folder', async (previousSubFolder) => {
      await channelLayout.applyChannelFolderChange({ channel, previousSubFolder, change: toTv });
      expect(showStore.createChannelShow).toHaveBeenCalledWith(expect.objectContaining({ previousVideosFolder: '##ROOT##' }));
    });

    it('moves an existing show to the new TV folder', async () => {
      const show = { library_folder: 'Kids TV', update: jest.fn() };
      showStore.findChannelShow.mockResolvedValue(show);
      showStore.relocateChannelShow.mockResolvedValue(show);
      await channelLayout.applyChannelFolderChange({ channel, previousSubFolder: 'Kids', change: toTv });
      expect(showStore.relocateChannelShow).toHaveBeenCalledWith(show, 'TV');
    });

    describe('leaving TV for a videos folder', () => {
      const toVideos = { oldFolder: 'TV', newFolder: 'Kids', oldLayout: 'tv', newLayout: 'videos' };
      let showFolderCleanup;
      beforeEach(() => { showFolderCleanup = require('../../filesystem/showFolderCleanup'); });

      it('keeps the show row and creates or moves nothing', async () => {
        showStore.findChannelShow.mockResolvedValue({ library_folder: 'TV', folder_name: 'MR', update: jest.fn() });
        await expect(channelLayout.applyChannelFolderChange({ channel, previousSubFolder: 'TV', change: toVideos })).resolves.toBeNull();
        expect(showStore.createChannelShow).not.toHaveBeenCalled();
        expect(showStore.relocateChannelShow).not.toHaveBeenCalled();
      });

      it('removes the show folder left behind when only metadata and art remain', async () => {
        showStore.findChannelShow.mockResolvedValue({ library_folder: 'TV', folder_name: 'MR' });
        await channelLayout.applyChannelFolderChange({ channel, previousSubFolder: 'TV', change: toVideos });
        expect(showFolderCleanup.cleanupOrphanShowFolder).toHaveBeenCalledWith(path.join('/data', '__TV', 'MR'));
      });

      it('cleans nothing for a channel without a show', async () => {
        await channelLayout.applyChannelFolderChange({ channel, previousSubFolder: 'TV', change: toVideos });
        expect(showFolderCleanup.cleanupOrphanShowFolder).not.toHaveBeenCalled();
      });

      it('leaves the folder alone when the channel moves between videos folders', async () => {
        const change = { oldFolder: 'Kids', newFolder: 'Music', oldLayout: 'videos', newLayout: 'videos' };
        await channelLayout.applyChannelFolderChange({ channel, previousSubFolder: 'Kids', change });
        expect(showStore.findChannelShow).not.toHaveBeenCalled();
      });
    });
  });

  describe('resolveLayoutTarget', () => {
    const target = (layout, folder) => channelLayout.resolveLayoutTarget({ channel, layout, folder });

    it('uses a chosen TV folder', async () => {
      await expect(target('tv', 'Kids TV')).resolves.toBe('Kids TV');
    });

    it('rejects a chosen folder with the other layout', async () => {
      await expect(target('tv', 'Kids')).rejects.toMatchObject({ status: 400 });
    });

    it('uses the global default when it is a TV folder', async () => {
      configModule.getDefaultSubfolder.mockReturnValue('TV');
      await expect(target('tv')).resolves.toBe('##USE_GLOBAL_DEFAULT##');
    });

    it('uses the only TV folder', async () => {
      await expect(target('tv')).resolves.toBe('TV');
    });

    it('asks for a choice when there are several TV folders', async () => {
      libraryLayouts.listTvFolders.mockResolvedValue(['Kids TV', 'TV']);
      await expect(target('tv')).rejects.toThrow('Choose a TV folder.');
    });

    it('asks for setup when there is no TV folder', async () => {
      libraryLayouts.listTvFolders.mockResolvedValue([]);
      await expect(target('tv')).rejects.toThrow('Set up a TV folder first.');
    });

    it('returns to the folder the channel left for TV', async () => {
      showStore.findChannelShow.mockResolvedValue({ previous_videos_folder: 'Music' });
      await expect(target('videos')).resolves.toBe('Music');
    });

    it('falls back to the global default for videos', async () => {
      await expect(target('videos')).resolves.toBe('##USE_GLOBAL_DEFAULT##');
    });

    it('rejects an unknown layout', async () => {
      await expect(target('shows')).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('getChannelTvState', () => {
    it('describes a TV channel with its show folder', async () => {
      showStore.findChannelShow.mockResolvedValue({ name: 'Mark Rober', folder_name: 'MR', library_folder: 'TV' });
      const state = await channelLayout.getChannelTvState({ ...channel, sub_folder: 'TV' });
      expect(state).toMatchObject({
        layout: 'tv',
        libraryFolder: 'TV',
        show: { name: 'Mark Rober', folderName: 'MR', libraryFolder: 'TV' },
        tvFolders: ['TV'],
        hasDownloads: false,
      });
    });

    it('reports a channel with downloads', async () => {
      Video.count.mockResolvedValue(1);
      const state = await channelLayout.getChannelTvState(channel);
      expect(state).toMatchObject({ layout: 'videos', show: null, hasDownloads: true });
    });
  });
});
