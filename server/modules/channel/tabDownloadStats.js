const { QueryTypes } = require('sequelize');
const logger = require('../../logger');
const { sequelize } = require('../../db');
const Channel = require('../../models/channel');
const tabState = require('./tabState');
const tabVideoCounts = require('./tabVideoCounts');
const { MEDIA_TAB_TYPE_MAP } = require('../tabsUtils');

// Members-only videos are not in the UULF/UUSH/UULV totals, so they are left
// out of every count compared against those totals.
const MEMBERS_ONLY_AVAILABILITY = 'subscriber_only';

// Raw SQL: the downloaded count is a UNION over two attribution paths with a
// DISTINCT count per (channel, media type), for a whole page of channels in
// one query. A download belongs to channel C's tab through C's own listing
// row (which catches Topic/VEVO uploads credited to another channel id), or,
// when C has no listing row for it, through the video's own channel_id and
// media_type. Locally deleted videos (videos.removed) still count.
const DOWNLOADED_SQL = `
  SELECT x.channel_id, x.media_type, COUNT(DISTINCT x.youtube_id) AS downloaded
  FROM (
    SELECT cv.channel_id, cv.media_type, cv.youtube_id
    FROM channelvideos cv
    JOIN videos v ON v.youtube_id = cv.youtube_id
    WHERE cv.channel_id IN (:channelIds)
      AND cv.youtube_removed = 0
      AND v.youtube_removed = 0
      AND (cv.availability IS NULL OR cv.availability <> :membersOnly)
    UNION ALL
    SELECT v.channel_id, v.media_type, v.youtube_id
    FROM videos v
    WHERE v.channel_id IN (:channelIds)
      AND v.youtube_removed = 0
      AND NOT EXISTS (
        SELECT 1 FROM channelvideos cv
        WHERE cv.youtube_id = v.youtube_id AND cv.channel_id = v.channel_id
      )
  ) x
  GROUP BY x.channel_id, x.media_type
`;

// Public rows in each tab's listing, and those ignored without a download.
const LISTING_SQL = `
  SELECT cv.channel_id, cv.media_type,
    COUNT(DISTINCT cv.youtube_id) AS loaded,
    COUNT(DISTINCT CASE WHEN cv.ignored = 1 AND v.id IS NULL THEN cv.youtube_id END) AS ignored
  FROM channelvideos cv
  LEFT JOIN videos v ON v.youtube_id = cv.youtube_id
  WHERE cv.channel_id IN (:channelIds)
    AND cv.youtube_removed = 0
    AND (cv.availability IS NULL OR cv.availability <> :membersOnly)
  GROUP BY cv.channel_id, cv.media_type
`;

// The channel list shows no loaded count, and counting every listing row of a
// page of large channels is far slower than counting only the ignored ones.
const IGNORED_SQL = `
  SELECT cv.channel_id, cv.media_type, COUNT(DISTINCT cv.youtube_id) AS ignored
  FROM channelvideos cv
  LEFT JOIN videos v ON v.youtube_id = cv.youtube_id
  WHERE cv.channel_id IN (:channelIds)
    AND cv.ignored = 1
    AND v.id IS NULL
    AND cv.youtube_removed = 0
    AND (cv.availability IS NULL OR cv.availability <> :membersOnly)
  GROUP BY cv.channel_id, cv.media_type
`;

class TabDownloadStats {
  percentOf(downloaded, total) {
    if (!Number.isInteger(total) || total <= 0) return null;
    return Math.min(100, Math.floor((downloaded * 100) / total));
  }

  /**
   * Per-tab stats for each channel, keyed by channel_id.
   * @param {Array} channels - Channel rows
   * @param {{ includeLoaded?: boolean }} [options]
   * @returns {Promise<Map<string, Object>>}
   */
  async getForChannels(channels, { includeLoaded = false } = {}) {
    const result = new Map();
    const channelIds = channels.map((channel) => channel.channel_id).filter(Boolean);
    if (channelIds.length === 0) return result;

    const local = await this._queryLocalCounts(channelIds, includeLoaded);
    for (const channel of channels) {
      result.set(channel.channel_id, this._buildTabStats(channel, local.get(channel.channel_id) || {}, includeLoaded));
    }
    return result;
  }

  /**
   * Channel page stats: refreshes counts older than 24 hours first, and keeps
   * serving the stored counts if that refresh fails.
   * @param {string} channelId
   * @returns {Promise<{ channelId: string, tabs: Object } | null>}
   */
  async getChannelTabStats(channelId) {
    try {
      await tabVideoCounts.refreshChannel(channelId, { onlyIfStale: true });
    } catch (err) {
      logger.warn({ err, channelId }, 'Channel video count refresh failed');
    }
    const channel = await Channel.findOne({ where: { channel_id: channelId } });
    if (!channel) return null;
    const stats = await this.getForChannels([channel], { includeLoaded: true });
    return { channelId, tabs: stats.get(channelId) || {} };
  }

  async _queryLocalCounts(channelIds, includeLoaded) {
    const options = {
      replacements: { channelIds, membersOnly: MEMBERS_ONLY_AVAILABILITY },
      type: QueryTypes.SELECT,
    };
    const [downloadedRows, listingRows] = await Promise.all([
      sequelize.query(DOWNLOADED_SQL, options),
      sequelize.query(includeLoaded ? LISTING_SQL : IGNORED_SQL, options),
    ]);

    const local = new Map();
    const entryFor = (channelId, mediaType) => {
      if (!local.has(channelId)) local.set(channelId, {});
      const byMedia = local.get(channelId);
      if (!byMedia[mediaType]) byMedia[mediaType] = { downloaded: 0, ignored: 0, loaded: 0 };
      return byMedia[mediaType];
    };
    for (const row of downloadedRows) {
      entryFor(row.channel_id, row.media_type).downloaded = Number(row.downloaded) || 0;
    }
    for (const row of listingRows) {
      const entry = entryFor(row.channel_id, row.media_type);
      if (includeLoaded) entry.loaded = Number(row.loaded) || 0;
      entry.ignored = Number(row.ignored) || 0;
    }
    return local;
  }

  _buildTabStats(channel, localByMedia, includeLoaded) {
    const stored = tabVideoCounts.getStoredCounts(channel);
    const countable = new Set(tabVideoCounts.countableTabs(channel));
    const stats = {};

    for (const tab of tabState.computeEffectiveTabs(channel.available_tabs, channel.hidden_tabs)) {
      const mediaType = MEDIA_TAB_TYPE_MAP[tab];
      if (!mediaType) continue;
      const entry = countable.has(tab) ? stored[mediaType] : null;
      const total = entry && Number.isInteger(entry.total) ? entry.total : null;
      const counts = localByMedia[mediaType] || { downloaded: 0, ignored: 0, loaded: 0 };

      stats[tab] = {
        total,
        fetchedAt: total === null ? null : entry.fetchedAt,
        downloaded: counts.downloaded,
        ignored: counts.ignored,
        percent: this.percentOf(counts.downloaded, total),
      };
      if (includeLoaded) stats[tab].loaded = counts.loaded;
    }
    return stats;
  }
}

module.exports = new TabDownloadStats();
