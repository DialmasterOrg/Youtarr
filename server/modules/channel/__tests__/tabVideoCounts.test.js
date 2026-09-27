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
  isApiAvailable: jest.fn(() => false),
  fetchCountsViaApi: jest.fn(),
  fetchCountsViaYtdlp: jest.fn(),
  lookupChannelsPaced: jest.fn(),
  STOPPED_AFTER_FAILURES: 'failures',
  STOPPED_BY_PAUSE: 'paused',
}));
jest.mock('../tabCountBackoff', () => ({
  useRunHistory: jest.fn(),
  remainingMs: jest.fn(),
  start: jest.fn(),
  getRevision: jest.fn(),
  clearIfUnchanged: jest.fn(),
  currentDetails: jest.fn(),
  THROTTLED_OUTCOME: 'throttled',
}));

const CHANNEL_ID = 'UCHnyfMqiRRG1u-2MsSQLbXA';
const OTHER_CHANNEL_ID = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const SUFFIX = 'HnyfMqiRRG1u-2MsSQLbXA';
const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const ago = (ms) => new Date(Date.now() - ms).toISOString();
const countedAgo = (ms) => JSON.stringify({ video: { total: 5, fetchedAt: ago(ms) } });
const makeChannelId = (n) => `UC${String(n).padStart(22, '0')}`;
const CARRIED_BACKOFF = {
  backoffScope: 'all',
  backoffMs: 12 * HOUR_MS,
  backoffUntil: '2026-09-25T06:00:00.000Z',
};
const RATE_LIMIT_BACKOFF = {
  backoffReason: 'rate-limit',
  backoffScope: 'all',
  backoffMs: 6 * HOUR_MS,
  backoffUntil: '2026-09-25T18:00:00.000Z',
};

