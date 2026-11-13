/* eslint-env jest */

// Required once, into a `mock`-prefixed const; see mockFactories.js for the rules.
const mockFactories = require('./mockFactories');

jest.mock('../../../logger');
jest.mock('../../../models/channel', () => mockFactories.mockChannelModel());
jest.mock('../../../models/channelvideo', () => mockFactories.mockChannelVideoModel());
jest.mock('../../configModule', () => mockFactories.mockConfigModule());
jest.mock('../../../db', () => mockFactories.mockDb());
jest.mock('../../youtubeApi', () => mockFactories.mockYoutubeApi());
jest.mock('../../youtubeExistenceCheck', () => ({ lookup: jest.fn() }));
jest.mock('../../ytDlpRunner', () => ({ run: jest.fn() }));
jest.mock('../../download/ytdlpCommandBuilder', () => ({ buildMetadataFetchArgs: jest.fn() }));

const { Op } = require('sequelize');

const REFRESH_GAP_MS = 3000;
const BOT_CHECK = Object.assign(new Error('Sign in to confirm you are not a bot'), { code: 'COOKIES_REQUIRED' });
// The shape channelYtdlpExecutor rejects with: a generic message, yt-dlp's words in stderr.
const RATE_LIMITED = Object.assign(new Error('Network error: Unable to connect to YouTube'), {
  code: 'NETWORK_ERROR',
  stderr: 'ERROR: [youtube:tab] UCx: Unable to download webpage: HTTP Error 429: Too Many Requests',
});

// 'UC' + 22 characters, distinct per index.
const channelIdFor = (index) => `UC${String(index).padStart(22, 'a')}`;

