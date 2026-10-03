jest.mock('../../logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

jest.mock('../../models/subfolder', () => ({
  findAll: jest.fn(),
  findOrCreate: jest.fn(),
  destroy: jest.fn(),
  count: jest.fn(),
}));
jest.mock('../../models/channel', () => ({ count: jest.fn(), findAll: jest.fn() }));
jest.mock('../../models/playlist', () => ({ count: jest.fn(), findAll: jest.fn() }));
jest.mock('../../models/tvshow', () => ({ findAll: jest.fn() }));
jest.mock('../../models/videoclassification', () => ({ findAll: jest.fn() }));
jest.mock('../configModule', () => ({
  getDefaultSubfolder: jest.fn(),
  getConfig: jest.fn(),
  directoryPath: '/data',
}));
jest.mock('../filesystem', () => ({
  buildSubfolderSegment: (n) => (n ? `__${n}` : null),
  directoryHasFiles: jest.fn(),
  removeIfEmpty: jest.fn(),
  resolveEffectiveSubfolder: jest.requireActual('../filesystem/pathBuilder').resolveEffectiveSubfolder,
}));
// Folder layouts for the show count: TV and Kids TV are TV folders.
jest.mock('../tvShows/libraryLayouts', () => ({
  getLayoutResolver: jest.fn().mockResolvedValue((folder) => (/^(tv|kids tv)$/i.test(folder) ? 'tv' : 'videos')),
}));

const Subfolder = require('../../models/subfolder');
const Channel = require('../../models/channel');
const Playlist = require('../../models/playlist');
const TvShow = require('../../models/tvshow');
const VideoClassification = require('../../models/videoclassification');
const configModule = require('../configModule');
const filesystem = require('../filesystem');

let subfolderModule;
beforeEach(() => {
  jest.clearAllMocks();
  configModule.getDefaultSubfolder.mockReturnValue(null);
  configModule.getConfig.mockReturnValue({ plexSubfolderLibraryMappings: [] });
  VideoClassification.findAll.mockResolvedValue([]);
  TvShow.findAll.mockResolvedValue([]);
  subfolderModule = require('../subfolderModule');
});

describe('getAll', () => {
  test('unions registry rows with config default and plex mappings, prefixed and sorted', async () => {
    Subfolder.findAll.mockResolvedValue([{ name: 'Music' }, { name: 'Tech' }]);
    configModule.getDefaultSubfolder.mockReturnValue('Default');
    configModule.getConfig.mockReturnValue({
      plexSubfolderLibraryMappings: [{ subfolder: 'Kids', libraryId: '2' }, { subfolder: null, libraryId: '1' }],
    });

    const result = await subfolderModule.getAll();

    expect(result).toEqual(['__Default', '__Kids', '__Music', '__Tech']);
  });

  test('a config-only name appears even when not in the table; dedupes case-insensitively', async () => {
    Subfolder.findAll.mockResolvedValue([{ name: 'Music' }]);
    configModule.getDefaultSubfolder.mockReturnValue('music');
    const result = await subfolderModule.getAll();
    expect(result).toEqual(['__Music']);
  });
});

describe('getUsage', () => {
  beforeEach(() => {
    Channel.findAll.mockResolvedValue([]);
    Playlist.findAll.mockResolvedValue([]);
    filesystem.directoryHasFiles.mockResolvedValue(false);
  });

  test('reports an unused, empty subfolder as deletable with no usage', async () => {
    Subfolder.findAll.mockResolvedValue([{ name: 'Spare' }]);

    const result = await subfolderModule.getUsage();

    expect(result).toEqual([
      {
        name: 'Spare',
        displayName: '__Spare',
        usage: { channels: 0, playlists: 0, shows: 0, isDefault: false, plexMapped: false, hasFiles: false },
        deletable: true,
      },
    ]);
  });

  test('counts channel and playlist references case-insensitively and blocks deletion', async () => {
    Subfolder.findAll.mockResolvedValue([{ name: 'Music' }]);
    Channel.findAll.mockResolvedValue([{ sub_folder: 'Music' }, { sub_folder: 'music' }, { sub_folder: '##USE_GLOBAL_DEFAULT##' }]);
    Playlist.findAll.mockResolvedValue([{ default_sub_folder: 'MUSIC' }]);

    const [item] = await subfolderModule.getUsage();

    expect(item.usage.channels).toBe(2);
    expect(item.usage.playlists).toBe(1);
    expect(item.deletable).toBe(false);
  });

  test('counts TV shows with numbered episodes and blocks deletion', async () => {
    Subfolder.findAll.mockResolvedValue([{ name: 'TV' }]);
    VideoClassification.findAll.mockResolvedValue([{ show_id: 1 }, { show_id: 2 }]);
    TvShow.findAll.mockResolvedValue([{ library_folder: 'tv' }, { library_folder: 'Other' }]);

    const [item] = await subfolderModule.getUsage();

    expect(item.usage.shows).toBe(1);
    expect(item.deletable).toBe(false);
  });

  test('flags the global default and is not deletable', async () => {
    Subfolder.findAll.mockResolvedValue([]);
    configModule.getDefaultSubfolder.mockReturnValue('Default');

    const [item] = await subfolderModule.getUsage();

    expect(item.displayName).toBe('__Default');
    expect(item.usage.isDefault).toBe(true);
    expect(item.deletable).toBe(false);
  });

  test('flags a Plex-mapped and on-disk subfolder as not deletable', async () => {
    Subfolder.findAll.mockResolvedValue([{ name: 'Movies' }]);
    configModule.getConfig.mockReturnValue({ plexSubfolderLibraryMappings: [{ subfolder: 'Movies', libraryId: '5' }] });
    filesystem.directoryHasFiles.mockResolvedValue(true);

    const [item] = await subfolderModule.getUsage();

    expect(item.usage.plexMapped).toBe(true);
    expect(item.usage.hasFiles).toBe(true);
    expect(item.deletable).toBe(false);
  });
});

describe('register', () => {
  test('upserts a real name', async () => {
    Subfolder.findOrCreate.mockResolvedValue([{ name: 'Sports' }, true]);
    await subfolderModule.register('  Sports ');
    expect(Subfolder.findOrCreate).toHaveBeenCalledWith({ where: { name: 'Sports' }, defaults: { name: 'Sports' } });
  });

  test('ignores sentinels, null, and empty', async () => {
    await subfolderModule.register('##USE_GLOBAL_DEFAULT##');
    await subfolderModule.register('##ROOT##');
    await subfolderModule.register(null);
    await subfolderModule.register('   ');
    expect(Subfolder.findOrCreate).not.toHaveBeenCalled();
  });

  test('tolerates a unique-constraint race', async () => {
    const err = new Error('dup'); err.name = 'SequelizeUniqueConstraintError';
    Subfolder.findOrCreate.mockRejectedValueOnce(err);
    await expect(subfolderModule.register('Dup')).resolves.toBeUndefined();
  });
});

describe('delete', () => {
  beforeEach(() => {
    Channel.count.mockResolvedValue(0);
    Playlist.count.mockResolvedValue(0);
    configModule.getDefaultSubfolder.mockReturnValue(null);
    configModule.getConfig.mockReturnValue({ plexSubfolderLibraryMappings: [] });
    filesystem.directoryHasFiles.mockResolvedValue(false);
    Subfolder.count.mockResolvedValue(1);
  });

  test('deletes when empty and unused', async () => {
    Subfolder.destroy.mockResolvedValue(1);
    await subfolderModule.delete('Old');
    expect(Subfolder.destroy).toHaveBeenCalledWith({ where: { name: 'Old' } });
    expect(filesystem.removeIfEmpty).toHaveBeenCalledWith('/data/__Old');
  });

  test('404 when the name is not in the registry', async () => {
    Subfolder.count.mockResolvedValue(0);
    await expect(subfolderModule.delete('Ghost')).rejects.toMatchObject({ status: 404 });
  });

  test('409 when a channel uses it', async () => {
    Channel.count.mockResolvedValue(2);
    await expect(subfolderModule.delete('Used')).rejects.toMatchObject({ status: 409 });
    expect(Subfolder.destroy).not.toHaveBeenCalled();
  });

  test('409 when a playlist uses it', async () => {
    Playlist.count.mockResolvedValue(2);
    await expect(subfolderModule.delete('Used')).rejects.toMatchObject({ status: 409 });
    expect(Subfolder.destroy).not.toHaveBeenCalled();
  });

  test('409 when it is the global default', async () => {
    configModule.getDefaultSubfolder.mockReturnValue('Used');
    await expect(subfolderModule.delete('used')).rejects.toMatchObject({ status: 409 });
  });

  test('409 when a plex mapping references it', async () => {
    configModule.getConfig.mockReturnValue({ plexSubfolderLibraryMappings: [{ subfolder: 'Used', libraryId: '3' }] });
    await expect(subfolderModule.delete('used')).rejects.toMatchObject({ status: 409 });
  });

  test('409 when it holds a TV show with numbered episodes', async () => {
    VideoClassification.findAll.mockResolvedValue([{ show_id: 4 }]);
    TvShow.findAll.mockResolvedValue([{ library_folder: 'TV' }]);
    await expect(subfolderModule.delete('tv')).rejects.toThrow('holds 1 TV show(s)');
  });

  test('still counts the show of a channel that downloads to the folder', async () => {
    VideoClassification.findAll.mockResolvedValue([{ show_id: 4 }]);
    TvShow.findAll.mockResolvedValue([{ library_folder: 'TV', channel_id: 'UC1' }]);
    Channel.findAll.mockResolvedValue([{ channel_id: 'UC1', sub_folder: 'TV' }]);
    await expect(subfolderModule.delete('TV')).rejects.toThrow('holds 1 TV show(s)');
  });

  test('ignores the show of a channel that has moved back to a videos folder', async () => {
    VideoClassification.findAll.mockResolvedValue([{ show_id: 4 }]);
    TvShow.findAll.mockResolvedValue([{ library_folder: 'TV', channel_id: 'UC1' }]);
    Channel.findAll.mockResolvedValue([{ channel_id: 'UC1', sub_folder: 'Kids' }]);
    await expect(subfolderModule.delete('TV')).resolves.toBeUndefined();
  });

  test('counts the show of an untracked channel, which has no folder of its own', async () => {
    VideoClassification.findAll.mockResolvedValue([{ show_id: 4 }]);
    TvShow.findAll.mockResolvedValue([{ library_folder: 'TV', channel_id: 'UCuntracked' }]);
    Channel.findAll.mockResolvedValue([]);
    await expect(subfolderModule.delete('TV')).rejects.toThrow('holds 1 TV show(s)');
  });

  test('ignores retired shows when counting', async () => {
    VideoClassification.findAll.mockResolvedValue([{ show_id: 4 }]);
    await subfolderModule.delete('TV');
    expect(TvShow.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: [4], retired_at: null },
    }));
  });

  test('409 when the directory still holds files', async () => {
    filesystem.directoryHasFiles.mockResolvedValue(true);
    await expect(subfolderModule.delete('Full')).rejects.toMatchObject({ status: 409 });
  });
});