// Stands in for the paced yt-dlp loop: counts each channel's tabs from
// `counts`, handing channels back one by one until `stopAfter` of them.
const pacedLookup = (counts, { stopReason = null, stopAfter = Infinity } = {}) =>
  async (plans, { onChannelStart, onChannelDone }) => {
    for (const plan of plans.slice(0, stopAfter)) {
      await onChannelStart(plan);
      const found = plan.tabs.filter(({ playlistId }) => counts.has(playlistId));
      await onChannelDone(plan, new Map(found.map(({ playlistId }) => [playlistId, counts.get(playlistId)])));
    }
    return { stopReason };
  };

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
  let tabCountBackoff;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    Channel = require('../../../models/channel');
    tabCountSources = require('../tabCountSources');
    MessageEmitter = require('../../messageEmitter.js');
    tabCountBackoff = require('../tabCountBackoff');
    Channel.update.mockResolvedValue([1]);
    tabCountBackoff.remainingMs.mockResolvedValue(0);
    tabCountBackoff.start.mockResolvedValue(RATE_LIMIT_BACKOFF);
    tabCountBackoff.getRevision.mockReturnValue(1);
    tabCountBackoff.currentDetails.mockResolvedValue({});
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
    const useApi = (counts) => {
      tabCountSources.isApiAvailable.mockReturnValue(true);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(counts);
    };
    const useYtdlp = (counts, throttle = null) => {
      tabCountSources.fetchCountsViaYtdlp.mockResolvedValue({ counts, throttle });
    };
    const writtenCounts = () => JSON.parse(
      Channel.update.mock.calls.find(([fields]) => 'tab_video_counts' in fields)[0].tab_video_counts
    );
    const countWrites = () => Channel.update.mock.calls.filter(([fields]) => 'tab_video_counts' in fields).length;

    test('writes the counts it looked up', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      useApi(new Map([[`UULF${SUFFIX}`, 449], [`UUSH${SUFFIX}`, 87]]));

      await tabVideoCounts.refreshChannel(CHANNEL_ID);

      const written = writtenCounts();
      expect([written.video.total, written.short.total]).toEqual([449, 87]);
    });

    test('keeps counts for tabs it did not look up', async () => {
      const kept = { livestream: { total: 3, fetchedAt: '2026-09-01T00:00:00.000Z' } };
      Channel.findOne.mockResolvedValue(makeChannel({ available_tabs: 'videos', tab_video_counts: JSON.stringify(kept) }));
      useApi(new Map([[`UULF${SUFFIX}`, 10]]));

      await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect(writtenCounts().livestream).toEqual(kept.livestream);
    });

    test('falls back to yt-dlp when the API call fails', async () => {
      Channel.findOne.mockResolvedValue(makeChannel({ available_tabs: 'videos' }));
      useApi(null);
      useYtdlp(new Map([[`UULF${SUFFIX}`, 12]]));

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect([result.status, writtenCounts().video.total]).toEqual(['refreshed', 12]);
    });

    test('records the attempt before looking the channel up', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      let attemptRecorded = false;
      tabCountSources.fetchCountsViaYtdlp.mockImplementation(async () => {
        attemptRecorded = Channel.update.mock.calls.some(([fields]) => fields.tab_counts_attempted_at instanceof Date);
        return { counts: new Map(), throttle: null };
      });

      await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect(attemptRecorded).toBe(true);
    });

    test('does not write counts when every lookup failed', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      useYtdlp(new Map());

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect([result.status, countWrites()]).toEqual(['failed', 0]);
    });

    test('treats every tab coming back empty as a failure', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      useYtdlp(new Map([[`UULF${SUFFIX}`, 0], [`UUSH${SUFFIX}`, 0]]));

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect([result.status, countWrites()]).toEqual(['failed', 0]);
    });

    test('writes the tabs that succeeded when one lookup failed', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      useYtdlp(new Map([[`UULF${SUFFIX}`, 449]]));

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      const written = writtenCounts();
      expect([result.status, written.video.total, written.short]).toEqual(['failed', 449, undefined]);
    });

    test('keeps the saved total of a tab whose lookup failed while another succeeded', async () => {
      const savedShorts = { total: 87, fetchedAt: '2026-09-20T00:00:00.000Z' };
      Channel.findOne.mockResolvedValue(makeChannel({ tab_video_counts: JSON.stringify({ short: savedShorts }) }));
      useYtdlp(new Map([[`UULF${SUFFIX}`, 449]]));

      await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect(writtenCounts().short).toEqual(savedShorts);
    });

    test('skips a channel it cannot count', async () => {
      Channel.findOne.mockResolvedValue(makeChannel({ terminated_at: new Date() }));

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect([result.status, tabCountSources.fetchCountsViaYtdlp.mock.calls.length]).toEqual(['skipped', 0]);
    });

    test('skips fresh counts when only refreshing stale ones', async () => {
      Channel.findOne.mockResolvedValue(makeChannel({ available_tabs: 'videos', tab_video_counts: countedAgo(HOUR_MS) }));

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID, { onlyIfStale: true });

      expect(result.status).toBe('fresh');
    });

    test('waits an hour after an attempt before refreshing on demand again', async () => {
      Channel.findOne.mockResolvedValue(makeChannel({ tab_counts_attempted_at: ago(10 * 60 * 1000) }));

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID, { onlyIfStale: true });

      expect([result.status, tabCountSources.fetchCountsViaYtdlp.mock.calls.length]).toEqual(['cooldown', 0]);
    });

    test('refreshes on demand again once the hour has passed', async () => {
      Channel.findOne.mockResolvedValue(makeChannel({ tab_counts_attempted_at: ago(2 * HOUR_MS) }));
      useYtdlp(new Map());

      await tabVideoCounts.refreshChannel(CHANNEL_ID, { onlyIfStale: true });

      expect(tabCountSources.fetchCountsViaYtdlp).toHaveBeenCalledTimes(1);
    });

    test('serves stored counts while throttling has paused every refresh', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      tabCountBackoff.remainingMs.mockResolvedValue(HOUR_MS);

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect([result.status, tabCountSources.fetchCountsViaYtdlp.mock.calls.length]).toEqual(['paused', 0]);
    });

    test('asks about the pause for on-demand refreshes', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      useYtdlp(new Map());

      await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect(tabCountBackoff.remainingMs).toHaveBeenCalledWith('on-demand');
    });

    test('still counts through the API while yt-dlp lookups are paused', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      tabCountBackoff.remainingMs.mockResolvedValue(HOUR_MS);
      useApi(new Map([[`UULF${SUFFIX}`, 1], [`UUSH${SUFFIX}`, 1]]));

      const result = await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect(result.status).toBe('refreshed');
    });

    test('starts a backoff when YouTube throttles the lookup', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      useYtdlp(new Map(), 'bot-check');

      await tabVideoCounts.refreshChannel(CHANNEL_ID);

      expect(tabCountBackoff.start).toHaveBeenCalledWith({ reason: 'bot-check', bulk: false });
    });

    test('shares one lookup between overlapping requests for the same channel', async () => {
      Channel.findOne.mockResolvedValue(makeChannel());
      useApi(new Map([[`UULF${SUFFIX}`, 1], [`UUSH${SUFFIX}`, 1]]));

      await Promise.all([tabVideoCounts.refreshChannel(CHANNEL_ID), tabVideoCounts.refreshChannel(CHANNEL_ID)]);

      expect(tabCountSources.fetchCountsViaApi).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshAll with an API key', () => {
    beforeEach(() => {
      tabCountSources.isApiAvailable.mockReturnValue(true);
      Channel.findOne.mockResolvedValue(null);
    });

    test('looks up every enabled channel in one API request', async () => {
      Channel.findAll.mockResolvedValue([makeChannel(), makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos' })]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map());

      await tabVideoCounts.refreshAll();

      expect(tabCountSources.fetchCountsViaApi.mock.calls[0][0]).toHaveLength(3);
    });

    test('counts channels counted yesterday again', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos', tab_video_counts: countedAgo(HOUR_MS) })]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map());

      await tabVideoCounts.refreshAll();

      expect(tabCountSources.fetchCountsViaApi.mock.calls[0][0]).toEqual([`UULF${SUFFIX}`]);
    });

    test('only looks up channels whose counts are a day old when asked', async () => {
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos', tab_video_counts: countedAgo(HOUR_MS) }),
        makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos' }),
      ]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map());

      await tabVideoCounts.refreshAll({ onlyStale: true });

      expect(tabCountSources.fetchCountsViaApi.mock.calls[0][0]).toEqual(['UULFaaaaaaaaaaaaaaaaaaaaaa']);
    });

    test('reports a partial run when some channels failed', async () => {
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos' }),
        makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos' }),
      ]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map([[`UULF${SUFFIX}`, 4]]));

      const summary = await tabVideoCounts.refreshAll();

      expect([summary.status, summary.outcome, summary.message])
        .toEqual(['error', 'partial', 'Refreshed video counts for 1 channel; 1 channel failed.']);
    });

    test('tells open Subscriptions pages to reload after refreshing', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map([[`UULF${SUFFIX}`, 4]]));

      await tabVideoCounts.refreshAll();

      expect(MessageEmitter.emitMessage).toHaveBeenCalledWith('broadcast', null, 'channel', 'channelsUpdated', expect.any(Object));
    });

    test('runs while yt-dlp refreshes are paused', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountBackoff.remainingMs.mockResolvedValue(HOUR_MS);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map([[`UULF${SUFFIX}`, 4]]));

      const summary = await tabVideoCounts.refreshAll();

      expect(summary.status).toBe('success');
    });

    test('records the current backoff on an API run', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map([[`UULF${SUFFIX}`, 4]]));
      tabCountBackoff.currentDetails.mockResolvedValue(CARRIED_BACKOFF);

      const summary = await tabVideoCounts.refreshAll();

      expect(summary.details).toEqual(expect.objectContaining(CARRIED_BACKOFF));
    });

    test('falls back to yt-dlp when the API call fails', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(null);
      tabCountSources.lookupChannelsPaced.mockImplementation(pacedLookup(new Map([[`UULF${SUFFIX}`, 4]])));

      const summary = await tabVideoCounts.refreshAll();

      expect([summary.status, summary.details.source]).toEqual(['success', 'yt-dlp']);
    });

    test('succeeds with nothing to do when no channel can be counted', async () => {
      Channel.findAll.mockResolvedValue([]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map());

      const summary = await tabVideoCounts.refreshAll();

      expect([summary.status, summary.outcome]).toEqual(['success', 'completed']);
    });

    test('skips a refresh while another one is running', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      let finish;
      tabCountSources.fetchCountsViaApi.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
      const first = tabVideoCounts.refreshAll();
      await new Promise((resolve) => setImmediate(resolve));

      const second = await tabVideoCounts.refreshAll();
      finish(new Map([[`UULF${SUFFIX}`, 4]]));
      await first;

      expect([second.status, second.outcome]).toEqual(['skipped', 'skipped']);
    });
  });

  describe('refreshAll without an API key', () => {
    const lookedUpChannels = () => tabCountSources.lookupChannelsPaced.mock.calls[0][0]
      .map((plan) => plan.channel.channel_id);

    beforeEach(() => {
      Channel.findOne.mockResolvedValue(null);
      tabCountSources.lookupChannelsPaced.mockImplementation(pacedLookup(new Map()));
    });

    test('skips channels counted within three days', async () => {
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos', tab_video_counts: countedAgo(2 * DAY_MS) }),
        makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos', tab_video_counts: countedAgo(4 * DAY_MS) }),
      ]);

      await tabVideoCounts.refreshAll();

      expect(lookedUpChannels()).toEqual([OTHER_CHANNEL_ID]);
    });

    test('skips channels attempted within three days', async () => {
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos', tab_counts_attempted_at: ago(DAY_MS) }),
        makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos' }),
      ]);

      await tabVideoCounts.refreshAll();

      expect(lookedUpChannels()).toEqual([OTHER_CHANNEL_ID]);
    });

    test('looks up the channels attempted longest ago first', async () => {
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos', tab_counts_attempted_at: ago(4 * DAY_MS) }),
        makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos', tab_counts_attempted_at: ago(9 * DAY_MS) }),
        makeChannel({ channel_id: makeChannelId(1), available_tabs: 'videos' }),
      ]);

      await tabVideoCounts.refreshAll();

      expect(lookedUpChannels()).toEqual([makeChannelId(1), OTHER_CHANNEL_ID, CHANNEL_ID]);
    });

    test('stops at a whole channel once a run reaches 200 lookups', async () => {
      // 67 channels of three tabs: the 67th would make 201 lookups.
      Channel.findAll.mockResolvedValue(Array.from({ length: 67 }, (_, i) => makeChannel({
        channel_id: makeChannelId(i),
        available_tabs: 'videos,shorts,streams',
      })));

      await tabVideoCounts.refreshAll();

      expect(lookedUpChannels()).toHaveLength(66);
    });

    test('reports the channels left for later runs', async () => {
      Channel.findAll.mockResolvedValue(Array.from({ length: 101 }, (_, i) => makeChannel({ channel_id: makeChannelId(i) })));
      tabCountSources.lookupChannelsPaced.mockImplementation(pacedLookup(new Map(
        Array.from({ length: 101 }, (_, i) => [[`UULF${makeChannelId(i).slice(2)}`, 1], [`UUSH${makeChannelId(i).slice(2)}`, 1]]).flat()
      )));

      const summary = await tabVideoCounts.refreshAll();

      expect([summary.status, summary.message])
        .toEqual(['success', 'Refreshed video counts for 100 channels. 1 channel left for later runs.']);
    });

    test('records each attempt before its lookup', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);

      await tabVideoCounts.refreshAll();

      expect(Channel.update).toHaveBeenCalledWith(
        { tab_counts_attempted_at: expect.any(Date) },
        { where: { channel_id: CHANNEL_ID } }
      );
    });

    test('saves each channel as its lookups finish', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountSources.lookupChannelsPaced.mockImplementation(pacedLookup(new Map([[`UULF${SUFFIX}`, 7]])));

      await tabVideoCounts.refreshAll();

      const write = Channel.update.mock.calls.find(([fields]) => 'tab_video_counts' in fields);
      expect(JSON.parse(write[0].tab_video_counts).video.total).toBe(7);
    });

    test('skips the run while bulk refreshes are paused', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountBackoff.remainingMs.mockResolvedValue(5.5 * HOUR_MS);

      const summary = await tabVideoCounts.refreshAll();

      expect([summary.status, summary.message, tabCountSources.lookupChannelsPaced.mock.calls.length])
        .toEqual(['skipped', 'Paused for another 6 hours after YouTube limited requests.', 0]);
    });

    test('starts a bulk backoff when YouTube throttles the run', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountSources.lookupChannelsPaced.mockImplementation(pacedLookup(new Map(), { stopReason: 'rate-limit' }));

      await tabVideoCounts.refreshAll();

      expect(tabCountBackoff.start).toHaveBeenCalledWith({ reason: 'rate-limit', bulk: true });
    });

    test('records a throttled run with its backoff', async () => {
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos' }),
        makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos' }),
      ]);
      tabCountSources.lookupChannelsPaced.mockImplementation(pacedLookup(new Map(), { stopReason: 'rate-limit', stopAfter: 1 }));

      const summary = await tabVideoCounts.refreshAll();

      expect(summary).toEqual({
        status: 'error',
        outcome: 'throttled',
        message: 'Refreshed video counts for 0 channels; 1 channel failed. Stopped because YouTube is limiting requests; all refreshes are paused for 6 hours. 1 channel left for later runs.',
        details: { refreshed: 0, failed: 1, source: 'yt-dlp', remaining: 1, ...RATE_LIMIT_BACKOFF },
      });
    });

    test('ends the run without a backoff after repeated failures', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountSources.lookupChannelsPaced.mockImplementation(pacedLookup(new Map(), { stopReason: 'failures' }));

      const summary = await tabVideoCounts.refreshAll();

      expect([summary.outcome, summary.message, tabCountBackoff.start.mock.calls.length])
        .toEqual(['error', 'Refreshed video counts for 0 channels; 1 channel failed. Stopped after repeated failed lookups.', 0]);
    });

    test('ends the backoff doubling after a run YouTube did not throttle', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountBackoff.getRevision.mockReturnValue(7);

      await tabVideoCounts.refreshAll();

      expect(tabCountBackoff.clearIfUnchanged).toHaveBeenCalledWith(7);
    });

    test('keeps the backoff doubling after a run that looked nothing up', async () => {
      Channel.findAll.mockResolvedValue([]);

      await tabVideoCounts.refreshAll();

      expect(tabCountBackoff.clearIfUnchanged).not.toHaveBeenCalled();
    });

    test('checks for a bulk pause before each lookup', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      let shouldStop;
      tabCountSources.lookupChannelsPaced.mockImplementation(async (plans, hooks) => {
        shouldStop = hooks.shouldStop;
        return { stopReason: null };
      });
      await tabVideoCounts.refreshAll();
      tabCountBackoff.remainingMs.mockResolvedValue(HOUR_MS);

      expect(await shouldStop()).toBe(true);
    });

    test('stops without starting a backoff when a pause begins during the run', async () => {
      Channel.findAll.mockResolvedValue([
        makeChannel({ available_tabs: 'videos' }),
        makeChannel({ channel_id: OTHER_CHANNEL_ID, available_tabs: 'videos' }),
      ]);
      tabCountSources.lookupChannelsPaced.mockImplementation(pacedLookup(
        new Map([[`UULF${SUFFIX}`, 4]]),
        { stopReason: 'paused', stopAfter: 1 }
      ));

      const summary = await tabVideoCounts.refreshAll();

      expect([summary.status, summary.message, tabCountBackoff.start.mock.calls.length]).toEqual([
        'success',
        'Refreshed video counts for 1 channel. Stopped because refreshes were paused. 1 channel left for later runs.',
        0,
      ]);
    });

    test('records the current backoff on a run that looked nothing up', async () => {
      Channel.findAll.mockResolvedValue([]);
      tabCountBackoff.currentDetails.mockResolvedValue(CARRIED_BACKOFF);

      const summary = await tabVideoCounts.refreshAll();

      expect(summary.details).toEqual(expect.objectContaining(CARRIED_BACKOFF));
    });

    test('resolves with the current backoff when the refresh fails', async () => {
      Channel.findAll.mockRejectedValue(new Error('db down'));
      tabCountBackoff.currentDetails.mockResolvedValue(CARRIED_BACKOFF);

      const summary = await tabVideoCounts.refreshAll();

      expect(summary).toEqual({ status: 'error', outcome: 'error', message: 'db down', details: CARRIED_BACKOFF });
    });
  });

  describe('refreshAtStartup', () => {
    const runHistory = { record: jest.fn(), getLatestRun: jest.fn() };

    beforeEach(() => {
      runHistory.record.mockResolvedValue(undefined);
      tabVideoCounts.setRunHistory(runHistory);
      Channel.findOne.mockResolvedValue(null);
      tabCountSources.isApiAvailable.mockReturnValue(true);
    });

    test('records the catch-up run with the startup trigger', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map([[`UULF${SUFFIX}`, 4]]));

      await tabVideoCounts.refreshAtStartup();

      expect(runHistory.record).toHaveBeenCalledWith(expect.objectContaining({
        taskKey: 'channelVideoCountsFrequency',
        trigger: 'startup',
        status: 'success',
      }));
    });

    test('records nothing when every count is current', async () => {
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos', tab_video_counts: countedAgo(HOUR_MS) })]);
      tabCountSources.fetchCountsViaApi.mockResolvedValue(new Map());

      await tabVideoCounts.refreshAtStartup();

      expect(runHistory.record).not.toHaveBeenCalled();
    });

    test('does not start while a download is running', async () => {
      const summary = await tabVideoCounts.refreshAtStartup({ isDownloadActive: () => true });

      expect([summary.status, Channel.findAll.mock.calls.length]).toEqual(['skipped', 0]);
    });

    test('records nothing while refreshes are paused', async () => {
      tabCountSources.isApiAvailable.mockReturnValue(false);
      Channel.findAll.mockResolvedValue([makeChannel({ available_tabs: 'videos' })]);
      tabCountBackoff.remainingMs.mockResolvedValue(HOUR_MS);

      await tabVideoCounts.refreshAtStartup({ isDownloadActive: () => false });

      expect(runHistory.record).not.toHaveBeenCalled();
    });
  });

  describe('setRunHistory', () => {
    test('hands the run history to the backoff', () => {
      const runHistory = { record: jest.fn(), getLatestRun: jest.fn() };

      tabVideoCounts.setRunHistory(runHistory);

      expect(tabCountBackoff.useRunHistory).toHaveBeenCalledWith(runHistory, 'channelVideoCountsFrequency');
    });
  });
});
