jest.mock('../../../models/channel', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/playlist', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/playlistvideo', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/tvshow', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/video', () => ({ findAll: jest.fn() }));
jest.mock('../../../models/videoclassification', () => ({ findAll: jest.fn() }));
jest.mock('../../configModule', () => ({ getDefaultSubfolder: jest.fn(), directoryPath: '/data' }));
jest.mock('../../subfolderModule', () => ({ getAll: jest.fn() }));
jest.mock('../../videoInfoStore', () => ({ readInfoOrFallback: jest.fn() }));
jest.mock('../libraryLayouts', () => ({ getLayoutResolver: jest.fn() }));
jest.mock('../layoutGuards', () => ({
  guardError: (message, status) => Object.assign(new Error(message), { status }),
}));
jest.mock('../channelFolders', () => ({
  effectiveLibraryFolder: (value) => {
    const { resolveEffectiveSubfolder } = jest.requireActual('../../filesystem/pathBuilder');
    return resolveEffectiveSubfolder(value, require('../../configModule').getDefaultSubfolder()) || '';
  },
}));
jest.mock('../folderUsage', () => ({
  chosenFolderOf: (value) => (value === '##USE_GLOBAL_DEFAULT##' ? null : (value || '').trim()),
}));

const { Op } = require('sequelize');
const Channel = require('../../../models/channel');
const Playlist = require('../../../models/playlist');
const PlaylistVideo = require('../../../models/playlistvideo');
const TvShow = require('../../../models/tvshow');
const Video = require('../../../models/video');
const VideoClassification = require('../../../models/videoclassification');
const configModule = require('../../configModule');
const subfolderModule = require('../../subfolderModule');
const videoInfoStore = require('../../videoInfoStore');
const libraryLayouts = require('../libraryLayouts');
const { getFolderDetail } = require('../folderDetail');

const video = (id, filePath, extra = {}) => ({
  id, youtubeId: `yt${id}`, channel_id: 'UC1', youTubeChannelName: 'Blippi', youTubeVideoName: `Title ${id}`,
  originalDate: '20260928', filePath, audioFilePath: null, last_downloaded_at: null, ...extra,
});

