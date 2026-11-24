const { Op } = require('sequelize');
const logger = require('../../logger');
const Channel = require('../../models/channel');
const ChannelVideo = require('../../models/channelvideo');
const { TAB_TYPES } = require('../tabsUtils');
const { sleep } = require('../filesystem/sleep');
const channelFeedClient = require('./channelFeedClient');
const channelVideoFetcher = require('./channelVideoFetcher');
const tabCountSources = require('./tabCountSources');
const tabState = require('./tabState');

const FEED_CONCURRENCY = 4;
// Feeds are read in shuffled order, so this many failures in a row means
// YouTube's feed server is down, not that a few channels have dead feeds.
const CONSECUTIVE_FAILURES_BREAKER = 8;
// yt-dlp spaces the requests inside one listing, never the gap before the next.
const REFRESH_GAP_MS = 3 * 1000;
// Bounds a run where many channels look changed at once (the first run after
// an upgrade); the rest sort first next time, since their check is oldest.
const MAX_TAB_REFRESHES_PER_RUN = 60;
const FEED_CHECK_TYPE = 'feedCheck';
// How long a channel with no members-only videos is left alone before its
// members-only feed is asked for again.
const NO_MEMBERS_FEED_TTL_MS = 24 * 60 * 60 * 1000;
// A channel whose listing has a members-only video this recent is still
// posting them, so a 404 from its members-only feed is not believed.
const RECENT_MEMBERS_VIDEO_MS = 30 * 24 * 60 * 60 * 1000;
const HTTP_NOT_FOUND = 404;
// yt-dlp's availability value for a members-only video.
const MEMBERS_ONLY_AVAILABILITY = 'subscriber_only';
// Listing order when a channel needs more than one tab.
const TAB_ORDER = [TAB_TYPES.VIDEOS, TAB_TYPES.SHORTS, TAB_TYPES.LIVE];

const NO_CHANNELS_RECORD = Object.freeze({
  status: 'skipped',
  outcome: 'skipped',
  message: 'No subscribed channels to check.',
});

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function counted(count, noun) {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;
}

function feedCheckedTime(channel) {
  return channel.feed_checked_at ? new Date(channel.feed_checked_at).getTime() : 0;
}

/**
 * How many channel feeds failed, by HTTP status or, without one, by reason.
 * @param {Array<{feed: Object}>} results
 * @returns {Object<string, number>}
 */
function tallyFeedFailures(results) {
  const tally = {};
  for (const { feed } of results) {
    if (feed.ok) continue;
    const cause = feed.status ? String(feed.status) : feed.reason;
    tally[cause] = (tally[cause] || 0) + 1;
  }
  return tally;
}

/**
 * The scheduled check that keeps subscribed channels' video listings current.
 * It reads each channel's RSS feeds (public uploads, then members-only
 * uploads) only to notice video ids the listing does not have yet; the rows
 * themselves always come from the yt-dlp tab listing. A feed that fails, or
 * is not this channel's feed, is no information: the channel is left exactly
 * as it was.
 */
class ChannelFeedCheck {
  constructor() {
    this.running = false;
    // Per channel, feed ids a tab listing did not return (an upload yt-dlp's
    // tab does not show). Remembered so they do not start a listing every run.
    this.unresolvedIds = new Map();
    // Per channel, when to ask for its members-only feed again after
    // YouTube said it has none.
    this.noMembersFeedUntil = new Map();
  }

  isRunning() {
    return this.running;
  }

  /**
   * @returns {Promise<{status: string, outcome: string, message: string, details?: Object}>} the run record
   */
  async run() {
    this.running = true;
    try {
      const record = await this._run();
      // Every outcome at the same level: YouTube's feeds are down often
      // enough that a skipped run is an ordinary result, not a warning.
      logger.info({ outcome: record.outcome, result: record.message, ...record.details }, 'Channel feed check finished');
      return record;
    } finally {
      this.running = false;
    }
  }

