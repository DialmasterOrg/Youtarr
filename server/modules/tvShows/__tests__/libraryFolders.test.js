const fs = require('fs');
const os = require('os');
const path = require('path');

const mockRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'library-folders-'));

jest.mock('../../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/playlist', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/video', () => ({ count: jest.fn() }));
jest.mock('../../../models/videoclassification', () => ({ findAll: jest.fn().mockResolvedValue([]) }));
jest.mock('../../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../configModule', () => ({ getDefaultSubfolder: jest.fn(), directoryPath: mockRoot }));
jest.mock('../../subfolderModule', () => ({ getUsage: jest.fn(), getAll: jest.fn(), register: jest.fn() }));
jest.mock('../libraryLayouts', () => ({ getLayoutResolver: jest.fn(), setLayout: jest.fn() }));
jest.mock('../showStore', () => ({ findChannelShow: jest.fn() }));

const usage = (name, overrides = {}) => ({
  name,
  displayName: `__${name}`,
  usage: { channels: 0, playlists: 0, isDefault: false, plexMapped: false, hasFiles: false, ...overrides },
});

describe('libraryFolders', () => {
  let libraryFolders;
  let Channel;
  let Playlist;
  let Video;
  let configModule;
  let subfolderModule;
  let libraryLayouts;
  let layouts;

  const writeFile = (relative, content = 'x') => {
    fs.mkdirSync(path.dirname(path.join(mockRoot, relative)), { recursive: true });
    fs.writeFileSync(path.join(mockRoot, relative), content);
  };
  const plexIgnorePath = () => path.join(mockRoot, '.plexignore');

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    fs.rmSync(mockRoot, { recursive: true, force: true });
    fs.mkdirSync(mockRoot);
    Channel = require('../../../models/channel');
    Playlist = require('../../../models/playlist');
    Video = require('../../../models/video');
    configModule = require('../../configModule');
    subfolderModule = require('../../subfolderModule');
    libraryLayouts = require('../libraryLayouts');
    libraryFolders = require('../libraryFolders');
    layouts = { TV: 'tv' };
    configModule.getDefaultSubfolder.mockReturnValue('Kids');
    libraryLayouts.getLayoutResolver.mockImplementation(async () => (folder) => layouts[folder] || 'videos');
    subfolderModule.getAll.mockResolvedValue(['__Kids', '__TV']);
    subfolderModule.getUsage.mockResolvedValue([usage('Kids', { isDefault: true, hasFiles: true }), usage('TV')]);
    Channel.findAll.mockResolvedValue([]);
    Playlist.findAll.mockResolvedValue([]);
    Video.count.mockResolvedValue(0);
  });

  afterAll(() => fs.rmSync(mockRoot, { recursive: true, force: true }));

  describe('listLibraryFolders', () => {
    it('lists the main folder first, then each subfolder with its layout', async () => {
      Channel.findAll.mockResolvedValue([
        { sub_folder: '##USE_GLOBAL_DEFAULT##' }, { sub_folder: 'kids' }, { sub_folder: 'TV' }, { sub_folder: null },
      ]);
      await expect(libraryFolders.listLibraryFolders()).resolves.toEqual([
        { name: '', layout: 'videos', isDefault: false, hasFiles: false, channels: 1 },
        { name: 'Kids', layout: 'videos', isDefault: true, hasFiles: true, channels: 2 },
        { name: 'TV', layout: 'tv', isDefault: false, hasFiles: false, channels: 1 },
      ]);
    });
  });

  describe('setFolderLayout', () => {
    it('switches an empty subfolder to TV', async () => {
      await expect(libraryFolders.setFolderLayout('Kids', 'tv')).resolves.toEqual({ changed: true });
      expect(libraryLayouts.setLayout).toHaveBeenCalledWith('Kids', 'tv');
    });

    it('registers a subfolder known only from config before storing its layout', async () => {
      const order = [];
      subfolderModule.register.mockImplementation(async (name) => { order.push(`register:${name}`); });
      libraryLayouts.setLayout.mockImplementation(async (name) => { order.push(`layout:${name}`); });
      await libraryFolders.setFolderLayout('Kids', 'tv');
      expect(order).toEqual(['register:Kids', 'layout:Kids']);
    });

    it('does not register the main folder', async () => {
      await libraryFolders.setFolderLayout('', 'tv');
      expect(subfolderModule.register).not.toHaveBeenCalled();
    });

    it('leaves a folder that already has the layout alone', async () => {
      await expect(libraryFolders.setFolderLayout('TV', 'tv')).resolves.toEqual({ changed: false });
      expect(libraryLayouts.setLayout).not.toHaveBeenCalled();
    });

    it('rejects an unknown subfolder', async () => {
      await expect(libraryFolders.setFolderLayout('Nope', 'tv')).rejects.toMatchObject({ status: 404 });
    });

    it('rejects an unknown layout', async () => {
      await expect(libraryFolders.setFolderLayout('Kids', 'shows')).rejects.toMatchObject({ status: 400 });
    });

    it('refuses while a download runs', async () => {
      await expect(libraryFolders.setFolderLayout('Kids', 'tv', { isDownloadRunning: () => true }))
        .rejects.toThrow(libraryFolders.MESSAGES.running);
    });

    it('sends a folder that holds downloaded files to the reorganize', async () => {
      writeFile('__Kids/Channel/video [abcdefghijk].mp4');
      await expect(libraryFolders.setFolderLayout('Kids', 'tv')).rejects.toMatchObject({
        status: 409, reorganizeRequired: true, change: { type: 'folderLayout', folder: 'Kids', layout: 'tv' },
        message: libraryFolders.MESSAGES.reorganize,
      });
    });

    it('sends a folder whose channels have downloads on record to the reorganize', async () => {
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC1', sub_folder: 'Kids', enabled: true }]);
      Video.count.mockResolvedValue(4);
      await expect(libraryFolders.setFolderLayout('Kids', 'tv')).rejects.toMatchObject({ status: 409, reorganizeRequired: true });
    });

    it('refuses while a reorganize runs', async () => {
      const lock = require('../../reorganize/reorganizeLock');
      const token = lock.acquire({ label: 'x' });
      try {
        await expect(libraryFolders.setFolderLayout('Kids', 'tv')).rejects.toThrow(libraryFolders.MESSAGES.reorganizing);
      } finally {
        lock.release(token);
      }
    });

    it('refuses TV for a folder whose channels download MP3', async () => {
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC1', title: 'Pod', sub_folder: 'Kids', enabled: true, audio_format: 'mp3_only' }]);
      await expect(libraryFolders.setFolderLayout('Kids', 'tv')).rejects.toThrow(/Pod/);
    });

    it('writes a .plexignore when the main folder becomes TV', async () => {
      await libraryFolders.setFolderLayout('', 'tv');
      expect(fs.readFileSync(plexIgnorePath(), 'utf8')).toBe('__*/*\n');
    });

    it('adds the rule to an existing .plexignore', async () => {
      writeFile('.plexignore', 'Extras/*');
      await libraryFolders.setFolderLayout('', 'tv');
      expect(fs.readFileSync(plexIgnorePath(), 'utf8')).toBe('Extras/*\n__*/*\n');
    });

    it('removes its own .plexignore when the main folder goes back to videos', async () => {
      layouts[''] = 'tv';
      writeFile('.plexignore', '__*/*\n');
      await libraryFolders.setFolderLayout('', 'videos');
      expect(fs.existsSync(plexIgnorePath())).toBe(false);
    });

    it('keeps a .plexignore the user changed', async () => {
      layouts[''] = 'tv';
      writeFile('.plexignore', 'Extras/*\n__*/*\n');
      await libraryFolders.setFolderLayout('', 'videos');
      expect(fs.existsSync(plexIgnorePath())).toBe(true);
    });
  });

  describe('checkDefaultSubfolderChange', () => {
    const check = (overrides) => libraryFolders.checkDefaultSubfolderChange({ oldDefault: 'Kids', newDefault: 'TV', ...overrides });

    it('allows moving between folders with the same layout without looking at channels', async () => {
      await expect(check({ newDefault: 'Music' })).resolves.toBeUndefined();
      expect(Channel.findAll).not.toHaveBeenCalled();
    });

    it('allows a cross-layout change when the default has no downloads', async () => {
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC1', enabled: true }]);
      await expect(check()).resolves.toBeUndefined();
    });

    it('sends a default whose channels have downloads to the reorganize', async () => {
      Channel.findAll.mockResolvedValue([{ channel_id: 'UC1', enabled: true }]);
      Video.count.mockResolvedValue(1);
      await expect(check()).rejects.toMatchObject({
        status: 409, reorganizeRequired: true, message: libraryFolders.MESSAGES.defaultReorganize,
        change: { type: 'defaultSubfolder' },
      });
    });

    it('refuses while a download runs', async () => {
      await expect(check({ isDownloadRunning: () => true })).rejects.toThrow(libraryFolders.MESSAGES.defaultRunning);
    });

    it('refuses any change of the default while a reorganize runs, but not a save of the same value', async () => {
      const lock = require('../../reorganize/reorganizeLock');
      const token = lock.acquire({ label: 'x' });
      try {
        await expect(check({ newDefault: 'Music' })).rejects.toThrow(libraryFolders.MESSAGES.reorganizing);
        await expect(check({ newDefault: 'kids' })).resolves.toBeUndefined();
      } finally {
        lock.release(token);
      }
    });

    it('refuses a TV default when a playlist on the default downloads MP3', async () => {
      Playlist.findAll.mockResolvedValue([{ title: 'Mix', audio_format: 'mp3_only' }]);
      await expect(check()).rejects.toMatchObject({ status: 409 });
    });
  });
});
