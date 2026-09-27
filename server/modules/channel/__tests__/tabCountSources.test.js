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
const BOT_CHECK = Object.assign(new Error('bot'), { code: 'COOKIES_REQUIRED' });
const RATE_LIMITED = new Error('ERROR: [youtube:tab] UULFx: Unable to download webpage: HTTP Error 429: Too Many Requests');

describe('tabCountSources', () => {
  let tabCountSources;
  let youtubeApi;
  let ytDlpRunner;
  let YtdlpCommandBuilder;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    youtubeApi = require('../../youtubeApi');
    ytDlpRunner = require('../../ytDlpRunner');
    YtdlpCommandBuilder = require('../../download/ytdlpCommandBuilder');
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

  describe('fetchCountsViaApi', () => {
    test('returns the API counts when a key is available', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.client.getPlaylistItemCounts.mockResolvedValue(new Map([['UULFx', 449]]));

      expect(await tabCountSources.fetchCountsViaApi(['UULFx'])).toEqual(new Map([['UULFx', 449]]));
    });

    test('returns null without an API key', async () => {
      expect(await tabCountSources.fetchCountsViaApi(['UULFx'])).toBeNull();
    });

    test('returns null when the API call fails', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);
      youtubeApi.client.getPlaylistItemCounts.mockRejectedValue(Object.assign(new Error('x'), { code: 'QUOTA_EXCEEDED' }));

      expect(await tabCountSources.fetchCountsViaApi(['UULFx'])).toBeNull();
    });

    test('does not call the API when there is nothing to look up', async () => {
      youtubeApi.isAvailable.mockReturnValue(true);

      await tabCountSources.fetchCountsViaApi([]);

      expect(youtubeApi.client.getPlaylistItemCounts).not.toHaveBeenCalled();
    });
  });

  describe('fetchCountsViaYtdlp', () => {
    test('reads playlist_count from yt-dlp', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 449, entries: [] }));

      const { counts } = await tabCountSources.fetchCountsViaYtdlp(['UULFx']);

      expect(counts.get('UULFx')).toBe(449);
    });

    test('sends cookies without the request sleep', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 1 }));

      await tabCountSources.fetchCountsViaYtdlp(['UULFx']);

      expect(YtdlpCommandBuilder.buildMetadataFetchArgs).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cookiesEnabled: true, skipSleepRequests: true })
      );
    });

    test('treats a playlist that does not exist as 0', async () => {
      ytDlpRunner.run.mockRejectedValue(new Error('ERROR: [youtube:tab] UULVx: YouTube said: The playlist does not exist.'));

      const { counts } = await tabCountSources.fetchCountsViaYtdlp(['UULVx']);

      expect(counts.get('UULVx')).toBe(0);
    });

    test('leaves out a playlist whose lookup failed', async () => {
      ytDlpRunner.run.mockRejectedValue(Object.assign(new Error('timed out'), { code: 'YTDLP_TIMEOUT' }));

      const { counts } = await tabCountSources.fetchCountsViaYtdlp(['UULFx']);

      expect(counts.has('UULFx')).toBe(false);
    });

    test('leaves out a playlist whose playlist_count is null', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: null }));

      const { counts } = await tabCountSources.fetchCountsViaYtdlp(['UULFx']);

      expect(counts.has('UULFx')).toBe(false);
    });

    test('leaves out a playlist whose playlist_count is blank', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: '' }));

      const { counts } = await tabCountSources.fetchCountsViaYtdlp(['UULFx']);

      expect(counts.has('UULFx')).toBe(false);
    });

    test('leaves out a playlist when yt-dlp prints no count', async () => {
      ytDlpRunner.run.mockResolvedValue('null');

      const { counts } = await tabCountSources.fetchCountsViaYtdlp(['UULFx']);

      expect(counts.has('UULFx')).toBe(false);
    });

    test('stops starting lookups after a bot check', async () => {
      ytDlpRunner.run.mockRejectedValue(BOT_CHECK);

      await tabCountSources.fetchCountsViaYtdlp(['UULF1', 'UULF2', 'UULF3', 'UULF4']);

      expect(ytDlpRunner.run).toHaveBeenCalledTimes(2);
    });

    test('reports a bot check as a throttle', async () => {
      ytDlpRunner.run.mockRejectedValue(BOT_CHECK);

      const { throttle } = await tabCountSources.fetchCountsViaYtdlp(['UULF1']);

      expect(throttle).toBe('bot-check');
    });

    test('reports an HTTP 429 as a throttle', async () => {
      ytDlpRunner.run.mockRejectedValue(RATE_LIMITED);

      const { throttle } = await tabCountSources.fetchCountsViaYtdlp(['UULF1']);

      expect(throttle).toBe('rate-limit');
    });

    test('reports no throttle for an ordinary failure', async () => {
      ytDlpRunner.run.mockRejectedValue(new Error('network unreachable'));

      const { throttle } = await tabCountSources.fetchCountsViaYtdlp(['UULF1']);

      expect(throttle).toBeNull();
    });
  });

  describe('lookupChannelsPaced', () => {
    const plan = (...playlistIds) => ({ tabs: playlistIds.map((playlistId) => ({ playlistId })) });
    const hooks = () => ({ onChannelStart: jest.fn(), onChannelDone: jest.fn() });

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const runPaced = async (plans, callbacks) => {
      const run = tabCountSources.lookupChannelsPaced(plans, callbacks);
      await jest.runAllTimersAsync();
      return run;
    };

    test('sends no cookies and keeps the request sleep', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 1 }));

      await runPaced([plan('UULF1')], hooks());

      expect(YtdlpCommandBuilder.buildMetadataFetchArgs).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cookiesEnabled: false, skipSleepRequests: false })
      );
    });

    test('waits between lookups', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 1 }));
      const run = tabCountSources.lookupChannelsPaced([plan('UULF1', 'UUSH1')], hooks());

      await jest.advanceTimersByTimeAsync(2999);
      const callsBeforeDelay = ytDlpRunner.run.mock.calls.length;
      await jest.advanceTimersByTimeAsync(1);
      await run;

      expect([callsBeforeDelay, ytDlpRunner.run.mock.calls.length]).toEqual([1, 2]);
    });

    test('hands back each channel before looking up the next one', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 5 }));
      const callbacks = hooks();
      const lookupsWhenDone = [];
      callbacks.onChannelDone.mockImplementation(() => { lookupsWhenDone.push(ytDlpRunner.run.mock.calls.length); });

      await runPaced([plan('UULF1'), plan('UULF2')], callbacks);

      expect(lookupsWhenDone).toEqual([1, 2]);
    });

    test('passes the counted tabs to onChannelDone', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 5 }));
      const callbacks = hooks();
      const first = plan('UULF1');

      await runPaced([first], callbacks);

      expect(callbacks.onChannelDone).toHaveBeenCalledWith(first, new Map([['UULF1', 5]]));
    });

    test('starts each channel before its first lookup', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 5 }));
      const callbacks = hooks();
      let lookupsAtStart = null;
      callbacks.onChannelStart.mockImplementation(() => { lookupsAtStart = ytDlpRunner.run.mock.calls.length; });

      await runPaced([plan('UULF1')], callbacks);

      expect(lookupsAtStart).toBe(0);
    });

    test('stops at a bot check', async () => {
      ytDlpRunner.run.mockRejectedValue(BOT_CHECK);

      const result = await runPaced([plan('UULF1', 'UUSH1'), plan('UULF2')], hooks());

      expect([result.stopReason, ytDlpRunner.run.mock.calls.length]).toEqual(['bot-check', 1]);
    });

    test('still hands back the channel it stopped at', async () => {
      ytDlpRunner.run.mockRejectedValue(RATE_LIMITED);
      const callbacks = hooks();
      const first = plan('UULF1');

      await runPaced([first, plan('UULF2')], callbacks);

      expect(callbacks.onChannelDone.mock.calls).toEqual([[first, new Map()]]);
    });

    test('stops at a "try again later" response', async () => {
      ytDlpRunner.run.mockRejectedValue(new Error('ERROR: This content isn\'t available, try again later.'));

      const result = await runPaced([plan('UULF1'), plan('UULF2')], hooks());

      expect(result.stopReason).toBe('rate-limit');
    });

    test('stops before the next lookup once shouldStop says so', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 1 }));
      const callbacks = { ...hooks(), shouldStop: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true) };

      const result = await runPaced([plan('UULF1', 'UUSH1'), plan('UULF2')], callbacks);

      expect([result.stopReason, ytDlpRunner.run.mock.calls.length]).toEqual(['paused', 1]);
    });

    test('hands back the tabs counted before the stop', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 3 }));
      const callbacks = { ...hooks(), shouldStop: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true) };
      const first = plan('UULF1', 'UUSH1');

      await runPaced([first, plan('UULF2')], callbacks);

      expect(callbacks.onChannelDone.mock.calls).toEqual([[first, new Map([['UULF1', 3]])]]);
    });

    test('does not start a channel it stopped before looking up', async () => {
      ytDlpRunner.run.mockResolvedValue(JSON.stringify({ playlist_count: 1 }));
      const callbacks = { ...hooks(), shouldStop: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true) };

      await runPaced([plan('UULF1'), plan('UULF2')], callbacks);

      expect([callbacks.onChannelStart.mock.calls.length, callbacks.onChannelDone.mock.calls.length]).toEqual([1, 1]);
    });

    test('stops after three unexplained failures in a row', async () => {
      ytDlpRunner.run.mockRejectedValue(Object.assign(new Error('timed out'), { code: 'YTDLP_TIMEOUT' }));

      const result = await runPaced([plan('UULF1'), plan('UULF2'), plan('UULF3'), plan('UULF4')], hooks());

      expect([result.stopReason, ytDlpRunner.run.mock.calls.length]).toEqual(['failures', 3]);
    });

    test('does not count unavailable channels toward the failure streak', async () => {
      ytDlpRunner.run.mockRejectedValue(new Error('ERROR: This account has been terminated'));

      const result = await runPaced([plan('UULF1'), plan('UULF2'), plan('UULF3'), plan('UULF4')], hooks());

      expect([result.stopReason, ytDlpRunner.run.mock.calls.length]).toEqual([null, 4]);
    });

    test('resets the failure streak after a successful lookup', async () => {
      const timeout = Object.assign(new Error('timed out'), { code: 'YTDLP_TIMEOUT' });
      ytDlpRunner.run
        .mockRejectedValueOnce(timeout)
        .mockRejectedValueOnce(timeout)
        .mockResolvedValueOnce(JSON.stringify({ playlist_count: 1 }))
        .mockRejectedValueOnce(timeout)
        .mockRejectedValueOnce(timeout);

      const result = await runPaced([1, 2, 3, 4, 5].map((n) => plan(`UULF${n}`)), hooks());

      expect(result.stopReason).toBeNull();
    });
  });
});
