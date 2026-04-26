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
jest.mock('../youtubeApi', () => ({
  isAvailable: jest.fn(() => false),
  getApiKey: jest.fn(() => null),
  client: {
    searchVideos: jest.fn(),
  },
  YoutubeApiErrorCode: { QUOTA_EXCEEDED: 'QUOTA_EXCEEDED' },
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

  test('throws SearchTimeoutError when ytDlpRunner rejects with YTDLP_TIMEOUT code', async () => {
    const timeoutErr = Object.assign(new Error('yt-dlp process timed out after 60000ms'), { code: 'YTDLP_TIMEOUT' });
    ytDlpRunner.run.mockRejectedValueOnce(timeoutErr);

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
        attributes: expect.arrayContaining([
          'id',
          'youtubeId',
          'removed',
          'filePath',
          'fileSize',
          'audioFilePath',
          'audioFileSize',
          'last_downloaded_at',
          'protected',
          'normalized_rating',
          'rating_source',
        ]),
      }));
    });

    test('attaches file paths, sizes, rating, protection, and addedAt for downloaded results', async () => {
      const downloadedAt = new Date('2025-07-02T12:34:56.000Z');
      Video.findAll.mockResolvedValueOnce([
        {
          id: 42,
          youtubeId: 'aaaaaaaaaaa',
          removed: false,
          filePath: '/usr/src/app/data/chan/video.mp4',
          fileSize: 1234567,
          audioFilePath: null,
          audioFileSize: null,
          last_downloaded_at: downloadedAt,
          protected: true,
          normalized_rating: 'PG-13',
          rating_source: 'yt-dlp',
        },
      ]);

      const ndjson = JSON.stringify({ id: 'aaaaaaaaaaa', title: 'A' }) + '\n';
      ytDlpRunner.run.mockResolvedValueOnce(ndjson);

      const [result] = await videoSearchModule.searchVideos('test', 10, {});
      expect(result).toMatchObject({
        youtubeId: 'aaaaaaaaaaa',
        status: 'downloaded',
        databaseId: 42,
        filePath: '/usr/src/app/data/chan/video.mp4',
        fileSize: 1234567,
        audioFilePath: null,
        audioFileSize: null,
        addedAt: downloadedAt.toISOString(),
        isProtected: true,
        normalizedRating: 'PG-13',
        ratingSource: 'yt-dlp',
      });
    });

    test('leaves enrichment fields absent on never_downloaded results', async () => {
      Video.findAll.mockResolvedValueOnce([]);
      const ndjson = JSON.stringify({ id: 'aaaaaaaaaaa', title: 'A' }) + '\n';
      ytDlpRunner.run.mockResolvedValueOnce(ndjson);

      const [result] = await videoSearchModule.searchVideos('test', 10, {});
      expect(result.status).toBe('never_downloaded');
      expect(result.databaseId).toBeUndefined();
      expect(result.filePath).toBeUndefined();
      expect(result.addedAt).toBeUndefined();
    });

    test('addedAt is null when last_downloaded_at is missing on the record', async () => {
      Video.findAll.mockResolvedValueOnce([
        {
          id: 1,
          youtubeId: 'aaaaaaaaaaa',
          removed: false,
          filePath: '/data/video.mp4',
          fileSize: 100,
          audioFilePath: null,
          audioFileSize: null,
          last_downloaded_at: null,
          protected: false,
          normalized_rating: null,
          rating_source: null,
        },
      ]);
      const ndjson = JSON.stringify({ id: 'aaaaaaaaaaa', title: 'A' }) + '\n';
      ytDlpRunner.run.mockResolvedValueOnce(ndjson);

      const [result] = await videoSearchModule.searchVideos('test', 10, {});
      expect(result.addedAt).toBeNull();
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

describe('videoSearchModule.searchVideos - API-first path', () => {
  let videoSearchModule;
  let youtubeApi;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.doMock('../youtubeApi', () => ({
      isAvailable: jest.fn(() => true),
      getApiKey: jest.fn(() => 'test-key'),
      client: {
        searchVideos: jest.fn(),
      },
      YoutubeApiErrorCode: { QUOTA_EXCEEDED: 'QUOTA_EXCEEDED', CANCELED: 'CANCELED' },
    }));

    jest.doMock('../ytDlpRunner', () => ({
      run: jest.fn(),
    }));
    jest.doMock('../download/ytdlpCommandBuilder', () => ({
      buildSearchArgs: jest.fn(() => ['--some-arg']),
    }));
    jest.doMock('../configModule', () => ({ getCookiesPath: jest.fn(() => null) }));
    jest.doMock('../../models', () => ({
      Video: { findAll: jest.fn().mockResolvedValue([]) },
    }));
    jest.doMock('../../logger', () => ({
      info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn(),
    }));

    youtubeApi = require('../youtubeApi');
    videoSearchModule = require('../videoSearchModule');
  });

  test('uses API when available; yt-dlp is not called', async () => {
    const ytDlpRunner = require('../ytDlpRunner');
    youtubeApi.client.searchVideos.mockResolvedValueOnce([
      {
        youtubeId: 'abc',
        title: 'T',
        channelName: 'C',
        channelId: 'UCxxx',
        duration: null,
        thumbnailUrl: 'u',
        publishedAt: '2024-01-01T00:00:00.000Z',
        viewCount: null,
        status: 'never_downloaded',
      },
    ]);

    const results = await videoSearchModule.searchVideos('test', 10);

    expect(results).toHaveLength(1);
    expect(results[0].youtubeId).toBe('abc');
    expect(ytDlpRunner.run).not.toHaveBeenCalled();
    expect(youtubeApi.client.searchVideos).toHaveBeenCalledWith('test-key', 'test', 10, { signal: undefined });
  });

  test('falls back to yt-dlp when API throws, logs warn', async () => {
    const ytDlpRunner = require('../ytDlpRunner');
    const apiErr = new Error('boom');
    apiErr.name = 'YoutubeApiError';
    apiErr.code = 'QUOTA_EXCEEDED';
    youtubeApi.client.searchVideos.mockRejectedValueOnce(apiErr);

    ytDlpRunner.run.mockResolvedValueOnce(
      JSON.stringify({ id: 'ytdlp-id', title: 'from yt-dlp', channel: 'C', upload_date: '20240101' }) + '\n'
    );
    const logger = require('../../logger');

    const results = await videoSearchModule.searchVideos('q', 10);

    expect(youtubeApi.client.searchVideos).toHaveBeenCalledTimes(1);
    expect(ytDlpRunner.run).toHaveBeenCalledTimes(1);
    expect(results[0].youtubeId).toBe('ytdlp-id');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'QUOTA_EXCEEDED' }),
      expect.stringContaining('falling back to yt-dlp')
    );
  });

  test('throws SearchCanceledError when API search is canceled instead of falling back', async () => {
    const ytDlpRunner = require('../ytDlpRunner');
    const controller = new AbortController();
    const apiErr = new Error('canceled');
    apiErr.name = 'YoutubeApiError';
    apiErr.code = 'CANCELED';
    youtubeApi.client.searchVideos.mockRejectedValueOnce(apiErr);

    await expect(
      videoSearchModule.searchVideos('q', 10, { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'SearchCanceledError' });

    expect(youtubeApi.client.searchVideos).toHaveBeenCalledWith(
      'test-key',
      'q',
      10,
      { signal: controller.signal }
    );
    expect(ytDlpRunner.run).not.toHaveBeenCalled();
  });

  test('does not call API when key is unavailable', async () => {
    youtubeApi.isAvailable.mockReturnValue(false);
    const ytDlpRunner = require('../ytDlpRunner');
    ytDlpRunner.run.mockResolvedValueOnce('');

    await videoSearchModule.searchVideos('q', 10);

    expect(youtubeApi.client.searchVideos).not.toHaveBeenCalled();
  });
});
