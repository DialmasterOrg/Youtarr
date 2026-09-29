const logger = require('../../logger');
const youtubeApi = require('../youtubeApi');
const ytDlpRunner = require('../ytDlpRunner');
const YtdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
const createLimiter = require('../subscriptionImport/concurrencyLimiter');
const parseReportedCount = require('../parseReportedCount');
const { TAB_PLAYLIST_PREFIX, CHANNEL_ID_PATTERN } = require('../youtubeApi/constants');

const YTDLP_COUNT_TIMEOUT_MS = 60 * 1000;
// Opening a channel page counts at most three tabs; two at a time keeps the
// page quick without a burst.
const ON_DEMAND_CONCURRENCY = 2;
// Bulk lookups run one at a time with this gap between them. yt-dlp's
// --sleep-requests only spaces the requests inside one process (a lookup is
// a page plus one API call), never the gap before the next process.
const BULK_LOOKUP_DELAY_MS = 3 * 1000;
// Unexplained failures in a row that end a bulk run early (without the
// throttle backoff), since YouTube is likely struggling or the network is down.
const MAX_CONSECUTIVE_FAILURES = 3;
const PLAYLIST_MISSING_PATTERN = /The playlist does not exist/i;
const RATE_LIMIT_PATTERN = /HTTP Error 429|Too Many Requests|rate-limited|try again later/i;
// Failures that belong to one channel and say nothing about YouTube's mood.
const UNAVAILABLE_PATTERN = /account has been terminated|channel does not exist|channel is not available|playlist type is unviewable/i;
const BOT_CHECK_CODE = 'COOKIES_REQUIRED';

const FAILURE = {
  BOT_CHECK: 'bot-check',
  RATE_LIMIT: 'rate-limit',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
};
const THROTTLE_FAILURES = new Set([FAILURE.BOT_CHECK, FAILURE.RATE_LIMIT]);
const STOPPED_AFTER_FAILURES = 'failures';

function parsePlaylistCount(stdout) {
  return parseReportedCount(JSON.parse(stdout)?.playlist_count);
}

