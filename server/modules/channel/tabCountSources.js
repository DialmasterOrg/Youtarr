const logger = require('../../logger');
const youtubeApi = require('../youtubeApi');
const ytDlpRunner = require('../ytDlpRunner');
const YtdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
const createLimiter = require('../subscriptionImport/concurrencyLimiter');
const parseReportedCount = require('../parseReportedCount');
const { TAB_PLAYLIST_PREFIX, CHANNEL_ID_PATTERN } = require('../youtubeApi/constants');

const YTDLP_COUNT_TIMEOUT_MS = 60 * 1000;
// Each lookup is one short request; two at a time keeps a full refresh of a
// large subscription list from tripping YouTube's bot check.
const YTDLP_COUNT_CONCURRENCY = 2;
const PLAYLIST_MISSING_PATTERN = /The playlist does not exist/i;
const BOT_CHECK_CODE = 'COOKIES_REQUIRED';

function parsePlaylistCount(stdout) {
  return parseReportedCount(JSON.parse(stdout)?.playlist_count);
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

  /**
   * Look up item counts, through the YouTube API when a key is configured and
   * yt-dlp otherwise (or when the API call fails). A playlist missing from the
   * returned map failed its lookup; callers must not treat that as 0.
   * @param {string[]} playlistIds
   * @returns {Promise<{ counts: Map<string, number>, source: 'api'|'yt-dlp'|null }>}
   */
  async fetchCounts(playlistIds) {
    if (playlistIds.length === 0) return { counts: new Map(), source: null };

    if (youtubeApi.isAvailable()) {
      try {
        const counts = await youtubeApi.client.getPlaylistItemCounts(youtubeApi.getApiKey(), playlistIds);
        return { counts, source: 'api' };
      } catch (err) {
        // Only the code: the error's cause carries the request, including the key.
        logger.warn({ code: err.code, playlistCount: playlistIds.length }, 'YouTube API tab count lookup failed, falling back to yt-dlp');
      }
    }

    return { counts: await this._fetchCountsViaYtdlp(playlistIds), source: 'yt-dlp' };
  }

  async _fetchCountsViaYtdlp(playlistIds) {
    const counts = new Map();
    const limit = createLimiter(YTDLP_COUNT_CONCURRENCY);
    let botChecked = false;

    await Promise.all(playlistIds.map((playlistId) => limit(async () => {
      if (botChecked) return;
      try {
        counts.set(playlistId, await this._fetchCountViaYtdlp(playlistId));
      } catch (err) {
        if (err.code === BOT_CHECK_CODE) botChecked = true;
        // Never log err.message: it is yt-dlp's stderr, which can echo cookie lines.
        logger.warn({ playlistId, code: err.code }, 'yt-dlp tab count lookup failed');
      }
    })));

    if (botChecked) {
      logger.warn('YouTube bot check stopped the tab count refresh; configure cookies to count more channels');
    }
    return counts;
  }

  async _fetchCountViaYtdlp(playlistId) {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    const args = YtdlpCommandBuilder.buildMetadataFetchArgs(url, {
      flatPlaylist: true,
      playlistItems: '0',
      skipSleepRequests: true,
    });
    try {
      const count = parsePlaylistCount(await ytDlpRunner.run(args, { timeoutMs: YTDLP_COUNT_TIMEOUT_MS }));
      if (count === null) throw new Error('yt-dlp returned no playlist_count');
      return count;
    } catch (err) {
      // An empty tab has no auto-generated playlist at all.
      if (PLAYLIST_MISSING_PATTERN.test(err.message || '')) return 0;
      throw err;
    }
  }
}

module.exports = new TabCountSources();
