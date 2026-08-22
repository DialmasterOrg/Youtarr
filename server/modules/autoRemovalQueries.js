const logger = require('../logger');
const watchStatusQueries = require('./mediaServers/watchStatusQueries');

// Matches the timeCreated calculation used by videosModule.js and the other
// auto-removal candidate queries in videoDeletionModule.js.
const DOWNLOAD_TIME_SQL =
  'COALESCE(Videos.last_downloaded_at, Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, \'%Y%m%d\'))';

// Read-only candidate queries for auto-removal (the watched strategy and
// the keep-most-recent guard, including per-channel keep-recent); deletion itself stays in videoDeletionModule.
class AutoRemovalQueries {
  /**
   * Ids of the N most recently downloaded videos (not marked removed).
   * Used as an exclusion set so auto-removal never touches the newest downloads.
   * Protected videos are excluded: they are already retained unconditionally,
   * so they never consume a keep-recent slot.
   * Errors propagate so callers can fail closed instead of deleting unguarded.
   * @param {number} count
   * @returns {Promise<number[]>}
   */
  async getRecentVideoIds(count) {
    if (!Number.isFinite(count) || count <= 0) {
      return [];
    }
    const { Sequelize, sequelize } = require('../db.js');

    try {
      const query = `
        SELECT Videos.id, MAX(${DOWNLOAD_TIME_SQL}) AS timeCreated
        FROM Videos
        LEFT JOIN JobVideos ON Videos.id = JobVideos.video_id
        LEFT JOIN Jobs ON Jobs.id = JobVideos.job_id
        LEFT JOIN channels AS ProtChannel ON ProtChannel.channel_id = Videos.channel_id AND ProtChannel.enabled = 1
        WHERE Videos.removed = 0
          AND Videos.protected = 0
          AND COALESCE(ProtChannel.auto_removal_protected, 0) = 0
        GROUP BY Videos.id
        HAVING timeCreated IS NOT NULL
        ORDER BY timeCreated DESC
        LIMIT :count
      `;

      const rows = await sequelize.query(query, {
        replacements: { count },
        type: Sequelize.QueryTypes.SELECT
      });

      return rows.map((row) => row.id);
    } catch (error) {
      logger.error({ err: error, count }, '[Auto-Removal] Error getting most recent video ids');
      throw error;
    }
  }

  /**
   * Per-channel keep-recent guard: for each enabled, unprotected channel with a
   * keep-recent count, the ids of its N most recently downloaded videos.
   * Protected videos never consume a slot, matching the global guard. Errors
   * propagate so callers can fail closed.
   * @returns {Promise<{channelCount: number, ids: number[]}>}
   */
  async getChannelKeepRecentIds() {
    const { Sequelize, sequelize } = require('../db.js');

    try {
      const channels = await sequelize.query(
        `SELECT channel_id, auto_removal_keep_recent_count AS keepCount
         FROM channels
         WHERE auto_removal_keep_recent_count > 0
           AND auto_removal_protected = 0
           AND enabled = 1
           AND channel_id IS NOT NULL`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      const ids = [];
      for (const channel of channels) {
        const query = `
          SELECT Videos.id, MAX(${DOWNLOAD_TIME_SQL}) AS timeCreated
          FROM Videos
          LEFT JOIN JobVideos ON Videos.id = JobVideos.video_id
          LEFT JOIN Jobs ON Jobs.id = JobVideos.job_id
          WHERE Videos.removed = 0
            AND Videos.protected = 0
            AND Videos.channel_id = :channelId
          GROUP BY Videos.id
          HAVING timeCreated IS NOT NULL
          ORDER BY timeCreated DESC
          LIMIT :count
        `;
        const rows = await sequelize.query(query, {
          replacements: { channelId: channel.channel_id, count: channel.keepCount },
          type: Sequelize.QueryTypes.SELECT
        });
        rows.forEach((row) => ids.push(row.id));
      }

      return { channelCount: channels.length, ids };
    } catch (error) {
      logger.error({ err: error }, '[Auto-Removal] Error getting per-channel keep-recent video ids');
      throw error;
    }
  }

  /**
   * Videos eligible for watched-based removal: watched per the configured
   * watch-status rule, optionally only if the newest qualifying watch is at
   * least minDaysSinceWatched days old and the download is at least
   * minVideoAgeDays days old. Videos with no watch data are never returned.
   * @param {object} [options]
   * @param {number} [options.minDaysSinceWatched=0]
   * @param {number} [options.minVideoAgeDays=0]
   * @param {number[]} [options.excludeIds=[]]
   * @returns {Promise<Array<{id:number,youtubeId:string,youTubeVideoName:string,youTubeChannelName:string,fileSize:string,timeCreated:Date}>>}
   */
  async getWatchedRemovalCandidates({ minDaysSinceWatched = 0, minVideoAgeDays = 0, excludeIds = [] } = {}) {
    const { Sequelize, sequelize } = require('../db.js');

    try {
      const watched = watchStatusQueries.buildWatchedEligibilitySql({ minDaysSinceWatched });
      const replacements = { ...watched.replacements };

      // The age filter uses the newest download time for multi-job videos,
      // so it's a HAVING on the MAX aggregate, not a per-row WHERE.
      let havingClause = '';
      if (minVideoAgeDays > 0) {
        havingClause = `        HAVING timeCreated IS NOT NULL
          AND timeCreated < DATE_SUB(NOW(), INTERVAL :minVideoAgeDays DAY)
`;
        replacements.minVideoAgeDays = minVideoAgeDays;
      }

      let excludeClause = '';
      if (excludeIds.length > 0) {
        excludeClause = '          AND Videos.id NOT IN (:excludeIds)\n';
        replacements.excludeIds = excludeIds;
      }

      const query = `
        SELECT
          Videos.id,
          Videos.youtubeId,
          Videos.youTubeVideoName,
          Videos.youTubeChannelName,
          Videos.fileSize,
          MAX(${DOWNLOAD_TIME_SQL}) AS timeCreated
        FROM Videos
        LEFT JOIN JobVideos ON Videos.id = JobVideos.video_id
        LEFT JOIN Jobs ON Jobs.id = JobVideos.job_id
        LEFT JOIN channels AS ProtChannel ON ProtChannel.channel_id = Videos.channel_id AND ProtChannel.enabled = 1
        WHERE Videos.removed = 0
          AND Videos.protected = 0
          AND COALESCE(ProtChannel.auto_removal_protected, 0) = 0
          AND ${watched.sql}
${excludeClause}        GROUP BY Videos.id
${havingClause}        ORDER BY timeCreated ASC
      `;

      const videos = await sequelize.query(query, {
        replacements,
        type: Sequelize.QueryTypes.SELECT
      });

      logger.info(
        { count: videos.length, minDaysSinceWatched, minVideoAgeDays },
        '[Auto-Removal] Found watched videos eligible for removal'
      );
      return videos;
    } catch (error) {
      logger.error({ err: error }, '[Auto-Removal] Error getting watched removal candidates');
      return [];
    }
  }
}

module.exports = new AutoRemovalQueries();
