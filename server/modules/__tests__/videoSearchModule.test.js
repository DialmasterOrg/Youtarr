jest.mock('../ytDlpRunner', () => ({ run: jest.fn() }));
jest.mock('../download/ytdlpCommandBuilder', () => ({
  buildSearchArgs: jest.fn((q, c) => ['--flat-playlist', '--dump-json', `ytsearch${c}:${q}`]),
}));
jest.mock('../../models', () => ({
  Video: { findAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  child: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}));

describe('videoSearchModule', () => {
  let videoSearchModule;
  let ytDlpRunner;
  let ytdlpCommandBuilder;
  let Video;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    videoSearchModule = require('../videoSearchModule');
    ytDlpRunner = require('../ytDlpRunner');
    ytdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
    Video = require('../../models').Video;
  });

  test('parses NDJSON yt-dlp output into normalized search results', async () => {
    const ndjson = JSON.stringify({
      id: 'aaaaaaaaaaa',
      title: 'Minecraft Lets Play',
      channel: 'TestChannel',
      channel_id: 'UC123',
      duration: 600,
      thumbnails: [{ url: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg' }],
      view_count: 1000,
      timestamp: 1700000000,
    }) + '\n';

    ytDlpRunner.run.mockResolvedValueOnce(ndjson);

    const results = await videoSearchModule.searchVideos('Minecraft', 25, {});
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      youtubeId: 'aaaaaaaaaaa',
      title: 'Minecraft Lets Play',
      channelName: 'TestChannel',
      channelId: 'UC123',
      duration: 600,
      thumbnailUrl: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg',
      viewCount: 1000,
      status: 'never_downloaded',
    });
    expect(typeof results[0].publishedAt).toBe('string');
  });

  test('calls buildSearchArgs with query and count', async () => {
    ytDlpRunner.run.mockResolvedValueOnce('');

    await videoSearchModule.searchVideos('hello "world"', 10, {});

    expect(ytdlpCommandBuilder.buildSearchArgs).toHaveBeenCalledWith('hello "world"', 10);
  });

  test('skips blank lines and lines that fail to parse', async () => {
    const ndjson = '\nnot-json\n' + JSON.stringify({ id: 'bbbbbbbbbbb', title: 'OK' }) + '\n';
    ytDlpRunner.run.mockResolvedValueOnce(ndjson);

    const results = await videoSearchModule.searchVideos('test', 10, {});
    expect(results).toHaveLength(1);
    expect(results[0].youtubeId).toBe('bbbbbbbbbbb');
  });

  test('throws SearchCanceledError when ytDlpRunner rejects with AbortError', async () => {
    const abortErr = Object.assign(new Error('yt-dlp run aborted'), { name: 'AbortError', code: 'ABORT_ERR' });
    ytDlpRunner.run.mockRejectedValueOnce(abortErr);

    const controller = new AbortController();
    controller.abort();

    await expect(
      videoSearchModule.searchVideos('test', 10, { signal: controller.signal })
    ).rejects.toBeInstanceOf(videoSearchModule.SearchCanceledError);
  });

  test('throws SearchTimeoutError when ytDlpRunner rejects with timeout message', async () => {
    ytDlpRunner.run.mockRejectedValueOnce(new Error('yt-dlp process timed out after 60000ms'));

    await expect(
      videoSearchModule.searchVideos('test', 10, {})
    ).rejects.toBeInstanceOf(videoSearchModule.SearchTimeoutError);
  });

  describe('local status cross-reference', () => {
    test('marks results as downloaded, missing, or never_downloaded based on DB state', async () => {
      Video.findAll.mockResolvedValueOnce([
        { youtubeId: 'aaaaaaaaaaa', removed: false },
        { youtubeId: 'bbbbbbbbbbb', removed: true },
      ]);

      const ndjson =
        JSON.stringify({ id: 'aaaaaaaaaaa', title: 'A' }) + '\n' +
        JSON.stringify({ id: 'bbbbbbbbbbb', title: 'B' }) + '\n' +
        JSON.stringify({ id: 'ccccccccccc', title: 'C' }) + '\n';
      ytDlpRunner.run.mockResolvedValueOnce(ndjson);

      const results = await videoSearchModule.searchVideos('test', 10, {});
      expect(results.find(r => r.youtubeId === 'aaaaaaaaaaa').status).toBe('downloaded');
      expect(results.find(r => r.youtubeId === 'bbbbbbbbbbb').status).toBe('missing');
      expect(results.find(r => r.youtubeId === 'ccccccccccc').status).toBe('never_downloaded');
      expect(Video.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ youtubeId: ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'] }),
        attributes: ['youtubeId', 'removed'],
      }));
    });
  });

  describe('publishedAt derivation', () => {
    test('uses timestamp when present', async () => {
      const ndjson = JSON.stringify({ id: 'a', title: 'A', timestamp: 1_700_000_000 }) + '\n';
      ytDlpRunner.run.mockResolvedValueOnce(ndjson);

      const [result] = await videoSearchModule.searchVideos('t', 10, {});
      expect(result.publishedAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
    });

    test('falls back to release_timestamp when timestamp is missing', async () => {
      const ndjson = JSON.stringify({ id: 'a', title: 'A', release_timestamp: 1_600_000_000 }) + '\n';
      ytDlpRunner.run.mockResolvedValueOnce(ndjson);

      const [result] = await videoSearchModule.searchVideos('t', 10, {});
      expect(result.publishedAt).toBe(new Date(1_600_000_000 * 1000).toISOString());
    });

    test('falls back to upload_date (YYYYMMDD) when timestamps are missing', async () => {
      const ndjson = JSON.stringify({ id: 'a', title: 'A', upload_date: '20250702' }) + '\n';
      ytDlpRunner.run.mockResolvedValueOnce(ndjson);

      const [result] = await videoSearchModule.searchVideos('t', 10, {});
      expect(result.publishedAt).toBe('2025-07-02T00:00:00.000Z');
    });

    test('is null when no date fields are present', async () => {
      const ndjson = JSON.stringify({ id: 'a', title: 'A' }) + '\n';
      ytDlpRunner.run.mockResolvedValueOnce(ndjson);

      const [result] = await videoSearchModule.searchVideos('t', 10, {});
      expect(result.publishedAt).toBeNull();
    });
  });

  describe('sorting', () => {
    test('sorts results newest-to-oldest by publishedAt, with nulls last', async () => {
      const ndjson =
        JSON.stringify({ id: 'old', title: 'Old', timestamp: 1_600_000_000 }) + '\n' +
        JSON.stringify({ id: 'nodate', title: 'NoDate' }) + '\n' +
        JSON.stringify({ id: 'new', title: 'New', timestamp: 1_700_000_000 }) + '\n' +
        JSON.stringify({ id: 'mid', title: 'Mid', timestamp: 1_650_000_000 }) + '\n';
      ytDlpRunner.run.mockResolvedValueOnce(ndjson);

      const results = await videoSearchModule.searchVideos('test', 10, {});
      expect(results.map(r => r.youtubeId)).toEqual(['new', 'mid', 'old', 'nodate']);
    });
  });
});
