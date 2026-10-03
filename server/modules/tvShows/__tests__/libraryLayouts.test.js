jest.mock('../../../models/subfolder', () => ({
  findAll: jest.fn(),
  update: jest.fn(),
}));
jest.mock('../../configModule', () => ({
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
}));

describe('libraryLayouts', () => {
  let libraryLayouts;
  let Subfolder;
  let configModule;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Subfolder = require('../../../models/subfolder');
    configModule = require('../../configModule');
    libraryLayouts = require('../libraryLayouts');
    configModule.getConfig.mockReturnValue({});
    Subfolder.findAll.mockResolvedValue([]);
  });

  describe('getLayoutResolver', () => {
    it('resolves every folder to videos when nothing is set to tv', async () => {
      const layoutOf = await libraryLayouts.getLayoutResolver();
      expect(['', 'TV Shows', 'kids'].map(layoutOf)).toEqual(['videos', 'videos', 'videos']);
    });

    it('resolves the main folder from mainFolderLayout', async () => {
      configModule.getConfig.mockReturnValue({ mainFolderLayout: 'tv' });
      const layoutOf = await libraryLayouts.getLayoutResolver();
      expect(layoutOf('')).toBe('tv');
    });

    it('treats an unknown mainFolderLayout as videos', async () => {
      configModule.getConfig.mockReturnValue({ mainFolderLayout: 'shows' });
      const layoutOf = await libraryLayouts.getLayoutResolver();
      expect(layoutOf('')).toBe('videos');
    });

    it('resolves a subfolder stored as tv, ignoring case', async () => {
      Subfolder.findAll.mockResolvedValue([{ name: 'TV Shows' }]);
      const layoutOf = await libraryLayouts.getLayoutResolver();
      expect([layoutOf('tv shows'), layoutOf('kids')]).toEqual(['tv', 'videos']);
    });
  });

  describe('listTvFolders', () => {
    it('lists TV subfolders sorted, with the main folder first when it is TV', async () => {
      configModule.getConfig.mockReturnValue({ mainFolderLayout: 'tv' });
      Subfolder.findAll.mockResolvedValue([{ name: 'Shows' }, { name: 'Kids TV' }]);
      await expect(libraryLayouts.listTvFolders()).resolves.toEqual(['', 'Kids TV', 'Shows']);
    });

    it('leaves out a videos main folder', async () => {
      Subfolder.findAll.mockResolvedValue([{ name: 'Shows' }]);
      await expect(libraryLayouts.listTvFolders()).resolves.toEqual(['Shows']);
    });
  });

  describe('setLayout', () => {
    it('stores the main folder layout in config', async () => {
      configModule.getConfig.mockReturnValue({ defaultSubfolder: 'x' });
      await libraryLayouts.setLayout('', 'tv');
      expect(configModule.updateConfig).toHaveBeenCalledWith({ defaultSubfolder: 'x', mainFolderLayout: 'tv' });
    });

    it('stores a subfolder layout on its row', async () => {
      await libraryLayouts.setLayout('TV Shows', 'tv');
      expect(Subfolder.update).toHaveBeenCalledWith({ layout: 'tv' }, { where: { name: 'TV Shows' } });
    });

    it('rejects an unknown layout', async () => {
      await expect(libraryLayouts.setLayout('kids', 'shows')).rejects.toThrow(TypeError);
    });
  });
});
