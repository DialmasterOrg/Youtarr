const logger = require('../../logger');

class TabState {
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
      SET lastFetchedByTab = JSON_SET(
        COALESCE(lastFetchedByTab, '{}'),
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