function classifyFailure(err) {
  if (err.code === BOT_CHECK_CODE) return FAILURE.BOT_CHECK;
  const message = err.message || '';
  if (RATE_LIMIT_PATTERN.test(message)) return FAILURE.RATE_LIMIT;
  if (UNAVAILABLE_PATTERN.test(message)) return FAILURE.UNAVAILABLE;
  return FAILURE.ERROR;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TabCountSources {
  /**
   * The auto-generated playlist that mirrors a channel tab, or null when the
   * channel id or tab cannot have one.
   * @param {string} channelId
   * @param {string} tabType - 'videos' | 'shorts' | 'streams'
   * @returns {string|null}
   */
  tabPlaylistId(channelId, tabType) {
    const prefix = TAB_PLAYLIST_PREFIX[tabType];
    if (!prefix || typeof channelId !== 'string' || !CHANNEL_ID_PATTERN.test(channelId)) {
      return null;
    }
    return `${prefix}${channelId.slice(2)}`;
  }

  isApiAvailable() {
    return youtubeApi.isAvailable();
  }

  /**
   * Item counts through the YouTube API, 50 playlists per request.
   * @param {string[]} playlistIds
   * @returns {Promise<Map<string, number>|null>} null when no key is
   *   configured or the call failed
   */
  async fetchCountsViaApi(playlistIds) {
    if (!youtubeApi.isAvailable()) return null;
    if (playlistIds.length === 0) return new Map();
    try {
      return await youtubeApi.client.getPlaylistItemCounts(youtubeApi.getApiKey(), playlistIds);
    } catch (err) {
      // Only the code: the error's cause carries the request, including the key.
      logger.warn({ code: err.code, playlistCount: playlistIds.length }, 'YouTube API tab count lookup failed, falling back to yt-dlp');
      return null;
    }
  }

  /**
   * One channel's counts on demand (subscribe, channel page) through yt-dlp,
   * with cookies, two at a time. A bot check or rate limit stops the lookups
   * that have not started. A playlist missing from the returned map failed
   * its lookup; callers must not treat that as 0.
   * @param {string[]} playlistIds
   * @returns {Promise<{ counts: Map<string, number>, throttle: 'bot-check'|'rate-limit'|null }>}
   */
  async fetchCountsViaYtdlp(playlistIds) {
    const counts = new Map();
    const limit = createLimiter(ON_DEMAND_CONCURRENCY);
    let throttle = null;
    await Promise.all(playlistIds.map((playlistId) => limit(async () => {
      if (throttle) return;
      const result = await this._lookup(playlistId, { paced: false, withCookies: true });
      if (result.failure) {
        if (THROTTLE_FAILURES.has(result.failure)) throttle = result.failure;
        return;
      }
      counts.set(playlistId, result.count);
    })));
    return { counts, throttle };
  }

  /**
   * Bulk yt-dlp lookups: one at a time and paced, without cookies unless the
   * caller has switched bulk runs to cookies (an IP that is always
   * bot-checked without them). Each channel is handed back as soon as its
   * tabs are done so its counts are saved before the next one starts.
   * @param {Array<{ tabs: Array<{ playlistId: string }> }>} plans
   * @param {Object} options
   * @param {boolean} [options.withCookies=false]
   * @param {Function} options.onChannelStart - onChannelStart(plan), before its first lookup
   * @param {Function} options.onChannelDone - onChannelDone(plan, counts) with the tabs counted
   * @param {Function} [options.stopBeforeChannel] - resolves a stop reason or
   *   null; checked between channels, so a stop never leaves one half counted
   * @param {Function} [options.stopBeforeLookup] - resolves a stop reason or
   *   null; checked before every lookup
   * @returns {Promise<{ stopReason: string|null }>} 'bot-check', 'rate-limit',
   *   'failures', a reason from a stop hook, or null
   */
  async lookupChannelsPaced(plans, {
    withCookies = false,
    onChannelStart,
    onChannelDone,
    stopBeforeChannel = async () => null,
    stopBeforeLookup = async () => null,
  }) {
    let consecutiveFailures = 0;
    let lookups = 0;

    for (const plan of plans) {
      const channelStop = await stopBeforeChannel();
      if (channelStop) return { stopReason: channelStop };

      const counts = new Map();
      let started = false;
      let stopReason = null;

      for (const { playlistId } of plan.tabs) {
        if (lookups > 0) await delay(BULK_LOOKUP_DELAY_MS);
        const lookupStop = await stopBeforeLookup();
        if (lookupStop) {
          stopReason = lookupStop;
          break;
        }
        if (!started) {
          await onChannelStart(plan);
          started = true;
        }
        lookups += 1;
        const result = await this._lookup(playlistId, { paced: true, withCookies });
        if (!result.failure) {
          counts.set(playlistId, result.count);
          consecutiveFailures = 0;
          continue;
        }
        if (THROTTLE_FAILURES.has(result.failure)) {
          stopReason = result.failure;
          break;
        }
        if (result.failure === FAILURE.ERROR) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            stopReason = STOPPED_AFTER_FAILURES;
            break;
          }
        }
      }

      if (started) await onChannelDone(plan, counts);
      if (stopReason) return { stopReason };
    }
    return { stopReason: null };
  }

  /**
   * @returns {Promise<{ count: number } | { failure: string }>}
   */
  async _lookup(playlistId, { paced, withCookies }) {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    const args = YtdlpCommandBuilder.buildMetadataFetchArgs(url, {
      flatPlaylist: true,
      playlistItems: '0',
      skipSleepRequests: !paced,
      cookiesEnabled: withCookies,
    });
    try {
      const count = parsePlaylistCount(await ytDlpRunner.run(args, { timeoutMs: YTDLP_COUNT_TIMEOUT_MS }));
      if (count === null) {
        logger.warn({ playlistId }, 'yt-dlp returned no tab count');
        return { failure: FAILURE.ERROR };
      }
      return { count };
    } catch (err) {
      // An empty tab has no auto-generated playlist at all.
      if (PLAYLIST_MISSING_PATTERN.test(err.message || '')) return { count: 0 };
      const failure = classifyFailure(err);
      // Never log err.message: it is yt-dlp's stderr, which can echo cookie lines.
      logger.warn({ playlistId, code: err.code, failure }, 'yt-dlp tab count lookup failed');
      return { failure };
    }
  }
}

const tabCountSources = new TabCountSources();
tabCountSources.STOPPED_AFTER_FAILURES = STOPPED_AFTER_FAILURES;

module.exports = tabCountSources;