describe('channelFeedCheck', () => {
  let channelFeedCheck;
  let channelFeedClient;
  let channelVideoFetcher;
  let Channel;
  let ChannelVideo;
  let feeds;
  let membersFeeds;
  let knownIds;

  const makeChannel = (index, extra = {}) => ({
    channel_id: channelIdFor(index),
    title: `Channel ${index}`,
    enabled: true,
    terminated_at: null,
    available_tabs: 'videos,shorts,streams',
    hidden_tabs: null,
    feed_checked_at: null,
    ...extra,
  });
  const video = (youtubeId) => ({ youtubeId, isShort: false });
  const short = (youtubeId) => ({ youtubeId, isShort: true });
  const okFeed = (...entries) => ({ ok: true, entries });
  const deadFeed = { ok: false, reason: 'http-error', status: 404 };
  // What YouTube answers for a channel with no members-only videos.
  const noMembersFeed = { ok: false, reason: 'http-error', status: 404 };

  // Stores the subscribed channels and, per channel id, the feed YouTube answers with.
  const subscribe = (channels, feedByChannelId = {}) => {
    Channel.findAll.mockResolvedValue(channels);
    feeds = feedByChannelId;
  };
  const stampedChannelIds = () => Channel.update.mock.calls
    .filter(([fields]) => fields.feed_checked_at instanceof Date)
    .map(([, options]) => options.where.channel_id);
  const refreshedTabs = () => channelVideoFetcher.refreshTabTracked.mock.calls.map(([, , tabType]) => tabType);

  // Runs the check to its end, letting the pauses between tab listings elapse.
  const runCheck = async () => {
    const run = channelFeedCheck.run();
    await jest.runAllTimersAsync();
    return run;
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();

    Channel = require('../../../models/channel');
    Channel.update.mockResolvedValue([1]);
    ChannelVideo = require('../../../models/channelvideo');
    knownIds = new Set();
    ChannelVideo.findAll.mockImplementation(async ({ where }) => where.youtube_id
      .filter((id) => knownIds.has(id))
      .map((youtube_id) => ({ youtube_id })));

    feeds = {};
    channelFeedClient = require('../channelFeedClient');
    jest.spyOn(channelFeedClient, 'fetchChannelFeed')
      .mockImplementation(async (channelId) => feeds[channelId] || okFeed());
    membersFeeds = {};
    jest.spyOn(channelFeedClient, 'fetchMembersFeed')
      .mockImplementation(async (channelId) => membersFeeds[channelId] || noMembersFeed);
    ChannelVideo.count.mockResolvedValue(0);

    channelVideoFetcher = require('../channelVideoFetcher');
    jest.spyOn(channelVideoFetcher, 'refreshTabTracked')
      .mockResolvedValue({ skipped: false, newVideos: 1 });

    channelFeedCheck = require('../channelFeedCheck');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('channels', () => {
    test('asks only for subscribed channels that are not terminated', async () => {
      subscribe([]);

      await runCheck();

      expect(Channel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ enabled: true, terminated_at: null }),
      }));
    });

    test('records a skipped run when nothing is subscribed', async () => {
      subscribe([]);

      const record = await runCheck();

      expect(record).toEqual(expect.objectContaining({
        status: 'skipped',
        outcome: 'skipped',
        message: 'No subscribed channels to check.',
      }));
      expect(channelFeedClient.fetchChannelFeed).not.toHaveBeenCalled();
    });

    test('leaves out a channel whose id is not a channel id', async () => {
      subscribe([makeChannel(1, { channel_id: 'legacy-handle' }), makeChannel(2)]);

      await runCheck();

      expect(channelFeedClient.fetchChannelFeed).toHaveBeenCalledTimes(1);
      expect(channelFeedClient.fetchChannelFeed).toHaveBeenCalledWith(channelIdFor(2));
    });
  });

  describe('a feed with nothing new', () => {
    beforeEach(() => {
      knownIds = new Set(['AAAAAAAAAA1']);
      subscribe([makeChannel(1)], { [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1')) });
    });

    test('stamps the channel', async () => {
      await runCheck();

      expect(stampedChannelIds()).toEqual([channelIdFor(1)]);
    });

    test('lists no tab', async () => {
      await runCheck();

      expect(channelVideoFetcher.refreshTabTracked).not.toHaveBeenCalled();
    });

    test('records a successful run', async () => {
      const record = await runCheck();

      expect(record).toEqual(expect.objectContaining({
        status: 'success',
        outcome: 'completed',
        message: 'Checked 1 channel. No new videos.',
      }));
    });
  });

  describe('a feed with an unlisted upload', () => {
    test('refreshes videos and streams for an unknown video', async () => {
      subscribe([makeChannel(1)], { [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1')) });

      await runCheck();

      expect(refreshedTabs()).toEqual(['videos', 'streams']);
    });

    test('lists the widest window as a feed check', async () => {
      const channel = makeChannel(1);
      subscribe([channel], { [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1')) });

      await runCheck();

      expect(channelVideoFetcher.refreshTabTracked).toHaveBeenCalledWith(
        channel, channelIdFor(1), 'videos', { type: 'feedCheck' }
      );
    });

    test('refreshes only shorts for an unknown short', async () => {
      subscribe([makeChannel(1)], { [channelIdFor(1)]: okFeed(short('AAAAAAAAAA1')) });

      await runCheck();

      expect(refreshedTabs()).toEqual(['shorts']);
    });

    test('skips tabs the channel does not have', async () => {
      subscribe(
        [makeChannel(1, { available_tabs: 'videos,shorts' })],
        { [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1')) }
      );

      await runCheck();

      expect(refreshedTabs()).toEqual(['videos']);
    });

    test('skips tabs the channel hides', async () => {
      subscribe(
        [makeChannel(1, { hidden_tabs: 'streams' })],
        { [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1'), short('AAAAAAAAAA2')) }
      );

      await runCheck();

      expect(refreshedTabs()).toEqual(['videos', 'shorts']);
    });

    test('refreshes only videos when the channel has no detected tabs', async () => {
      subscribe(
        [makeChannel(1, { available_tabs: null })],
        { [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1'), short('AAAAAAAAAA2')) }
      );

      await runCheck();

      expect(refreshedTabs()).toEqual(['videos']);
    });

    test('stamps the channel once its tabs are listed', async () => {
      subscribe([makeChannel(1)], { [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1')) });

      await runCheck();

      expect(stampedChannelIds()).toEqual([channelIdFor(1)]);
    });

    test('stamps without listing when the upload belongs to a hidden tab', async () => {
      subscribe(
        [makeChannel(1, { hidden_tabs: 'shorts' })],
        { [channelIdFor(1)]: okFeed(short('AAAAAAAAAA1')) }
      );

      await runCheck();

      expect(channelVideoFetcher.refreshTabTracked).not.toHaveBeenCalled();
      expect(stampedChannelIds()).toEqual([channelIdFor(1)]);
    });

    test('waits three seconds between tab listings', async () => {
      subscribe([makeChannel(1)], { [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1')) });

      const run = channelFeedCheck.run();
      await jest.advanceTimersByTimeAsync(REFRESH_GAP_MS - 1);
      const listedBeforeTheGap = channelVideoFetcher.refreshTabTracked.mock.calls.length;
      await jest.runAllTimersAsync();
      await run;

      expect(listedBeforeTheGap).toBe(1);
      expect(channelVideoFetcher.refreshTabTracked).toHaveBeenCalledTimes(2);
    });

    test('says how many channels had new videos and how many tabs were listed', async () => {
      knownIds = new Set(['BBBBBBBBBB1']);
      subscribe([makeChannel(1), makeChannel(2)], {
        [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1')),
        [channelIdFor(2)]: okFeed(video('BBBBBBBBBB1')),
      });

      const record = await runCheck();

      expect(record).toEqual(expect.objectContaining({
        status: 'success',
        outcome: 'completed',
        message: 'Checked 2 channels. 1 had new videos (2 tabs refreshed).',
        details: expect.objectContaining({
          channelsChecked: 2,
          feedsUnavailable: 0,
          channelsWithNewVideos: 1,
          tabsRefreshed: 2,
          tabsDeferred: 0,
        }),
      }));
    });

    test('lists channels checked longest ago first', async () => {
      subscribe(
        [
          makeChannel(1, { feed_checked_at: new Date('2026-11-13T10:00:00Z') }),
          makeChannel(2, { feed_checked_at: null }),
          makeChannel(3, { feed_checked_at: new Date('2026-11-13T08:00:00Z') }),
        ],
        {
          [channelIdFor(1)]: okFeed(short('AAAAAAAAAA1')),
          [channelIdFor(2)]: okFeed(short('BBBBBBBBBB1')),
          [channelIdFor(3)]: okFeed(short('CCCCCCCCCC1')),
        }
      );

      await runCheck();

      const listedChannelIds = channelVideoFetcher.refreshTabTracked.mock.calls.map(([, channelId]) => channelId);
      expect(listedChannelIds).toEqual([channelIdFor(2), channelIdFor(3), channelIdFor(1)]);
    });

    test('does not refresh again for a feed id the listing never returned', async () => {
      subscribe([makeChannel(1)], { [channelIdFor(1)]: okFeed(short('AAAAAAAAAA1')) });
      await runCheck();
      channelVideoFetcher.refreshTabTracked.mockClear();
      Channel.update.mockClear();

      await runCheck();

      expect(channelVideoFetcher.refreshTabTracked).not.toHaveBeenCalled();
      expect(stampedChannelIds()).toEqual([channelIdFor(1)]);
    });

    test('refreshes again when a different unlisted upload appears', async () => {
      subscribe([makeChannel(1)], { [channelIdFor(1)]: okFeed(short('AAAAAAAAAA1')) });
      await runCheck();
      channelVideoFetcher.refreshTabTracked.mockClear();
      feeds[channelIdFor(1)] = okFeed(short('AAAAAAAAAA2'), short('AAAAAAAAAA1'));

      await runCheck();

      expect(refreshedTabs()).toEqual(['shorts']);
    });
  });

  describe('feeds that fail', () => {
    test('leaves a channel untouched when its feed fails', async () => {
      knownIds = new Set(['BBBBBBBBBB1']);
      subscribe([makeChannel(1), makeChannel(2)], {
        [channelIdFor(1)]: deadFeed,
        [channelIdFor(2)]: okFeed(video('BBBBBBBBBB1')),
      });

      const record = await runCheck();

      expect(stampedChannelIds()).toEqual([channelIdFor(2)]);
      expect(channelVideoFetcher.refreshTabTracked).not.toHaveBeenCalled();
      expect(record.status).toBe('success');
      expect(record.message).toBe('Checked 1 channel. No new videos. 1 feed unavailable.');
    });

    test('records skipped and writes nothing when every feed fails', async () => {
      const channels = Array.from({ length: 20 }, (_, index) => makeChannel(index));
      subscribe(channels, Object.fromEntries(channels.map((channel) => [channel.channel_id, deadFeed])));

      const record = await runCheck();

      expect(record).toEqual(expect.objectContaining({
        status: 'skipped',
        outcome: 'skipped',
        message: 'YouTube feeds unavailable; nothing was changed.',
      }));
      expect(Channel.update).not.toHaveBeenCalled();
      expect(channelVideoFetcher.refreshTabTracked).not.toHaveBeenCalled();
    });

    test('stops asking after eight failures in a row', async () => {
      const channels = Array.from({ length: 20 }, (_, index) => makeChannel(index));
      subscribe(channels, Object.fromEntries(channels.map((channel) => [channel.channel_id, deadFeed])));

      await runCheck();

      const asked = channelFeedClient.fetchChannelFeed.mock.calls.length;
      expect(asked).toBeGreaterThanOrEqual(8);
      // Eight failures plus the three other requests already in flight.
      expect(asked).toBeLessThanOrEqual(11);
    });

    test('discards the feeds already read when YouTube stops answering mid-run', async () => {
      // An identity shuffle: the working feeds are read first, then the outage.
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999999);
      const working = Array.from({ length: 4 }, (_, index) => makeChannel(index));
      const dead = Array.from({ length: 12 }, (_, index) => makeChannel(100 + index));
      subscribe([...working, ...dead], {
        [channelIdFor(0)]: okFeed(video('AAAAAAAAAA1')),
        ...Object.fromEntries(dead.map((channel) => [channel.channel_id, deadFeed])),
      });

      const record = await runCheck();
      randomSpy.mockRestore();

      expect(record.status).toBe('skipped');
      expect(Channel.update).not.toHaveBeenCalled();
      expect(channelVideoFetcher.refreshTabTracked).not.toHaveBeenCalled();
    });

    test('records skipped for a single channel whose feed fails', async () => {
      subscribe([makeChannel(1)], { [channelIdFor(1)]: deadFeed });

      const record = await runCheck();

      expect(record.status).toBe('skipped');
      expect(Channel.update).not.toHaveBeenCalled();
    });

    test('does not trip the breaker for a few dead feeds among working ones', async () => {
      const dead = Array.from({ length: 7 }, (_, index) => makeChannel(index));
      const working = Array.from({ length: 20 }, (_, index) => makeChannel(100 + index));
      subscribe(
        [...dead, ...working],
        Object.fromEntries(dead.map((channel) => [channel.channel_id, deadFeed]))
      );

      const record = await runCheck();

      expect(channelFeedClient.fetchChannelFeed).toHaveBeenCalledTimes(27);
      expect(record.status).toBe('success');
      expect(record.message).toBe('Checked 20 channels. No new videos. 7 feeds unavailable.');
    });
  });

  describe('the members-only feed', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const timedOut = { ok: false, reason: 'timeout' };
    const daysAgo = (days) => new Date(Date.now() - days * DAY_MS).toISOString();
    // The channel's listing holds one members-only video, published that long ago.
    const withMembersVideoListed = (publishedAt) => {
      ChannelVideo.count.mockImplementation(async ({ where }) => {
        const since = where.publishedAt[Op.gte];
        return where.availability === 'subscriber_only' && publishedAt >= since ? 1 : 0;
      });
    };

    test('is read for a channel whose feed answered', async () => {
      subscribe([makeChannel(1)]);

      await runCheck();

      expect(channelFeedClient.fetchMembersFeed).toHaveBeenCalledWith(channelIdFor(1));
    });

    test('is not read for a channel whose feed failed', async () => {
      subscribe([makeChannel(1), makeChannel(2)], { [channelIdFor(1)]: deadFeed });

      await runCheck();

      const asked = channelFeedClient.fetchMembersFeed.mock.calls.map(([channelId]) => channelId);
      expect(asked).toEqual([channelIdFor(2)]);
    });

    test('lists videos and streams for an unlisted members-only video', async () => {
      subscribe([makeChannel(1)]);
      membersFeeds[channelIdFor(1)] = okFeed(video('MMMMMMMMMM1'));

      await runCheck();

      expect(refreshedTabs()).toEqual(['videos', 'streams']);
    });

    test('lists no tab when its videos are already listed', async () => {
      knownIds = new Set(['MMMMMMMMMM1']);
      subscribe([makeChannel(1)]);
      membersFeeds[channelIdFor(1)] = okFeed(video('MMMMMMMMMM1'));

      await runCheck();

      expect(channelVideoFetcher.refreshTabTracked).not.toHaveBeenCalled();
      expect(stampedChannelIds()).toEqual([channelIdFor(1)]);
    });

    test('stamps a channel that has no members-only videos', async () => {
      subscribe([makeChannel(1)]);

      const record = await runCheck();

      expect(stampedChannelIds()).toEqual([channelIdFor(1)]);
      expect(record.message).toBe('Checked 1 channel. No new videos.');
    });

    test('is not asked for again within a day of a 404', async () => {
      subscribe([makeChannel(1)]);
      await runCheck();
      jest.advanceTimersByTime(DAY_MS - 60 * 1000);

      await runCheck();

      expect(channelFeedClient.fetchMembersFeed).toHaveBeenCalledTimes(1);
    });

    test('is asked for again a day after a 404', async () => {
      subscribe([makeChannel(1)]);
      await runCheck();
      jest.advanceTimersByTime(DAY_MS + 1);

      await runCheck();

      expect(channelFeedClient.fetchMembersFeed).toHaveBeenCalledTimes(2);
    });

    test('is asked for every run once it has answered', async () => {
      knownIds = new Set(['MMMMMMMMMM1']);
      subscribe([makeChannel(1)]);
      membersFeeds[channelIdFor(1)] = okFeed(video('MMMMMMMMMM1'));
      await runCheck();

      await runCheck();

      expect(channelFeedClient.fetchMembersFeed).toHaveBeenCalledTimes(2);
    });

    // A 404 is also what a feed outage looks like, and a channel that posted
    // a members-only video this month has not run out of them.
    describe('a 404 for a channel with a recent members-only video', () => {
      beforeEach(() => {
        withMembersVideoListed(daysAgo(3));
        subscribe([makeChannel(1)]);
      });

      test('does not stamp the channel', async () => {
        await runCheck();

        expect(stampedChannelIds()).toEqual([]);
      });

      test('is asked about again on the next run', async () => {
        await runCheck();

        await runCheck();

        expect(channelFeedClient.fetchMembersFeed).toHaveBeenCalledTimes(2);
      });

      test('counts as a feed that was unavailable', async () => {
        const record = await runCheck();

        expect(record.message).toBe('Checked 1 channel. No new videos. 1 members-only feed unavailable.');
      });
    });

    describe('a 404 for a channel whose last members-only video is over a month old', () => {
      beforeEach(() => {
        withMembersVideoListed(daysAgo(45));
        subscribe([makeChannel(1)]);
      });

      test('stamps the channel', async () => {
        await runCheck();

        expect(stampedChannelIds()).toEqual([channelIdFor(1)]);
      });

      test('is not asked about again within a day', async () => {
        await runCheck();

        await runCheck();

        expect(channelFeedClient.fetchMembersFeed).toHaveBeenCalledTimes(1);
      });
    });

    describe('when it fails', () => {
      beforeEach(() => {
        subscribe([makeChannel(1)]);
        membersFeeds[channelIdFor(1)] = timedOut;
      });

      test('the channel is not stamped', async () => {
        await runCheck();

        expect(stampedChannelIds()).toEqual([]);
      });

      test('a public upload is still listed', async () => {
        feeds[channelIdFor(1)] = okFeed(video('AAAAAAAAAA1'));

        await runCheck();

        expect(refreshedTabs()).toEqual(['videos', 'streams']);
      });

      test('the channel is not stamped after its public upload was listed', async () => {
        feeds[channelIdFor(1)] = okFeed(video('AAAAAAAAAA1'));

        await runCheck();

        expect(stampedChannelIds()).toEqual([]);
      });

      test('it is asked for again on the next run', async () => {
        await runCheck();

        await runCheck();

        expect(channelFeedClient.fetchMembersFeed).toHaveBeenCalledTimes(2);
      });

      test('the run says so', async () => {
        const record = await runCheck();

        expect(record).toEqual(expect.objectContaining({
          status: 'success',
          message: 'Checked 1 channel. No new videos. 1 members-only feed unavailable.',
          details: expect.objectContaining({ membersFeedsUnavailable: 1 }),
        }));
      });
    });

    test('failures do not count toward the feed outage breaker', async () => {
      const channels = Array.from({ length: 20 }, (_, index) => makeChannel(index));
      subscribe(channels);
      channels.forEach((channel) => { membersFeeds[channel.channel_id] = timedOut; });

      const record = await runCheck();

      expect(channelFeedClient.fetchChannelFeed).toHaveBeenCalledTimes(20);
      expect(record.status).toBe('success');
    });

    test('keeps an id the listing never returned through a run where the feed failed', async () => {
      subscribe([makeChannel(1)]);
      membersFeeds[channelIdFor(1)] = okFeed(video('MMMMMMMMMM1'));
      await runCheck();
      membersFeeds[channelIdFor(1)] = timedOut;
      await runCheck();
      membersFeeds[channelIdFor(1)] = okFeed(video('MMMMMMMMMM1'));
      channelVideoFetcher.refreshTabTracked.mockClear();

      await runCheck();

      expect(channelVideoFetcher.refreshTabTracked).not.toHaveBeenCalled();
    });
  });

  describe('tab listings that do not finish', () => {
    beforeEach(() => {
      subscribe([makeChannel(1)], { [channelIdFor(1)]: okFeed(video('AAAAAAAAAA1')) });
    });

    test('does not stamp when a tab refresh fails', async () => {
      channelVideoFetcher.refreshTabTracked.mockRejectedValueOnce(new Error('yt-dlp failed'));

      await runCheck();

      expect(stampedChannelIds()).toEqual([]);
    });

    test('still lists the channel\'s other tab after one fails', async () => {
      channelVideoFetcher.refreshTabTracked.mockRejectedValueOnce(new Error('yt-dlp failed'));

      await runCheck();

      expect(refreshedTabs()).toEqual(['videos', 'streams']);
    });

    test('records a partial run when a tab refresh fails', async () => {
      channelVideoFetcher.refreshTabTracked.mockRejectedValueOnce(new Error('yt-dlp failed'));

      const record = await runCheck();

      expect(record).toEqual(expect.objectContaining({
        status: 'error',
        outcome: 'partial',
        message: 'Checked 1 channel. 1 had new videos (1 tab refreshed). 1 tab listing failed.',
      }));
    });

    test('does not stamp when a tab was already being fetched', async () => {
      channelVideoFetcher.refreshTabTracked.mockResolvedValueOnce({ skipped: true });

      await runCheck();

      expect(stampedChannelIds()).toEqual([]);
    });

    test('stops refreshing on a bot check', async () => {
      channelVideoFetcher.refreshTabTracked.mockRejectedValueOnce(BOT_CHECK);

      await runCheck();

      expect(refreshedTabs()).toEqual(['videos']);
      expect(stampedChannelIds()).toEqual([]);
    });

    test('records a partial run when YouTube rate-limits the listing', async () => {
      subscribe([makeChannel(1), makeChannel(2)], {
        [channelIdFor(1)]: okFeed(short('AAAAAAAAAA1')),
        [channelIdFor(2)]: okFeed(short('BBBBBBBBBB1')),
      });
      channelVideoFetcher.refreshTabTracked
        .mockResolvedValueOnce({ skipped: false, newVideos: 1 })
        .mockRejectedValueOnce(RATE_LIMITED);

      const record = await runCheck();

      expect(record).toEqual(expect.objectContaining({
        status: 'error',
        outcome: 'partial',
        message: 'Checked 2 channels. YouTube rate-limited the listing after 1 tab; the rest wait for the next run.',
      }));
    });
  });

  describe('the per-run cap', () => {
    test('defers tabs past 60 to the next run', async () => {
      const channels = Array.from({ length: 40 }, (_, index) => makeChannel(index));
      subscribe(channels, Object.fromEntries(
        channels.map((channel, index) => [channel.channel_id, okFeed(video(`VIDEO${String(index).padStart(6, '0')}`))])
      ));

      const record = await runCheck();

      expect(channelVideoFetcher.refreshTabTracked).toHaveBeenCalledTimes(60);
      expect(record.status).toBe('success');
      expect(record.message).toBe(
        'Checked 40 channels. 30 had new videos (60 tabs refreshed). 20 tabs deferred to the next run.'
      );
    });

    test('does not stamp a channel whose tabs were deferred', async () => {
      const channels = Array.from({ length: 40 }, (_, index) => makeChannel(index));
      subscribe(channels, Object.fromEntries(
        channels.map((channel, index) => [channel.channel_id, okFeed(video(`VIDEO${String(index).padStart(6, '0')}`))])
      ));

      await runCheck();

      expect(stampedChannelIds()).toHaveLength(30);
    });
  });

  describe('isRunning', () => {
    test('is false before and after a run', async () => {
      subscribe([makeChannel(1)]);
      const before = channelFeedCheck.isRunning();

      await runCheck();

      expect(before).toBe(false);
      expect(channelFeedCheck.isRunning()).toBe(false);
    });

    test('is true while feeds are being read', async () => {
      subscribe([makeChannel(1)]);
      let answer;
      channelFeedClient.fetchChannelFeed.mockReturnValue(new Promise((resolve) => { answer = resolve; }));

      const run = channelFeedCheck.run();
      await jest.advanceTimersByTimeAsync(0);
      const during = channelFeedCheck.isRunning();
      answer(okFeed());
      await jest.runAllTimersAsync();
      await run;

      expect(during).toBe(true);
    });

    test('is false again after a run that threw', async () => {
      Channel.findAll.mockRejectedValue(new Error('db down'));

      // No timers run before the rejection, so the promise is awaited directly.
      await expect(channelFeedCheck.run()).rejects.toThrow('db down');

      expect(channelFeedCheck.isRunning()).toBe(false);
    });
  });
});
