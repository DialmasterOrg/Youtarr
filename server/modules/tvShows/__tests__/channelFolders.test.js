jest.mock('../../configModule', () => ({
  getDefaultSubfolder: jest.fn(),
  directoryPath: '/data',
}));
jest.mock('../libraryLayouts', () => ({ getLayoutResolver: jest.fn(), listTvFolders: jest.fn() }));
jest.mock('../showStore', () => ({ findChannelShow: jest.fn() }));

const path = require('path');
const { Op } = require('sequelize');

describe('channelFolders', () => {
  let channelFolders;
  let configModule;
  let libraryLayouts;
  let showStore;
  const layoutOf = (folder) => (folder === 'TV' ? 'tv' : 'videos');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    configModule = require('../../configModule');
    libraryLayouts = require('../libraryLayouts');
    showStore = require('../showStore');
    channelFolders = require('../channelFolders');
    configModule.getDefaultSubfolder.mockReturnValue(null);
    libraryLayouts.getLayoutResolver.mockResolvedValue(layoutOf);
    showStore.findChannelShow.mockResolvedValue(null);
  });

  describe('effectiveLibraryFolder', () => {
    it('resolves the global default sentinel through config', () => {
      configModule.getDefaultSubfolder.mockReturnValue('TV');
      expect(channelFolders.effectiveLibraryFolder('##USE_GLOBAL_DEFAULT##')).toBe('TV');
    });

    it('returns the main folder for root', () => {
      expect(channelFolders.effectiveLibraryFolder('##ROOT##')).toBe('');
    });
  });

  describe('resolveChannelDirectory', () => {
    const channel = { channel_id: 'UC1', sub_folder: 'Kids', folder_name: 'Mark Rober' };

    it('returns the channel folder of a videos-layout channel', async () => {
      await expect(channelFolders.resolveChannelDirectory(channel)).resolves.toEqual({
        layout: 'videos', dir: path.join('/data', '__Kids', 'Mark Rober'),
      });
    });

    it('returns the pinned show folder of a TV channel', async () => {
      showStore.findChannelShow.mockResolvedValue({ library_folder: 'TV', folder_name: 'Pinned Name' });
      await expect(channelFolders.resolveChannelDirectory({ ...channel, sub_folder: 'TV' })).resolves.toEqual({
        layout: 'tv', dir: path.join('/data', '__TV', 'Pinned Name'),
      });
    });

    it('returns no folder for a TV channel without a show yet', async () => {
      await expect(channelFolders.resolveChannelDirectory({ ...channel, sub_folder: 'TV' })).resolves.toEqual({
        layout: 'tv', dir: null,
      });
    });

    it('uses a passed resolver instead of reading layouts again', async () => {
      await channelFolders.resolveChannelDirectory(channel, { layoutOf });
      expect(libraryLayouts.getLayoutResolver).not.toHaveBeenCalled();
    });
  });

  describe('showDirectory', () => {
    it('places a main-folder show directly under the downloads folder', () => {
      expect(channelFolders.showDirectory({ library_folder: '', folder_name: 'Show' })).toBe(path.join('/data', 'Show'));
    });
  });

  describe('tvChannelCondition', () => {
    it('is null when no folder is TV', async () => {
      libraryLayouts.listTvFolders.mockResolvedValue([]);
      await expect(channelFolders.tvChannelCondition()).resolves.toBeNull();
    });

    it('matches channels in a TV subfolder', async () => {
      libraryLayouts.listTvFolders.mockResolvedValue(['TV']);
      await expect(channelFolders.tvChannelCondition()).resolves.toEqual({
        [Op.or]: [{ sub_folder: { [Op.in]: ['TV'] } }],
      });
    });

    it('matches channels on the global default when the default is TV', async () => {
      configModule.getDefaultSubfolder.mockReturnValue('tv');
      libraryLayouts.listTvFolders.mockResolvedValue(['TV']);
      const condition = await channelFolders.tvChannelCondition();
      expect(condition[Op.or]).toContainEqual({ sub_folder: '##USE_GLOBAL_DEFAULT##' });
    });

    it('matches root channels, and default channels without a default subfolder, when the main folder is TV', async () => {
      libraryLayouts.listTvFolders.mockResolvedValue(['']);
      const condition = await channelFolders.tvChannelCondition();
      expect(condition[Op.or]).toEqual([
        { sub_folder: '##USE_GLOBAL_DEFAULT##' },
        { sub_folder: { [Op.or]: [null, '', '##ROOT##'] } },
      ]);
    });
  });

  describe('isTvChannel', () => {
    it('is true for a channel whose folder is TV', async () => {
      await expect(channelFolders.isTvChannel({ sub_folder: 'TV' })).resolves.toBe(true);
    });

    it('is false for a channel whose folder is videos', async () => {
      await expect(channelFolders.isTvChannel({ sub_folder: 'Kids' })).resolves.toBe(false);
    });
  });
});
