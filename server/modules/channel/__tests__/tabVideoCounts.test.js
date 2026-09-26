/* eslint-env jest */

// Required once, into a `mock`-prefixed const; see mockFactories.js for the rules.
const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../messageEmitter.js', () => ({ emitMessage: jest.fn() }));
jest.mock('../tabCountSources', () => ({
  tabPlaylistId: jest.fn((channelId, tab) => {
    const prefix = { videos: 'UULF', shorts: 'UUSH', streams: 'UULV' }[tab];
    return prefix && /^UC[A-Za-z0-9_-]{22}$/.test(channelId) ? `${prefix}${channelId.slice(2)}` : null;
  }),
  fetchCounts: jest.fn(),
}));

const CHANNEL_ID = 'UCHnyfMqiRRG1u-2MsSQLbXA';
const OTHER_CHANNEL_ID = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const SUFFIX = 'HnyfMqiRRG1u-2MsSQLbXA';
const NOW = Date.parse('2026-09-25T12:00:00.000Z');

const makeChannel = (overrides = {}) => ({
  channel_id: CHANNEL_ID,
  available_tabs: 'videos,shorts',
  hidden_tabs: null,
  terminated_at: null,
  tab_video_counts: null,
  ...overrides,
});

describe('tabVideoCounts', () => {
  let tabVideoCounts;
  let Channel;
  let tabCountSources;
  let MessageEmitter;
  const runRecorder = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Channel = require('../../../models/channel');
    tabCountSources = require('../tabCountSources');
    MessageEmitter = require('../../messageEmitter.js');
    Channel.update.mockResolvedValue([1]);
    tabVideoCounts = require('../tabVideoCounts');
  });

  describe('countableTabs', () => {
    test('leaves out hidden tabs', () => {
      expect(tabVideoCounts.countableTabs(makeChannel({ hidden_tabs: 'shorts' }))).toEqual(['videos']);
    });

    test('returns nothing for a terminated channel', () => {
      expect(tabVideoCounts.countableTabs(makeChannel({ terminated_at: new Date() }))).toEqual([]);
    });

    test('returns nothing for a channel id that is not UC plus 22 characters', () => {
      expect(tabVideoCounts.countableTabs(makeChannel({ channel_id: 'legacy-id' }))).toEqual([]);
    });
  });

  describe('isStale', () => {
    test('is stale when a countable tab has never been counted', () => {
      const channel = makeChannel({
        tab_video_counts: JSON.stringify({ video: { total: 5, fetchedAt: new Date(NOW).toISOString() } }),
      });

      expect(tabVideoCounts.isStale(channel, NOW)).toBe(true);
    });

    test('is fresh when every countable tab was counted within 24 hours', () => {
      const fetchedAt = new Date(NOW - 60 * 60 * 1000).toISOString();
      const channel = makeChannel({
        tab_video_counts: JSON.stringify({ video: { total: 5, fetchedAt }, short: { total: 1, fetchedAt } }),
      });

      expect(tabVideoCounts.isStale(channel, NOW)).toBe(false);
    });

    test('is stale when a count is 24 hours old', () => {
      const fetchedAt = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();
      const channel = makeChannel({
        available_tabs: 'videos',
        tab_video_counts: JSON.stringify({ video: { total: 5, fetchedAt } }),
      });

      expect(tabVideoCounts.isStale(channel, NOW)).toBe(true);
    });
  });

  describe('getStoredCounts', () => {
    test('returns an empty object for unreadable JSON', () => {
      expect(tabVideoCounts.getStoredCounts(makeChannel({ tab_video_counts: '{nope' }))).toEqual({});
    });
  });

  describe('refreshChannel', () => {
    test('writes the counts it looked up', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      tabCountSources.fetchCounts.mockResolvedValue({
        counts: new Map([[`UULF${SUFFIX}`, 449], [`UUSH${SUFFIX}`, 87]]),
        source: 'api',
      });

      await tabVideoCounts.refreshChannel(CHANNEL_ID);

      const written = JSON.parse(Channel.update.mock.calls[0][0].tab_video_counts);
      expect([written.video.total, written.short.total]).toEqual([449, 87]);
    });

    test('keeps counts for tabs it did not look up', async () => {
      const kept = { livestream: { total: 3, fetchedAt: '2026-09-01T00:00:00.000Z' } };
      Channel.findOne.mockResolvedValue(makeChannel({ available_tabs: 'videos', tab_video_counts: JSON.stringify(kept) }));
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map([[`UULF${SUFFIX}`, 10]]), source: 'api' });

      await tabVideoCounts.refreshChannel(CHANNEL_ID);

      const written = JSON.parse(Channel.update.mock.calls[0][0].tab_video_counts);
      expect(written.livestream).toEqual(kept.livestream);
    });

    test('does not write when every lookup failed', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map(), source: 'yt-dlp' });

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect([result.status, Channel.update.mock.calls.length]).toEqual(['failed', 0]);
    });

    test('treats every tab coming back empty as a failure', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      tabCountSources.fetchCounts.mockResolvedValue({
        counts: new Map([[`UULF${SUFFIX}`, 0], [`UUSH${SUFFIX}`, 0]]),
        source: 'yt-dlp',
      });

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect([result.status, Channel.update.mock.calls.length]).toEqual(['failed', 0]);
    });

    test('writes the tabs that succeeded when one lookup failed', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map([[`UULF${SUFFIX}`, 449]]), source: 'yt-dlp' });

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      const written = JSON.parse(Channel.update.mock.calls[0][0].tab_video_counts);
      expect([result.status, written.video.total, written.short]).toEqual(['failed', 449, undefined]);
    });

    test('keeps the saved total of a tab whose lookup failed while another succeeded', async () => {
      const savedShorts = { total: 87, fetchedAt: '2026-09-20T00:00:00.000Z' };
      Channel.findOne.mockResolvedValue(makeChannel({ tab_video_counts: JSON.stringify({ short: savedShorts }) }));
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map([[`UULF${SUFFIX}`, 449]]), source: 'yt-dlp' });

      await tabVideoCounts.refreshChannel(CHANNEL_ID);

      const written = JSON.parse(Channel.update.mock.calls[0][0].tab_video_counts);
      expect(written.short).toEqual(savedShorts);
    });

    test('skips a channel it cannot count', async () => {
      Channel.findOne.mockResolvedValue(makeChannel({ terminated_at: new Date() }));

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect([result.status, tabCountSources.fetchCounts.mock.calls.length]).toEqual(['skipped', 0]);
    });

    test('skips fresh counts when only refreshing stale ones', async () => {
      const fetchedAt = new Date().toISOString();
      Channel.findOne.mockResolvedValue(makeChannel({
        available_tabs: 'videos',
        tab_video_counts: JSON.stringify({ video: { total: 5, fetchedAt } }),
      }));

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID, { onlyIfStale: true });

      expect(result.status).toBe('fresh');
    });

    test('waits an hour after a failure before refreshing on demand again', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map(), source: 'yt-dlp' });
      await tabVideoCounts.refreshChannel(CHANNEL_ID, { onlyIfStale: true });

      const second = await tabVideoCounts.refreshChannel(CHANNEL_ID, { onlyIfStale: true });

      expect([second.status, tabCountSources.fetchCounts.mock.calls.length]).toEqual(['cooldown', 1]);
    });

    test('shares one lookup between overlapping requests for the same channel', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      tabCountSources.fetchCounts.mockResolvedValue({
        counts: new Map([[`UULF${SUFFIX}`, 1], [`UUSH${SUFFIX}`, 1]]),
        source: 'api',
      });

      await Promise.all([tabVideoCounts.refreshChannel(CHANNEL_ID), tabVideoCounts.refreshChannel(CHANNEL_ID)]);

      expect(tabCountSources.fetchCounts).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshAll', () => {
    test('looks up every enabled channel in one batch', async () => {
      Channel.findAll.mockResolvedValue([makeChannel(), makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos' })]);
      Channel.findOne.mockResolvedValue(null);
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map(), source: 'api' });

      await tabVideoCounts.refreshAll();

      expect(tabCountSources.fetchCounts.mock.calls[0][0]).toHaveLength(3);
    });

    test('reports a partial run when some channels failed', async () => {
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos' }),
        makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos' }),
      ]);
      Channel.findOne.mockResolvedValue(null);
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map([[`UULF${SUFFIX}`, 4]]), source: 'yt-dlp' });

      const summary = await tabVideoCounts.refreshAll();

      expect([summary.status, summary.outcome, summary.message])
        .toEqual(['error', 'partial', 'Refreshed video counts for 1 channel; 1 channel failed.']);
    });

    test('tells open Subscriptions pages to reload after refreshing', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      Channel.findOne.mockResolvedValue(null);
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map([[`UULF${SUFFIX}`, 4]]), source: 'api' });

      await tabVideoCounts.refreshAll();

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith('broadcast', null, 'channel', 'channelsUpdated', expect.any(Object));
    });

    test('succeeds with nothing to do when no channel can be counted', async () => {
      Channel.findAll.mockResolvedValue([]);
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map(), source: null });

      const summary = await tabVideoCounts.refreshAll();

      expect([summary.status, summary.outcome]).toEqual(['success', 'completed']);
    });

    test('only looks up stale channels when asked', async () => {
      const fresh = new Date().toISOString();
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos', tab_video_counts: JSON.stringify({ video: { total: 5, fetchedAt: fresh } }) }),
        makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos' }),
      ]);
      Channel.findOne.mockResolvedValue(null);
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map(), source: 'api' });

      await tabVideoCounts.refreshAll({ onlyStale: true });

      expect(tabCountSources.fetchCounts.mock.calls[0][0]).toEqual(['UULFaaaaaaaaaaaaaaaaaaaaaa']);
    });

    test('skips a refresh while another one is running', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      Channel.findOne.mockResolvedValue(null);
      let finish;
      tabCountSources.fetchCounts.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
      const first = tabVideoCounts.refreshAll();
      await new Promise((resolve) => setImmediate(resolve));

      const second = await tabVideoCounts.refreshAll();
      finish({ counts: new Map([[`UULF${SUFFIX}`, 4]]), source: 'api' });
      await first;

      expect([second.status, second.outcome]).toEqual(['skipped', 'skipped']);
    });
  });

  describe('refreshAtStartup', () => {
    test('records the catch-up run with the startup trigger', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      Channel.findOne.mockResolvedValue(null);
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map([[`UULF${SUFFIX}`, 4]]), source: 'api' });

      await tabVideoCounts.refreshAtStartup({ runRecorder });

      expect(runRecorder.record).toHaveBeenCalledWith(expect.objectContaining({
        taskKey: 'channelVideoCountsFrequency',
        trigger: 'startup',
        status: 'success',
      }));
    });

    test('records nothing when every count is current', async () => {
      const fresh = new Date().toISOString();
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos', tab_video_counts: JSON.stringify({ video: { total: 5, fetchedAt: fresh } }) }),
      ]);
      tabCountSources.fetchCounts.mockResolvedValue({ counts: new Map(), source: null });

      await tabVideoCounts.refreshAtStartup({ runRecorder });

      expect(runRecorder.record).not.toHaveBeenCalled();
    });
  });
});
