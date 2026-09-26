/* eslint-env jest */

jest.mock('../../../logger');
jest.mock('../../youtubeApi', () => ({
  isAvailable: jest.fn(() => false),
  getApiKey: jest.fn(() => 'api-key'),
  client: { getPlaylistItemCounts: jest.fn() },
}));
jest.mock('../../ytDlpRunner', () => ({ run: jest.fn() }));
jest.mock('../../download/ytdlpCommandBuilder', () => ({
  buildMetadataFetchArgs: jest.fn((url) => ['--flat-playlist', url]),
}));

const CHANNEL_ID = 'UCHnyfMqiRRG1u-2MsSQLbXA';

describe('tabCountSources', () => {
  let tabCountSources;
  let youtubeApi;
  let ytDlpRunner;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    youtubeApi = require('../../youtubeApi');
    ytDlpRunner = require('../../ytDlpRunner');
    tabCountSources = require('../tabCountSources');
  });

  describe('tabPlaylistId', () => {
    test('swaps UC for the tab prefix', () => {
      expect(tabCountSources.tabPlaylistId(CHANNEL_ID, 'videos')).toBe('UULFHnyfMqiRRG1u-2MsSQLbXA');
    });

    test('returns null for a channel id that is not UC plus 22 characters', () => {
      expect(tabCountSources.tabPlaylistId('HCabc', 'videos')).toBeNull();
    });

    test('returns null for an unknown tab', () => {
      expect(tabCountSources.tabPlaylistId(CHANNEL_ID, 'releases')).toBeNull();
    });
  });

  describe('fetchCounts', () => {
    test('uses the YouTube API when a key is available', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.client.getPlaylistItemCounts.mockResolvedValue(new Map([['UULFx', 449]]));

      const result = await tabCountSources.fetchCounts(['UULFx']);

      expect(result).toEqual({ counts: new Map([['UULFx', 449]]), source: 'api' });
    });

    test('does not run yt-dlp when the API succeeds', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.client.getPlaylistItemCounts.mockResolvedValue(new Map([['UULFx', 449]]));

      await tabCountSources.fetchCounts(['UULFx']);

      expect(ytDlpRunner.run).not.toHaveBeenCalled();
    });

    test('falls back to yt-dlp when the API call fails', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.client.getPlaylistItemCounts.mockRejectedValue(Object.assign(new Error('x'), { code: 'QUOTA_EXCEEDED' }));
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 12 }));

      const result = await tabCountSources.fetchCounts(['UULFx']);

      expect(result).toEqual({ counts: new Map([['UULFx', 12]]), source: 'yt-dlp' });
    });

    test('reads playlist_count from yt-dlp', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 449, entries: [] }));

      const { counts } = await tabCountSources.fetchCounts(['UULFx']);

      expect(counts.get('UULFx')).toBe(449);
    });

    test('treats a playlist that does not exist as 0', async () => {
      ytDlpRunner.run.mockRejectedValue(new Error('ERROR: [youtube:tab] UULVx: YouTube said: The playlist does not exist.'));

      const { counts } = await tabCountSources.fetchCounts(['UULVx']);

      expect(counts.get('UULVx')).toBe(0);
    });

    test('leaves out a playlist whose lookup failed', async () => {
      ytDlpRunner.run.mockRejectedValue(Object.assign(new Error('timed out'), { code: 'YTDLP_TIMEOUT' }));

      const { counts } = await tabCountSources.fetchCounts(['UULFx']);

      expect(counts.has('UULFx')).toBe(false);
    });

    test('leaves out a playlist whose playlist_count is null', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: null }));

      const { counts } = await tabCountSources.fetchCounts(['UULFx']);

      expect(counts.has('UULFx')).toBe(false);
    });

    test('leaves out a playlist whose playlist_count is blank', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: '' }));

      const { counts } = await tabCountSources.fetchCounts(['UULFx']);

      expect(counts.has('UULFx')).toBe(false);
    });

    test('leaves out a playlist when yt-dlp prints no count', async () => {
      ytDlpRunner.run.mockResolvedValue('null');

      const { counts } = await tabCountSources.fetchCounts(['UULFx']);

      expect(counts.has('UULFx')).toBe(false);
    });

    test('stops starting yt-dlp lookups after a bot check', async () => {
      ytDlpRunner.run.mockRejectedValue(Object.assign(new Error('bot'), { code: 'COOKIES_REQUIRED' }));

      await tabCountSources.fetchCounts(['UULF1', 'UULF2', 'UULF3', 'UULF4']);

      expect(ytDlpRunner.run).toHaveBeenCalledTimes(2);
    });

    test('returns no source when there is nothing to look up', async () => {
      const result = await tabCountSources.fetchCounts([]);

      expect(result).toEqual({ counts: new Map(), source: null });
    });
  });
});
