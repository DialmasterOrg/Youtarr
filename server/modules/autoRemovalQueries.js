const { injectReplacements } = require('sequelize/lib/utils/sql');
const { Video, JobVideo, Job, Channel } = require('../models');
const logger = require('../logger');
const watchStatusQueries = require('./mediaServers/watchStatusQueries');
const { STORED_BYTES_SQL } = require('./storageUsage');
const { TIME_CREATED_ATTRIBUTE } = require('./videosModule');

// Read-only candidate queries for auto-removal (the watched strategy and
// the keep-most-recent guard, including per-channel keep-recent); deletion itself stays in videoDeletionModule.
class AutoRemovalQueries {
  /**
   * Get the base options for Video.findAll to pick videos to be removed.
   */
  getBaseRemovalQueryOptions({ excludeIds = [], orderDirection = 'DESC', idOnly = false, joinChannel = true } = {}) {
    const { Sequelize, sequelize } = require('../db.js');

    const options = {
      attributes: [
        'id',
        [sequelize.fn('MAX', TIME_CREATED_ATTRIBUTE), 'timeCreated'],
      ],
      include: [{
        model: JobVideo,
        as: 'jobVideos',
        attributes: [],
        include: [{
          model: Job,
          as: 'job',
          attributes: [],
        }],
      }],
      where: {
        removed: false,
        protected: false,
      },
      group: sequelize.col('Video.id'),
      having: {
        timeCreated: {
          [Sequelize.Op.not]: null,
        },
      },
      order: [['timeCreated', orderDirection]],
      subQuery: false,
      raw: true,
    };

    if (excludeIds && excludeIds.length > 0) {
      options.where.id = {
        [Sequelize.Op.notIn]: excludeIds,
      };
    }

    if (!idOnly) {
      options.attributes.push(
        'youtubeId',
        'youTubeVideoName',
        'youTubeChannelName',
        [sequelize.literal(STORED_BYTES_SQL), 'fileSize'],
      );
    }

    if (joinChannel) {
      options.include.push({
        model: Channel,
        as: 'channel',
        attributes: [],
        on: {
          id: sequelize.col('Video.channel_id'),
          enabled: true,
        },
      });
      options.where[Sequelize.Op.and] = [
        sequelize.where(
          sequelize.fn('COALESCE', sequelize.col('channel.auto_removal_protected'), false),
          false,
        ),
      ];
    }

    return options;
  }

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

    try {
      const options = this.getBaseRemovalQueryOptions({
        idOnly: true,
      });
      options.limit = count;
      const rows = await Video.findAll(options);

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
    const { Sequelize } = require('../db.js');

    try {
      const channels = await Channel.findAll({
        attributes: [
          'channel_id',
          'auto_removal_keep_recent_count',
        ],
        where: {
          auto_removal_keep_recent_count: {
            [Sequelize.Op.gt]: 0
          },
          auto_removal_protected: false,
          enabled: true,
          channel_id: {
            [Sequelize.Op.not]: null,
          },
        },
      });

      const ids = [];
      for (const channel of channels) {
        const options = this.getBaseRemovalQueryOptions({
          idOnly: true,
          joinChannel: false,
        });
        options.where.channel_id = channel.channel_id;
        options.limit = channel.keepCount;
        const rows = await Video.findAll(options);
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
      const options = this.getBaseRemovalQueryOptions({
        excludeIds,
        orderDirection: 'ASC',
      });

      // The age filter uses the newest download time for multi-job videos,
      // so it's a HAVING on the MAX aggregate, not a per-row WHERE.
      if (minVideoAgeDays > 0) {
        options.having.timeCreated[Sequelize.Op.lt] = sequelize.fn(
          'DATE_SUB',
          sequelize.fn('NOW'),
          sequelize.literal(injectReplacements('INTERVAL ? DAY', sequelize.dialect, [minVideoAgeDays])),
        );
      }

      const watched = watchStatusQueries.buildWatchedEligibilitySql({
        minDaysSinceWatched,
        videosName: 'Video',
      });
      options.where[Sequelize.Op.and] ??= [];
      options.where[Sequelize.Op.and].push(sequelize.literal(injectReplacements(watched.sql, sequelize.dialect, watched.replacements)));
      
      const videos = await Video.findAll(options);

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
