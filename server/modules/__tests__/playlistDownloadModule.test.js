jest.mock('../../logger', () => ({ error: jest.fn() }));
jest.mock('../download/videoActivity', () => ({ isActive: jest.fn(() => false) }));
const playlistDownloads = require('../playlistDownloadModule');
const videoActivity = require('../download/videoActivity');

const baseline = new Date('2026-09-01T00:00:00Z');
const playlist = { playlist_id: 'PL1', auto_download: true, auto_download_baseline_at: baseline, auto_download_baseline_id: 10 };
const rows = [
  { id: 1, youtube_id: 'old', title: 'Older upload', position: 1, published_at: '20200101' },
  { id: 11, youtube_id: 'new', title: 'Newer upload', position: 2, published_at: '20260901' },
];
const dependencies = () => ({
  PlaylistVideo: { findAll: jest.fn().mockResolvedValue(rows), update: jest.fn().mockResolvedValue([1]) },
  Video: { findAll: jest.fn().mockResolvedValue([]) },
  playlistModule: { isUnavailableTitle: (title) => !title || title === '[Private video]' },
  downloadModule: { doPlaylistDownloads: jest.fn().mockResolvedValue(1) },
  logger: { error: jest.fn() },
});

describe('playlistDownloadModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    videoActivity.isActive.mockReturnValue(false);
  });

  test('keeps channel attribution for all download paths', async () => {
    const deps = dependencies();
    deps.PlaylistVideo.findAll.mockResolvedValue([{ ...rows[0], channel_id: 'UCowner', channel_name: 'Owner' }]);
    const { candidates } = await playlistDownloads.getTrackedVideos('PL1', deps);
    expect(candidates).toEqual([expect.objectContaining({ channel_id: 'UCowner', channel_name: 'Owner' })]);
    expect(deps.PlaylistVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
      attributes: expect.arrayContaining(['channel_id', 'channel_name']),
    }));
  });

  test('explicit downloads can override ignored and previously downloaded exclusions', async () => {
    const deps = dependencies();
    deps.PlaylistVideo.findAll.mockResolvedValue([{ ...rows[0], ignored: true }]);
    deps.Video.findAll.mockResolvedValue([{ youtubeId: 'old' }]);
    const { candidates } = await playlistDownloads.getTrackedVideos('PL1', deps, {
      youtubeIds: ['old'], includeIgnored: true, allowRedownload: true,
    });
    expect(deps.PlaylistVideo.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { playlist_id: 'PL1', youtube_id: ['old'] },
    }));
    expect(deps.Video.findAll).not.toHaveBeenCalled();
    expect(candidates).toEqual([expect.objectContaining({ youtube_id: 'old', ignored: true })]);
  });

  test('omits already active videos before preview selection', async () => {
    videoActivity.isActive.mockImplementation((id) => id === 'old');
    const result = await playlistDownloads.getPreview('PL1', { order: 'asc', count: 1 }, dependencies());
    expect(result.selectedIds).toEqual(['new']);
  });

  test('uses the application logger when a request logger is not supplied', async () => {
    const deps = dependencies();
    delete deps.logger;
    const err = new Error('queue unavailable');
    deps.downloadModule.doPlaylistDownloads.mockRejectedValue(err);
    await playlistDownloads.queueBatch(playlist, ['old'], deps);
    expect(require('../../logger').error).toHaveBeenCalledWith({ err, playlist_id: 'PL1', count: 1 }, expect.any(String));
  });
  test('previews publication order independently of playlist position', async () => {
    const result = await playlistDownloads.getPreview('PL1', { order: 'published', count: 1 }, dependencies());
    expect(result).toEqual({
      candidates: rows.map(({ youtube_id, title, position, published_at }) => ({ youtube_id, title, position, published_at })),
      selectedIds: ['new'], missingDates: 0,
    });
  });

  test('excludes unavailable and previously downloaded entries from previews', async () => {
    const deps = dependencies();
    deps.PlaylistVideo.findAll.mockResolvedValue([...rows, { youtube_id: 'private', title: '[Private video]' }]);
    deps.Video.findAll.mockResolvedValue([{ youtubeId: 'old', filePath: null }]);
    const result = await playlistDownloads.getPreview('PL1', { order: 'asc', count: 5 }, deps);
    expect(result.selectedIds).toEqual(['new']);
  });

  test('does not guess publication order when dates are missing', async () => {
    const deps = dependencies();
    deps.PlaylistVideo.findAll.mockResolvedValue([{ ...rows[0], published_at: null }, rows[1]]);
    expect(await playlistDownloads.getPreview('PL1', { order: 'published', count: 1 }, deps))
      .toMatchObject({ selectedIds: [], missingDates: 1 });
  });

  test('counts older entries separately from future discoveries and saved batches', async () => {
    const deps = dependencies();
    deps.PlaylistVideo.findAll.mockResolvedValue([...rows, { ...rows[0], id: 2, youtube_id: 'requested', auto_download_requested: true }]);
    expect(await playlistDownloads.getCounts(playlist, deps)).toEqual({
      not_downloaded_count: 3, following_existing_count: 1, following_requested_count: 1, unsyncable_count: 0,
    });
  });

  test('reports all eligible entries as existing when there is no starting point', async () => {
    expect(await playlistDownloads.getCounts({ ...playlist, auto_download_baseline_at: null }, dependencies()))
      .toMatchObject({ following_existing_count: 2 });
  });

  test('uses the legacy cutoff for playlists upgraded without a baseline id', async () => {
    const deps = dependencies();
    deps.PlaylistVideo.findAll.mockResolvedValue([
      { ...rows[0], added_at: '2026-08-31T00:00:00Z' },
      { ...rows[1], added_at: '2026-09-02T00:00:00Z' },
    ]);
    expect(await playlistDownloads.getCounts({ ...playlist, auto_download_baseline_id: null }, deps))
      .toMatchObject({ following_existing_count: 1 });
  });

  test('queues only eligible selected ids and saves them before queueing', async () => {
    const deps = dependencies();
    deps.downloadModule.doPlaylistDownloads.mockImplementation(async () => {
      expect(deps.PlaylistVideo.update).toHaveBeenCalledWith({ auto_download_requested: true }, {
        where: { playlist_id: 'PL1', youtube_id: ['old'] },
      });
      expect(deps.PlaylistVideo.update).toHaveBeenCalledWith({ auto_download_last_attempt_at: expect.any(Date) }, {
        where: { playlist_id: 'PL1', youtube_id: ['old'], auto_download_requested: true },
      });
      return 1;
    });
    expect(await playlistDownloads.queueBatch(playlist, ['old', 'foreign', 'old'], deps)).toEqual({ queued: 1 });
    expect(deps.downloadModule.doPlaylistDownloads).toHaveBeenCalledWith(playlist, { youtubeIds: ['old'] });
  });

  test('an empty eligible selection never queues download-all', async () => {
    const deps = dependencies();
    expect(await playlistDownloads.queueBatch(playlist, ['foreign'], deps)).toEqual({ queued: 0 });
    expect(deps.downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
  });

  test('the original explicit selection queues in full regardless of the scheduled allowance', async () => {
    const deps = dependencies();
    const selected = Array.from({ length: 1000 }, (_, i) => ({ youtube_id: `video${i}`, title: `Video ${i}` }));
    deps.PlaylistVideo.findAll.mockResolvedValue(selected);
    deps.downloadModule.doPlaylistDownloads.mockResolvedValue(1000);
    const ids = selected.map((row) => row.youtube_id);
    expect(await playlistDownloads.queueBatch(playlist, ids, deps)).toEqual({ queued: 1000 });
    expect(deps.downloadModule.doPlaylistDownloads).toHaveBeenCalledWith(playlist, { youtubeIds: ids });
    expect(deps.PlaylistVideo.update).toHaveBeenCalledWith({ auto_download_last_attempt_at: expect.any(Date) }, {
      where: { playlist_id: 'PL1', youtube_id: ids, auto_download_requested: true },
    });
  });

  test('a queue failure keeps both the saved request and its attempt time', async () => {
    const deps = dependencies();
    const stored = { ...rows[0], auto_download_requested: false, auto_download_last_attempt_at: null };
    deps.PlaylistVideo.findAll.mockResolvedValue([stored]);
    deps.PlaylistVideo.update.mockImplementation(async (values) => { Object.assign(stored, values); return [1]; });
    deps.downloadModule.doPlaylistDownloads.mockRejectedValue(new Error('queue down'));
    await playlistDownloads.queueBatch(playlist, ['old'], deps);
    expect(stored).toMatchObject({ auto_download_requested: true, auto_download_last_attempt_at: expect.any(Date) });
  });

  test('a failed attempt-time write preserves the request for a later bounded retry', async () => {
    const deps = dependencies();
    deps.PlaylistVideo.update.mockResolvedValueOnce([1]).mockRejectedValueOnce(new Error('write failed'));
    const result = await playlistDownloads.queueBatch(playlist, ['old'], deps);
    expect(result).toMatchObject({ queued: 0, warning: expect.stringContaining('will retry') });
    expect(deps.downloadModule.doPlaylistDownloads).not.toHaveBeenCalled();
  });

  test('counts saved selections once even when they are also discoveries', async () => {
    const deps = dependencies();
    deps.PlaylistVideo.findAll.mockResolvedValue([
      { ...rows[0], auto_download_requested: true }, { ...rows[1], auto_download_requested: true },
    ]);
    expect(await playlistDownloads.getCounts(playlist, deps)).toMatchObject({
      following_requested_count: 2, following_existing_count: 0, not_downloaded_count: 2,
    });
  });

  test('only eligible undownloaded selections contribute to the outstanding count', async () => {
    const deps = dependencies();
    deps.PlaylistVideo.findAll.mockResolvedValue([
      { ...rows[0], auto_download_requested: true }, { ...rows[1], auto_download_requested: true },
      { youtube_id: 'private', title: '[Private video]', auto_download_requested: true },
    ]);
    deps.Video.findAll.mockResolvedValue([{ youtubeId: 'old' }]);
    expect(await playlistDownloads.getCounts(playlist, deps)).toMatchObject({ following_requested_count: 1 });
  });

  test('logs a saved batch failure with the error and retry context', async () => {
    const deps = dependencies();
    const err = new Error('queue unavailable');
    deps.downloadModule.doPlaylistDownloads.mockRejectedValue(err);
    expect(await playlistDownloads.queueBatch(playlist, ['old'], deps)).toMatchObject({ queued: 0, warning: expect.stringContaining('will retry') });
    expect(deps.logger.error).toHaveBeenCalledWith({ err, playlist_id: 'PL1', count: 1 }, expect.any(String));
  });

  test.each([
    { auto_download: false, auto_download_baseline_at: baseline },
    { auto_download: true, auto_download_baseline_at: null },
  ])('does not promise retry without active following: %j', async (state) => {
    const deps = dependencies();
    const err = new Error('queue unavailable');
    deps.downloadModule.doPlaylistDownloads.mockRejectedValue(err);
    await expect(playlistDownloads.queueBatch({ ...playlist, ...state }, ['old'], deps)).rejects.toBe(err);
    expect(deps.PlaylistVideo.update).not.toHaveBeenCalled();
  });
});