  async _run() {
    const subscribed = await Channel.findAll({ where: { enabled: true, terminated_at: null } });
    const channels = subscribed.filter((channel) => channelFeedClient.supportsChannel(channel.channel_id));
    if (channels.length === 0) {
      return { ...NO_CHANNELS_RECORD };
    }

    const { results, breakerTripped } = await this._readFeeds(shuffled(channels));
    const readable = results.filter(({ feed }) => feed.ok);
    const feedsUnavailable = results.length - readable.length;
    const feedFailures = tallyFeedFailures(results);
    if (breakerTripped || readable.length === 0) {
      return {
        status: 'skipped',
        outcome: 'skipped',
        message: `YouTube's feeds are not answering (${feedsUnavailable.toLocaleString()} of ${results.length.toLocaleString()} failed). `
          + 'Nothing was changed; channel pages still check for new videos when opened.',
        details: { channelsChecked: 0, feedsAsked: results.length, feedsUnavailable, feedFailures },
      };
    }

    const membersFeedsUnavailable = readable.filter(({ members }) => !members.known).length;

    const plans = [];
    for (const { channel, feed, members } of readable) {
      const unlisted = await this._unlistedEntries(
        channel, [...feed.entries, ...members.entries], { complete: members.known }
      );
      const tabs = this._tabsFor(channel, unlisted);
      if (tabs.length > 0) {
        plans.push({
          channel,
          tabs,
          unlistedIds: unlisted.map((entry) => entry.youtubeId),
          membersKnown: members.known,
        });
      } else if (members.known) {
        await this._stamp(channel);
      }
    }

    const outcome = await this._refresh(plans);
    return this._describe({
      channelsChecked: readable.length, feedsUnavailable, feedFailures, membersFeedsUnavailable, ...outcome,
    });
  }

  /**
   * Read the channels' feeds, a few at a time, stopping early when YouTube
   * stops answering. Only the public feed counts toward that: a channel's
   * members-only feed is asked for after its public feed answered.
   * @param {Array<Object>} channels
   * @returns {Promise<{results: Array<{channel: Object, feed: Object, members: ?{entries: Array, known: boolean}}>, breakerTripped: boolean}>}
   */
  async _readFeeds(channels) {
    const results = [];
    let nextIndex = 0;
    let consecutiveFailures = 0;
    let breakerTripped = false;

    const worker = async () => {
      while (!breakerTripped && nextIndex < channels.length) {
        const channel = channels[nextIndex++];
        const feed = await channelFeedClient.fetchChannelFeed(channel.channel_id);
        const members = feed.ok ? await this._readMembersFeed(channel.channel_id) : null;
        results.push({ channel, feed, members });
        if (feed.ok) {
          consecutiveFailures = 0;
        } else {
          consecutiveFailures += 1;
          if (consecutiveFailures >= CONSECUTIVE_FAILURES_BREAKER) breakerTripped = true;
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(FEED_CONCURRENCY, channels.length) }, worker));
    return { results, breakerTripped };
  }

  /**
   * The channel's members-only uploads, as far as its feed can tell.
   * `known` is false when the feed gave no information.
   * @param {string} channelId
   * @returns {Promise<{entries: Array<{youtubeId: string, isShort: boolean}>, known: boolean}>}
   */
  async _readMembersFeed(channelId) {
    if (this._hasNoMembersFeed(channelId)) return { entries: [], known: true };

    const feed = await channelFeedClient.fetchMembersFeed(channelId);
    if (feed.ok) return { entries: feed.entries, known: true };
    if (feed.status !== HTTP_NOT_FOUND) return { entries: [], known: false };

    // YouTube answers 404 for a channel with no members-only videos, and
    // with the same page during a feed outage. A channel that listed one
    // recently has not run out of them, so there the 404 says nothing.
    if (await this._hasRecentMembersVideo(channelId)) return { entries: [], known: false };

    this.noMembersFeedUntil.set(channelId, Date.now() + NO_MEMBERS_FEED_TTL_MS);
    return { entries: [], known: true };
  }

