jest.mock('../../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/playlist', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/tvshow', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/video', () => ({ findAll: jest.fn() }));
jest.mock('../../configModule', () => ({ getDefaultSubfolder: jest.fn(), getConfig: jest.fn(), directoryPath: '/data' }));
jest.mock('../../subfolderModule', () => ({
  numberedShowCounts: jest.fn(),
  deletionBlockers: (usage) => jest.requireActual('../../subfolderDeletion').deletionBlockers(usage),
}));
jest.mock('../layoutGuards', () => ({ channelIdsWithDownloads: jest.fn() }));
jest.mock('../libraryLayouts', () => ({ getLayoutResolver: jest.fn() }));
jest.mock('../channelFolders', () => ({
  effectiveLibraryFolder: (value) => {
    const { resolveEffectiveSubfolder } = jest.requireActual('../../filesystem/pathBuilder');
    return resolveEffectiveSubfolder(value, require('../../configModule').getDefaultSubfolder()) || '';
  },
}));

const Channel = require('../../../models/channel');
const Playlist = require('../../../models/playlist');
const TvShow = require('../../../models/tvshow');
const Video = require('../../../models/video');
const configModule = require('../../configModule');
const subfolderModule = require('../../subfolderModule');
const layoutGuards = require('../layoutGuards');
const libraryLayouts = require('../libraryLayouts');
const { describeUsage, chosenFolderOf } = require('../folderUsage');

const DEFAULT = '##USE_GLOBAL_DEFAULT##';
const base = (name, extra = {}) => ({ name, layout: 'videos', isDefault: false, hasFiles: false, channels: 0, ...extra });

describe('folderUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configModule.getDefaultSubfolder.mockReturnValue('Kids');
    configModule.getConfig.mockReturnValue({ plexSubfolderLibraryMappings: [{ subfolder: 'KIDS', libraryId: '38' }] });
    Channel.findAll.mockResolvedValue([
      { channel_id: 'UC1', sub_folder: 'kids', enabled: true },
      { channel_id: 'UC2', sub_folder: DEFAULT, enabled: true },
      { channel_id: 'UC3', sub_folder: DEFAULT, enabled: false },
      { channel_id: 'UC4', sub_folder: 'Kids', enabled: false },
      { channel_id: 'UC5', sub_folder: null, enabled: true },
      { channel_id: 'UC6', sub_folder: 'TV', enabled: true },
    ]);
    Playlist.findAll.mockResolvedValue([
      { default_sub_folder: DEFAULT, enabled: true },
      { default_sub_folder: 'Kids', enabled: false },
    ]);
    TvShow.findAll.mockResolvedValue([{ library_folder: 'TV' }]);
    Video.findAll.mockResolvedValue([
      { filePath: '/data/__Kids/A/a [x].mp4', audioFilePath: null },
      { filePath: null, audioFilePath: '/data/__Kids/A/b [y].mp3' },
      { filePath: '/data/Chan/c [z].mp4', audioFilePath: null },
      { filePath: '/elsewhere/d [w].mp4', audioFilePath: null },
    ]);
    subfolderModule.numberedShowCounts.mockResolvedValue(new Map([['tv', 2]]));
    layoutGuards.channelIdsWithDownloads.mockResolvedValue(new Set(['UC3']));
    libraryLayouts.getLayoutResolver.mockResolvedValue((folder) => (folder.toLowerCase() === 'tv' ? 'tv' : 'videos'));
  });

  test('chosenFolderOf reads the default sentinel as following, root values as the main folder', () => {
    expect(chosenFolderOf(DEFAULT)).toBeNull();
    expect(chosenFolderOf('##ROOT##')).toBe('');
    expect(chosenFolderOf(null)).toBe('');
    expect(chosenFolderOf(' Kids ')).toBe('Kids');
  });

  test('without include, folders come back unchanged', async () => {
    const folders = [base('')];
    await expect(describeUsage(folders, {})).resolves.toBe(folders);
  });

  test('splits enabled channels into chosen and following, ignoring case', async () => {
    const [kids] = await describeUsage([base('Kids', { isDefault: true, channels: 2 })], { usage: true });

    expect(kids).toMatchObject({ channelsChosen: 1, channelsFollowing: 1, playlists: 1, titleShows: 0 });
  });

  test('counts main folder choosers and title shows', async () => {
    const [main, tv] = await describeUsage([base(''), base('TV', { layout: 'tv' })], { usage: true });

    expect(main).toMatchObject({ channelsChosen: 1, channelsFollowing: 0 });
    expect(tv).toMatchObject({ channelsChosen: 1, titleShows: 1 });
  });

  test('needs a review for a layout change when a user of the folder has downloads, even disabled', async () => {
    const [kids] = await describeUsage([base('Kids', { isDefault: true })], { usage: true });

    expect(kids.layoutChangeNeedsReview).toBe(true);
  });

  test('needs a review to become the default when the layouts differ and a follower has downloads', async () => {
    const [tv] = await describeUsage([base('TV', { layout: 'tv' })], { usage: true });

    expect(tv.makeDefaultNeedsReview).toBe(true);
  });

  test('does not need a review for a same-layout default switch', async () => {
    const [main] = await describeUsage([base('')], { usage: true });

    expect(main.makeDefaultNeedsReview).toBe(false);
  });

  test('reports the Plex mapping ignoring case', async () => {
    const [kids] = await describeUsage([base('Kids')], { usage: true });

    expect(kids.plexMapping).toEqual({ choice: 'library', libraryId: '38' });
  });

  test('lists every delete blocker, disabled channels and literal playlists included', async () => {
    const [kids] = await describeUsage([base('Kids', { isDefault: true, hasFiles: true })], { usage: true });

    expect(kids.deleteBlockers).toEqual([
      { code: 'channels', count: 1 },
      { code: 'disabledChannels', count: 1 },
      { code: 'playlists', count: 1 },
      { code: 'default' },
      { code: 'files' },
    ]);
    expect(kids.deletable).toBe(false);
  });

  test('the main folder is never deletable', async () => {
    const [main] = await describeUsage([base('')], { usage: true });

    expect(main.deleteBlockers).toEqual([{ code: 'main' }]);
  });

  test('fileCount buckets videos and audio-only files by folder, skipping paths outside the downloads folder', async () => {
    const [main, kids] = await describeUsage([base(''), base('Kids')], { files: true });

    expect(main.fileCount).toBe(1);
    expect(kids.fileCount).toBe(2);
    expect(kids.channelsChosen).toBeUndefined();
  });
});
