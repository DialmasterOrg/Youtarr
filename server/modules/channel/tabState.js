const logger = require('../../logger');

// A real yt-dlp listing of a tab counts as fresh for this long.
const REAL_LISTING_FRESH_MS = 60 * 60 * 1000;
// A feed check that found nothing unlisted stands in for a real listing for this long.
const FEED_CHECK_FRESH_MS = 90 * 60 * 1000;
// Feeds cannot show title changes or ended live streams, so a real listing
// is forced once the last one is this old.
const REAL_LISTING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const REFRESH_NEED = Object.freeze({
  NONE: 'none',
  BLOCKING: 'blocking',
  BACKGROUND: 'background',
});

class TabState {
  /**
   * Decide whether a channel tab needs a yt-dlp listing before, or after,
   * its stored rows are served.
   * @param {Object|null} channel - Channel database record
   * @param {string} mediaType - Media type: 'video', 'short', or 'livestream'
   * @param {Object} options
   * @param {number} options.rowCount - Stored rows for the tab (0 means none)
   * @param {boolean} [options.hasLiveRows] - The page being served has a live or upcoming row
   * @param {number} [options.now] - Current time in ms
   * @returns {string} 'none', 'blocking' (nothing useful to show yet) or 'background'
   */
  getRefreshNeed(channel, mediaType, { rowCount, hasLiveRows = false, now = Date.now() }) {
    if (!channel) return REFRESH_NEED.NONE;

    const lastListed = this.getLastFetchedForTab(channel, mediaType);
    if (rowCount === 0 || !lastListed) return REFRESH_NEED.BLOCKING;
    if (channel.terminated_at) return REFRESH_NEED.BACKGROUND;

    const listingAge = now - lastListed.getTime();
    if (listingAge > REAL_LISTING_MAX_AGE_MS) return REFRESH_NEED.BACKGROUND;
    if (listingAge <= REAL_LISTING_FRESH_MS) return REFRESH_NEED.NONE;
    if (hasLiveRows) return REFRESH_NEED.BACKGROUND;

    const feedCheckedAt = channel.feed_checked_at ? new Date(channel.feed_checked_at).getTime() : null;
    const feedIsFresh = Number.isFinite(feedCheckedAt) && now - feedCheckedAt <= FEED_CHECK_FRESH_MS;
    return feedIsFresh ? REFRESH_NEED.NONE : REFRESH_NEED.BACKGROUND;
  }

  /**
   * Get the last fetched timestamp for a specific tab type
   * @param {Object} channel - Channel database record
   * @param {string} mediaType - Media type: 'video', 'short', or 'livestream'
   * @returns {Date|null} - Last fetched timestamp for the tab, or null if never fetched
   */
  getLastFetchedForTab(channel, mediaType) {
    if (!channel || !channel.lastFetchedByTab) {
      return null;
    }

    try {
      const lastFetchedByTab = JSON.parse(channel.lastFetchedByTab);
      const timestamp = lastFetchedByTab[mediaType];
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      logger.error({ err: error, channelId: channel?.channel_id, mediaType }, 'Error parsing lastFetchedByTab');
      return null;
    }
  }

  /**
   * Compute the "effective" available tabs for a channel by removing any
   * user-hidden tabs from the detected list.
   * @param {string|null} availableTabsCsv - Comma-separated list of detected tab types
   * @param {string|null} hiddenTabsCsv - Comma-separated list of user-hidden tab types
   * @returns {string[]} - Effective (detected minus hidden) tab types
   */
  computeEffectiveTabs(availableTabsCsv, hiddenTabsCsv) {
    if (!availableTabsCsv) return [];

    const detected = availableTabsCsv
      .split(',')
      .map((tab) => tab.trim())
      .filter((tab) => tab.length > 0);

    if (!hiddenTabsCsv) return detected;

    const hidden = new Set(
      hiddenTabsCsv
        .split(',')
        .map((tab) => tab.trim())
        .filter((tab) => tab.length > 0)
    );

    return detected.filter((tab) => !hidden.has(tab));
  }

  /**
   * Set the last fetched timestamp for a specific tab type
   * Uses atomic SQL UPDATE to prevent race conditions when multiple tabs fetch concurrently
   * @param {Object} channel - Channel database record
   * @param {string} mediaType - Media type: 'video', 'short', or 'livestream'
   * @param {Date} timestamp - Timestamp to set
   * @returns {Promise<void>}
   */
  async setLastFetchedForTab(channel, mediaType, timestamp) {
    if (!channel || !channel.channel_id) return;

    const { sequelize } = require('../../db');

    // Use atomic JSON_SET to update just this one key without read-modify-write race
    // COALESCE handles the case where lastFetchedByTab is NULL
    await sequelize.query(`
      UPDATE channels
      SET last_fetched_by_tab = JSON_SET(
        COALESCE(last_fetched_by_tab, '{}'),
        :jsonPath,
        :timestamp
      )
      WHERE channel_id = :channelId
    `, {
      replacements: {
        jsonPath: `$.${mediaType}`,
        timestamp: timestamp.toISOString(),
        channelId: channel.channel_id
      }
    });

    // Reload channel to sync in-memory state with database
    await channel.reload();
  }
}

module.exports = new TabState();
module.exports.REFRESH_NEED = REFRESH_NEED;
module.exports.REAL_LISTING_FRESH_MS = REAL_LISTING_FRESH_MS;
module.exports.FEED_CHECK_FRESH_MS = FEED_CHECK_FRESH_MS;
module.exports.REAL_LISTING_MAX_AGE_MS = REAL_LISTING_MAX_AGE_MS;