  async _hasRecentMembersVideo(channelId) {
    const since = new Date(Date.now() - RECENT_MEMBERS_VIDEO_MS).toISOString();
    const recent = await ChannelVideo.count({
      where: {
        channel_id: channelId,
        availability: MEMBERS_ONLY_AVAILABILITY,
        // Stored as ISO strings, which sort as dates.
        publishedAt: { [Op.gte]: since },
      },
    });
    return recent > 0;
  }

  _hasNoMembersFeed(channelId) {
    const until = this.noMembersFeedUntil.get(channelId);
    if (until === undefined) return false;
    if (Date.now() < until) return true;
    this.noMembersFeedUntil.delete(channelId);
    return false;
  }

  /**
   * Feed entries the channel's listing has no row for, leaving out ids an
   * earlier listing already failed to return.
   * @param {Object} channel
   * @param {Array<{youtubeId: string, isShort: boolean}>} entries
   * @param {Object} options
   * @param {boolean} options.complete - Whether every feed of the channel answered this run
   * @returns {Promise<Array<{youtubeId: string, isShort: boolean}>>}
   */
  async _unlistedEntries(channel, entries, { complete }) {
    const missing = await this._idsWithoutRows(channel.channel_id, entries.map((entry) => entry.youtubeId));
    const unresolved = this.unresolvedIds.get(channel.channel_id) || new Set();
    // Ids that left the feeds are forgotten, so the memory stays feed-sized.
    // A feed that gave no answer this run has not dropped any.
    const stillUnresolved = complete
      ? new Set([...unresolved].filter((id) => missing.has(id)))
      : unresolved;
    if (stillUnresolved.size > 0) {
      this.unresolvedIds.set(channel.channel_id, stillUnresolved);
    } else {
      this.unresolvedIds.delete(channel.channel_id);
    }
    return entries.filter((entry) => missing.has(entry.youtubeId) && !stillUnresolved.has(entry.youtubeId));
  }

  async _idsWithoutRows(channelId, youtubeIds) {
    if (youtubeIds.length === 0) return new Set();
    const rows = await ChannelVideo.findAll({
      where: { channel_id: channelId, youtube_id: youtubeIds },
      attributes: ['youtube_id'],
      raw: true,
    });
    const listed = new Set(rows.map((row) => row.youtube_id));
    return new Set(youtubeIds.filter((id) => !listed.has(id)));
  }

  /**
   * The tabs whose listing would pick up the unlisted entries. The feed marks
   * shorts; anything else may be a video or a stream, so both are listed.
   * @param {Object} channel
   * @param {Array<{youtubeId: string, isShort: boolean}>} unlisted
   * @returns {string[]}
   */
  _tabsFor(channel, unlisted) {
    if (unlisted.length === 0) return [];
    const channelTabs = channel.available_tabs
      ? tabState.computeEffectiveTabs(channel.available_tabs, channel.hidden_tabs)
      : [TAB_TYPES.VIDEOS];
    const wanted = new Set();
    for (const entry of unlisted) {
      if (entry.isShort) {
        wanted.add(TAB_TYPES.SHORTS);
      } else {
        wanted.add(TAB_TYPES.VIDEOS);
        wanted.add(TAB_TYPES.LIVE);
      }
    }
    return TAB_ORDER.filter((tab) => wanted.has(tab) && channelTabs.includes(tab));
  }

