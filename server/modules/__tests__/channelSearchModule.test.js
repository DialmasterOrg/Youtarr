jest.mock('../ytDlpRunner', () => ({ run: jest.fn() }));
jest.mock('../download/ytdlpCommandBuilder', () => ({
  buildChannelSearchArgs: jest.fn((q, c) => ['--flat-playlist', '--dump-json', `url:${q}:${c}`]),
}));
jest.mock('../../models', () => ({
  Channel: { findAll: jest.fn().mockResolvedValue([]) },
}));
jest.mock('../../logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  child: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}));
jest.mock('../youtubeApi', () => ({
  isAvailable: jest.fn(() => false),
  getApiKey: jest.fn(() => null),
  client: {
    searchChannels: jest.fn(),
  },
  YoutubeApiErrorCode: { QUOTA_EXCEEDED: 'QUOTA_EXCEEDED', CANCELED: 'CANCELED' },
}));

describe('channelSearchModule', () => {
  let channelSearchModule;
  let ytDlpRunner;
  let ytdlpCommandBuilder;
  let youtubeApi;
  let Channel;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    channelSearchModule = require('../channelSearchModule');
    ytDlpRunner = require('../ytDlpRunner');
    ytdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
    youtubeApi = require('../youtubeApi');
    Channel = require('../../models').Channel;
  });

  const ndjsonEntry = (overrides = {}) => JSON.stringify({
    _type: 'url',
    id: 'UCaaaaaaaaaaaaaaaaaaaaaa',
    channel_id: 'UCaaaaaaaaaaaaaaaaaaaaaa',
    channel: 'Alpha Channel',
    title: 'Alpha Channel',
    uploader: 'Alpha Channel',
    uploader_id: '@alpha',
    channel_follower_count: 2420000,
    description: 'A channel about alpha things',
    thumbnails: [
      { url: '//yt3.ggpht.com/small=s88', height: 88, width: 88 },
      { url: '//yt3.ggpht.com/large=s176', height: 176, width: 176 },
    ],
    playlist_count: null,
    ...overrides,
  });

  test('parses NDJSON into normalized results with url and https-prefixed thumbnail', async () => {
    ytDlpRunner.run.mockResolvedValueOnce(ndjsonEntry() + '\n');

    const results = await channelSearchModule.searchChannels('alpha', 25, {});

    expect(results).toEqual([{
      channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
      name: 'Alpha Channel',
      handle: '@alpha',
      url: 'https://www.youtube.com/channel/UCaaaaaaaaaaaaaaaaaaaaaa',
      thumbnailUrl: 'https://yt3.ggpht.com/large=s176',
      subscriberCount: 2420000,
      videoCount: null,
      description: 'A channel about alpha things',
      subscribed: false,
    }]);
  });

  test('calls buildChannelSearchArgs with query and count', async () => {
    ytDlpRunner.run.mockResolvedValueOnce('');

    await channelSearchModule.searchChannels('hello "world"', 10, {});

    expect(ytdlpCommandBuilder.buildChannelSearchArgs).toHaveBeenCalledWith('hello "world"', 10);
  });

  test('rejects counts outside ALLOWED_COUNTS', async () => {
    await expect(channelSearchModule.searchChannels('x', 7, {})).rejects.toThrow(/count must be one of/);
    expect(ytDlpRunner.run).not.toHaveBeenCalled();
  });

  test('skips blank lines, unparseable lines, and entries without a channelId; dedupes', async () => {
    const stdout = '\nnot-json\n'
      + ndjsonEntry() + '\n'
      + ndjsonEntry() + '\n'
      + JSON.stringify({ title: 'No id here' }) + '\n';
    ytDlpRunner.run.mockResolvedValueOnce(stdout);

    const results = await channelSearchModule.searchChannels('alpha', 10, {});

    expect(results).toHaveLength(1);
  });

  test('non-@ uploader_id and non-numeric follower count normalize to null', async () => {
    ytDlpRunner.run.mockResolvedValueOnce(ndjsonEntry({
      uploader_id: 'legacyName',
      channel_follower_count: null,
    }) + '\n');

    const results = await channelSearchModule.searchChannels('alpha', 10, {});

    expect(results[0].handle).toBeNull();
    expect(results[0].subscriberCount).toBeNull();
  });

  test('throws SearchCanceledError when ytDlpRunner rejects with AbortError', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError', code: 'ABORT_ERR' });
    ytDlpRunner.run.mockRejectedValueOnce(abortErr);

    await expect(
      channelSearchModule.searchChannels('x', 10, {})
    ).rejects.toBeInstanceOf(channelSearchModule.SearchCanceledError);
  });

  test('throws SearchTimeoutError when ytDlpRunner rejects with YTDLP_TIMEOUT', async () => {
    const timeoutErr = Object.assign(new Error('timed out'), { code: 'YTDLP_TIMEOUT' });
    ytDlpRunner.run.mockRejectedValueOnce(timeoutErr);

    await expect(
      channelSearchModule.searchChannels('x', 10, {})
    ).rejects.toBeInstanceOf(channelSearchModule.SearchTimeoutError);
  });

  test('stamps subscribed=true only for enabled Channel rows', async () => {
    Channel.findAll.mockResolvedValueOnce([{ channel_id: 'UCaaaaaaaaaaaaaaaaaaaaaa' }]);
    ytDlpRunner.run.mockResolvedValueOnce(
      ndjsonEntry() + '\n' + ndjsonEntry({ id: 'UCbbbbbbbbbbbbbbbbbbbbbb', channel_id: 'UCbbbbbbbbbbbbbbbbbbbbbb' }) + '\n'
    );

    const results = await channelSearchModule.searchChannels('alpha', 10, {});

    expect(Channel.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ enabled: true }),
    }));
    expect(results.find((r) => r.channelId === 'UCaaaaaaaaaaaaaaaaaaaaaa').subscribed).toBe(true);
    expect(results.find((r) => r.channelId === 'UCbbbbbbbbbbbbbbbbbbbbbb').subscribed).toBe(false);
  });

  describe('YouTube API path', () => {
    test('uses client.searchChannels when the API is available', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      youtubeApi.client.searchChannels.mockResolvedValueOnce([{
        channelId: 'UCapi',
        name: 'Api Channel',
        handle: '@api',
        thumbnailUrl: 'https://yt3.ggpht.com/api',
        description: 'from api',
        subscriberCount: 10,
        videoCount: 2,
      }]);

      const results = await channelSearchModule.searchChannels('api', 10, {});

      expect(ytDlpRunner.run).not.toHaveBeenCalled();
      expect(results[0]).toMatchObject({
        channelId: 'UCapi',
        url: 'https://www.youtube.com/channel/UCapi',
        videoCount: 2,
        subscribed: false,
      });
    });

    test('falls back to yt-dlp when the API call fails', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      youtubeApi.client.searchChannels.mockRejectedValueOnce(
        Object.assign(new Error('quota'), { code: 'QUOTA_EXCEEDED' })
      );
      ytDlpRunner.run.mockResolvedValueOnce(ndjsonEntry() + '\n');

      const results = await channelSearchModule.searchChannels('alpha', 10, {});

      expect(ytDlpRunner.run).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    test('propagates cancel from the API path as SearchCanceledError', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.getApiKey.mockReturnValue('key');
      youtubeApi.client.searchChannels.mockRejectedValueOnce(
        Object.assign(new Error('canceled'), { code: 'CANCELED' })
      );

      await expect(
        channelSearchModule.searchChannels('alpha', 10, {})
      ).rejects.toBeInstanceOf(channelSearchModule.SearchCanceledError);
      expect(ytDlpRunner.run).not.toHaveBeenCalled();
    });
  });
});