describe('folderDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configModule.getDefaultSubfolder.mockReturnValue('Kids');
    subfolderModule.getAll.mockResolvedValue(['__Kids', '__check', '__TV']);
    libraryLayouts.getLayoutResolver.mockResolvedValue((folder) => (folder === 'TV' ? 'tv' : 'videos'));
    Channel.findAll.mockImplementation(async ({ where }) => (where.enabled
      ? [
        { channel_id: 'UC1', uploader: 'Blippi', title: 'Blippi', sub_folder: 'Kids' },
        { channel_id: 'UC2', uploader: 'Zed', title: 'Zed', sub_folder: '##USE_GLOBAL_DEFAULT##' },
        { channel_id: 'UC3', uploader: 'Abe', title: 'Abe', sub_folder: '##USE_GLOBAL_DEFAULT##' },
      ]
      : [{ channel_id: 'UC9', uploader: 'Show Owner', title: 'Show Owner' }]));
    Playlist.findAll.mockResolvedValue([{ playlist_id: 'PL1', title: 'Songs', default_sub_folder: '##USE_GLOBAL_DEFAULT##' }]);
    PlaylistVideo.findAll.mockResolvedValue([{ playlist_id: 'PL1', youtube_id: 'yt1' }, { playlist_id: 'PL1', youtube_id: 'other' }]);
    TvShow.findAll.mockResolvedValue([]);
    VideoClassification.findAll.mockResolvedValue([]);
    Video.findAll.mockResolvedValue([
      video(1, '/data/__Kids/Blippi/Blippi - Title 1 [yt1].mp4', { last_downloaded_at: new Date('2026-09-01') }),
      video(2, '/data/__Kids/Blippi/Blippi - Title 2 [yt2].mp4', { last_downloaded_at: new Date('2026-09-30') }),
      video(3, '/data/__Kidsville/X/x [yt3].mp4'),
    ]);
    videoInfoStore.readInfoOrFallback.mockResolvedValue({ timestamp: 1790611800 });
  });

  test('404s an unknown folder', async () => {
    await expect(getFolderDetail('Nope')).rejects.toMatchObject({ status: 404, message: 'Library folder not found' });
  });

  test('resolves a folder named check and the main folder key', async () => {
    await expect(getFolderDetail('check')).resolves.toMatchObject({ name: 'check' });
    await expect(getFolderDetail('~main')).resolves.toMatchObject({ name: '' });
  });

  test('lists the channels that chose the folder with their videos here', async () => {
    const detail = await getFolderDetail('kids');

    expect(detail.name).toBe('Kids');
    expect(detail.channels).toEqual([{ channelId: 'UC1', name: 'Blippi', videoCount: 2 }]);
  });

  test('samples the followers of the default folder by name', async () => {
    const detail = await getFolderDetail('Kids');

    expect(detail.followers).toEqual({ count: 2, sample: ['Abe', 'Zed'] });
  });

  test('counts a playlist\'s videos in this folder only', async () => {
    const detail = await getFolderDetail('Kids');

    expect(detail.playlists).toEqual([{ playlistId: 'PL1', name: 'Songs', videoCount: 1 }]);
  });

  test('takes the most recent download as the example, with its upload time and path', async () => {
    const detail = await getFolderDetail('Kids');

    expect(detail.example).toEqual({
      channelName: 'Blippi',
      title: 'Title 2',
      youtubeId: 'yt2',
      uploadedAt: new Date(1790611800 * 1000).toISOString(),
      uploadedAtSource: 'timestamp',
      relativePath: 'Blippi/Blippi - Title 2 [yt2].mp4',
    });
  });

  test('falls back to the upload date at 00:00 UTC', async () => {
    videoInfoStore.readInfoOrFallback.mockResolvedValue({ upload_date: '20260928' });

    const detail = await getFolderDetail('Kids');

    expect(detail.example).toMatchObject({ uploadedAt: '2026-09-28T00:00:00.000Z', uploadedAtSource: 'upload_date' });
  });

  test('lists title shows with their channel and episodes here', async () => {
    TvShow.findAll.mockResolvedValue([{ id: 7, name: 'Lessons', channel_id: 'UC9', library_folder: 'TV' }]);
    VideoClassification.findAll.mockResolvedValue([{ show_id: 7, youtube_id: 'yt5' }]);
    Video.findAll.mockResolvedValue([video(5, '/data/__TV/Lessons/Season 2026/S2026E01 - A [yt5].mp4')]);

    const detail = await getFolderDetail('TV');

    expect(detail.titleShows).toEqual([{ id: 7, name: 'Lessons', channelId: 'UC9', channelName: 'Show Owner', episodeCount: 1 }]);
  });

  test('takes the example path from the folder as it is spelled on disk', async () => {
    Video.findAll.mockResolvedValue([
      video(9, '/data/__kids/Blippi/Blippi - Title 9 [yt9].mp4', { last_downloaded_at: new Date('2026-10-01') }),
    ]);

    const detail = await getFolderDetail('Kids');

    expect(detail.example.relativePath).toBe('Blippi/Blippi - Title 9 [yt9].mp4');
  });

  test('reads the main folder when the downloads path ends with a separator', async () => {
    configModule.directoryPath = '/data/';
    const rows = [video(4, '/data/Chan/c [yt4].mp4', { last_downloaded_at: new Date('2026-09-15') })];
    Video.findAll.mockImplementation(async ({ where }) => {
      const prefixes = where[Op.or].map((clause) => Object.values(clause)[0][Op.startsWith]);
      return rows.filter((row) => prefixes.some((prefix) => (row.filePath || '').startsWith(prefix)));
    });

    try {
      const detail = await getFolderDetail('~main');

      expect(detail.example).toMatchObject({ youtubeId: 'yt4', relativePath: 'Chan/c [yt4].mp4' });
    } finally {
      configModule.directoryPath = '/data';
    }
  });

  test('has no example without downloads', async () => {
    Video.findAll.mockResolvedValue([]);

    await expect(getFolderDetail('Kids')).resolves.toMatchObject({ example: null });
  });
});