  /**
   * List the planned tabs, one at a time and spaced apart, channels whose
   * check is oldest first.
   * @param {Array<{channel: Object, tabs: string[], unlistedIds: string[], membersKnown: boolean}>} plans
   * @returns {Promise<{channelsWithNewVideos: number, tabsRefreshed: number, tabsFailed: number, tabsDeferred: number, throttled: boolean}>}
   */
  async _refresh(plans) {
    const ordered = [...plans].sort((a, b) => feedCheckedTime(a.channel) - feedCheckedTime(b.channel));
    const outcome = { channelsWithNewVideos: 0, tabsRefreshed: 0, tabsFailed: 0, tabsDeferred: 0, throttled: false };
    let tabsAttempted = 0;

    for (let index = 0; index < ordered.length; index++) {
      const { channel, tabs, unlistedIds, membersKnown } = ordered[index];
      if (tabsAttempted + tabs.length > MAX_TAB_REFRESHES_PER_RUN) {
        outcome.tabsDeferred = ordered.slice(index).reduce((sum, plan) => sum + plan.tabs.length, 0);
        break;
      }

      let everyTabListed = true;
      for (const tabType of tabs) {
        if (tabsAttempted > 0) await sleep(REFRESH_GAP_MS);
        tabsAttempted += 1;
        try {
          const refresh = await channelVideoFetcher.refreshTabTracked(
            channel, channel.channel_id, tabType, { type: FEED_CHECK_TYPE }
          );
          if (refresh.skipped) {
            everyTabListed = false;
          } else {
            outcome.tabsRefreshed += 1;
          }
        } catch (err) {
          everyTabListed = false;
          if (tabCountSources.isThrottleFailure(err)) {
            logger.warn({ err, channelId: channel.channel_id, tabType }, 'YouTube throttled a feed check listing, stopping this run');
            outcome.throttled = true;
            return outcome;
          }
          outcome.tabsFailed += 1;
          logger.warn({ err, channelId: channel.channel_id, tabType }, 'Feed check tab listing failed');
        }
      }

      outcome.channelsWithNewVideos += 1;
      if (everyTabListed) {
        await this._rememberUnresolved(channel.channel_id, unlistedIds);
        if (membersKnown) await this._stamp(channel);
      }
    }
    return outcome;
  }

  async _rememberUnresolved(channelId, unlistedIds) {
    const stillMissing = await this._idsWithoutRows(channelId, unlistedIds);
    if (stillMissing.size === 0) return;
    const unresolved = this.unresolvedIds.get(channelId) || new Set();
    stillMissing.forEach((id) => unresolved.add(id));
    this.unresolvedIds.set(channelId, unresolved);
  }

  async _stamp(channel) {
    await Channel.update({ feed_checked_at: new Date() }, { where: { channel_id: channel.channel_id } });
  }

  _describe({
    channelsChecked, feedsUnavailable, feedFailures, membersFeedsUnavailable,
    channelsWithNewVideos, tabsRefreshed, tabsFailed, tabsDeferred, throttled,
  }) {
    const details = {
      channelsChecked, feedsUnavailable, membersFeedsUnavailable,
      channelsWithNewVideos, tabsRefreshed, tabsFailed, tabsDeferred,
    };
    if (feedsUnavailable > 0) details.feedFailures = feedFailures;
    const checked = `Checked ${counted(channelsChecked, 'channel')}.`;

    if (throttled) {
      return {
        status: 'error',
        outcome: 'partial',
        message: `${checked} YouTube rate-limited the listing after ${counted(tabsRefreshed, 'tab')}; the rest wait for the next run.`,
        details,
      };
    }

    const parts = [checked];
    parts.push(channelsWithNewVideos === 0
      ? 'No new videos.'
      : `${channelsWithNewVideos.toLocaleString()} had new videos (${counted(tabsRefreshed, 'tab')} refreshed).`);
    if (tabsFailed > 0) parts.push(`${counted(tabsFailed, 'tab listing')} failed.`);
    if (feedsUnavailable > 0) parts.push(`${counted(feedsUnavailable, 'feed')} unavailable.`);
    if (membersFeedsUnavailable > 0) {
      parts.push(`${counted(membersFeedsUnavailable, 'members-only feed')} unavailable.`);
    }
    if (tabsDeferred > 0) parts.push(`${counted(tabsDeferred, 'tab')} deferred to the next run.`);

    const partlyFailed = tabsFailed > 0;
    return {
      status: partlyFailed ? 'error' : 'success',
      outcome: partlyFailed ? 'partial' : 'completed',
      message: parts.join(' '),
      details,
    };
  }
}

module.exports = new ChannelFeedCheck();
