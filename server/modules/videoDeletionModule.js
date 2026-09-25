const { Video } = require('../models');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');
const { isVideoDirectory, cleanupEmptyChannelDirectory, cleanupEmptyParents, isSubfolderDir, listSubdirectories, removeDirectoryResilient } = require('./filesystem');
const m3uGenerator = require('./m3uGenerator');
const storageUsage = require('./storageUsage');
const { STORED_BYTES_SQL } = storageUsage;
const storageGuard = require('./storageGuard');

// Oldest-first removal (free-space and total-usage strategies) works in
// batches and stops after a bounded number of them per run.
const OLDEST_FIRST_BATCH_SIZE = 50;
const OLDEST_FIRST_MAX_BATCHES = 10;
const PLAN_SAMPLE_LIMIT = 10;

class VideoDeletionModule {
  constructor() {}

  /**
   * Determine if a video's file path indicates flat structure (no video subfolder)
   * In nested mode, the parent directory name ends with " - <youtubeId>"
   * In flat mode, the video file sits directly in the channel folder
   * @param {string} filePath - Full path to the video file
   * @returns {boolean} - True if flat structure
   */
  isFlat(filePath) {
    const parentDir = path.dirname(filePath);
    // If the parent directory looks like a video directory (ends with " - youtubeId"),
    // then this is nested mode. Otherwise, it's flat mode.
    return !isVideoDirectory(parentDir);
  }

  /**
   * Prepare minimal video metadata for dry-run responses
   * @param {object} video
   * @returns {{id:number,youtubeId:string,title:string,channel:string,fileSize:number,timeCreated:Date}}
   */
  formatVideoForPlan(video) {
    return {
      id: video.id,
      youtubeId: video.youtubeId,
      title: video.youTubeVideoName,
      channel: video.youTubeChannelName,
      fileSize: parseInt(video.fileSize) || 0,
      timeCreated: video.timeCreated
    };
  }

  /**
   * Parse a config value as a positive integer, treating anything absent or
   * invalid (older configs won't have the newer auto-removal fields) as 0.
   * @param {*} value
   * @returns {number}
   */
  _parsePositiveInt(value) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? 0 : parsed;
  }

  /**
   * Attempt to clean up an empty channel directory after video deletion
   * Best-effort: errors are logged as warnings and do not propagate
   * @param {string} filePath - The deleted video's file path
   * @param {boolean} flat - Whether the video used flat directory structure
   * @private
   */
  async _tryCleanupChannelDirectory(filePath, flat) {
    try {
      const configModule = require('./configModule');
      const baseDir = configModule.directoryPath;

      // Derive channel directory:
      //   Nested: grandparent of filePath (filePath -> videoDir -> channelDir)
      //   Flat: parent of filePath (filePath -> channelDir)
      const channelDir = flat
        ? path.dirname(filePath)
        : path.dirname(path.dirname(filePath));

      const removed = await cleanupEmptyChannelDirectory(channelDir, baseDir, {
        includeIgnorableFiles: true
      });

      if (removed) {
        // Clean up empty subfolder parent (e.g., /base/__subfolder/ now empty)
        await cleanupEmptyParents(path.dirname(channelDir), baseDir);
      }
    } catch (error) {
      logger.warn({ err: error, filePath }, 'Error during channel directory cleanup (non-fatal)');
    }
  }

  /**
   * Delete a single video by ID
   * Deletes the video directory from disk and marks the video as removed in the database
   * @param {number} videoId - The database ID of the video to delete
   * @returns {Promise<{success: boolean, videoId: number, error?: string}>}
   */
  async deleteVideoById(videoId) {
    try {
      // Fetch video from database
      const video = await Video.findByPk(videoId);

      if (!video) {
        return {
          success: false,
          videoId,
          error: 'Video not found in database'
        };
      }

      // Check if video is already marked as removed
      if (video.removed) {
        return {
          success: false,
          videoId,
          error: 'Video is already marked as removed'
        };
      }

      // Audio-only (MP3) downloads have no video filePath; their files live
      // at audioFilePath and must be deleted the same way.
      const primaryPath = video.filePath || video.audioFilePath;

      if (!primaryPath) {
        // No file path, just mark as removed in database
        await video.update({ removed: true });
        return {
          success: true,
          videoId,
          channelId: video.channel_id,
          message: 'Video marked as removed (no file path)'
        };
      }

      // Get the video directory path
      // Nested: filePath = /path/to/channel/channel - title - id/video.mp4
      // Flat:   filePath = /path/to/channel/video.mp4
      const videoDirectory = path.dirname(primaryPath);
      const flat = this.isFlat(primaryPath);

      // Safety check: ensure the path contains the youtube ID
      // This prevents accidentally deleting the wrong files
      if (!primaryPath.includes(video.youtubeId)) {
        logger.error({ videoId, filePath: primaryPath, youtubeId: video.youtubeId }, 'Safety check failed: file path doesn\'t contain youtube ID');
        return {
          success: false,
          videoId,
          error: 'Safety check failed: invalid file path'
        };
      }

      // Delete the video files
      try {
        if (flat) {
          // Flat structure: delete only files matching this video's youtube ID
          // NEVER delete the directory itself (it's the channel folder containing other videos)
          logger.info({ videoId, videoDirectory, youtubeId: video.youtubeId }, 'Flat structure detected, deleting individual files');
          const files = await fs.readdir(videoDirectory);
          for (const file of files) {
            // Match files by YouTube ID: bracketed form [ID] is the yt-dlp default;
            // dash form " - ID" is a fallback for non-standard naming patterns
            if (file.includes(`[${video.youtubeId}]`) || file.includes(` - ${video.youtubeId}`)) {
              const fullPath = path.join(videoDirectory, file);
              try {
                await fs.unlink(fullPath);
                logger.info({ videoId, file }, 'Deleted video file (flat mode)');
              } catch (unlinkErr) {
                if (unlinkErr.code !== 'ENOENT') {
                  logger.error({ videoId, file, err: unlinkErr }, 'Failed to delete file (flat mode)');
                }
              }
            }
          }
        } else {
          // Nested structure: delete the entire video directory.
          // Uses the resilient remover so SMB AppleDouble race conditions
          // don't strand the directory with an ENOTEMPTY error (issue #370).
          await removeDirectoryResilient(videoDirectory);
          logger.info({ videoId, videoDirectory }, 'Deleted video directory');
        }
      } catch (fsError) {
        if (fsError.code === 'ENOENT') {
          // Directory/files already gone; treat as success but still mark removed in DB
          logger.info({ videoId, videoDirectory, error: fsError.message }, 'Files already removed');
        } else {
          logger.error({ videoId, videoDirectory, err: fsError }, 'Failed to delete video files');
          return {
            success: false,
            videoId,
            error: 'Failed to delete video files from disk. Please check filesystem permissions.'
          };
        }
      }

      // Mark video as removed in database
      await video.update({ removed: true });

      // Best-effort cleanup of empty channel directory
      await this._tryCleanupChannelDirectory(primaryPath, flat);

      return {
        success: true,
        videoId,
        channelId: video.channel_id,
        message: 'Video deleted successfully'
      };
    } catch (error) {
      logger.error({ videoId, err: error }, 'Error deleting video');
      return {
        success: false,
        videoId,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete multiple videos
   * @param {number[]} videoIds - Array of video IDs to delete
   * @returns {Promise<{success: boolean, deleted: number[], failed: Array<{videoId: number, error: string}>}>}
   */
  async deleteVideos(videoIds) {
    const deleted = [];
    const failed = [];
    const affectedChannelIds = [];

    // Process deletions sequentially to avoid overwhelming the file system
    for (const videoId of videoIds) {
      const result = await this.deleteVideoById(videoId);

      if (result.success) {
        deleted.push(videoId);
        affectedChannelIds.push(result.channelId);
      } else {
        failed.push({
          videoId,
          error: result.error || 'Unknown error'
        });
      }
    }

    this._regenerateM3usForChannels(affectedChannelIds);
    if (deleted.length > 0) this._refreshDownloadPauseIfPaused();

    return {
      success: failed.length === 0,
      deleted,
      failed
    };
  }

  /**
   * Delete videos by YouTube IDs
   * @param {string[]} youtubeIds - Array of YouTube video IDs
   * @returns {Promise<{success: boolean, deleted: string[], failed: Array<{youtubeId: string, error: string}>}>}
   */
  async deleteVideosByYoutubeIds(youtubeIds) {
    const deleted = [];
    const failed = [];
    const affectedChannelIds = [];

    for (const youtubeId of youtubeIds) {
      try {
        // Find the video by YouTube ID
        const video = await Video.findOne({
          where: { youtubeId: youtubeId }
        });

        if (!video) {
          failed.push({
            youtubeId,
            error: 'Video not found in database'
          });
          continue;
        }

        // Delete using the database ID
        const result = await this.deleteVideoById(video.id);

        if (result.success) {
          deleted.push(youtubeId);
          affectedChannelIds.push(result.channelId);
        } else {
          failed.push({
            youtubeId,
            error: result.error || 'Unknown error'
          });
        }
      } catch (error) {
        failed.push({
          youtubeId,
          error: error.message || 'Unknown error occurred'
        });
      }
    }

    this._regenerateM3usForChannels(affectedChannelIds);
    if (deleted.length > 0) this._refreshDownloadPauseIfPaused();

    return {
      success: failed.length === 0,
      deleted,
      failed
    };
  }

  /**
   * Deletions shrink the downloaded total, so re-check a storage pause right
   * away instead of waiting for the next download request or periodic check.
   * @private
   */
  _refreshDownloadPauseIfPaused() {
    if (!storageGuard.getStatus().paused) return;
    storageGuard.refresh().catch((err) => {
      logger.error({ err }, 'Failed to re-check the download pause state after deleting videos');
    });
  }

  /**
   * Regenerate the channel .m3u playlist for each affected channel, deduped.
   * @param {Array<string|undefined>} channelIds
   */
  _regenerateM3usForChannels(channelIds) {
    const unique = [...new Set((channelIds || []).filter(Boolean))];
    for (const channelId of unique) {
      m3uGenerator.generateChannelM3UInBackground(channelId, 'video-deletion');
    }
  }

  /**
   * Get videos older than the specified threshold
   * Uses the same timeCreated calculation as videosModule.js
   * @param {number} ageInDays - Age threshold in days
   * @returns {Promise<Array<{id: number, youtubeId: string, youTubeVideoName: string, timeCreated: Date, fileSize: number}>>}
   */
  async getVideosOlderThanThreshold(ageInDays, excludeIds = []) {
    const { Sequelize, sequelize } = require('../db.js');

    try {
      const excludeClause = excludeIds && excludeIds.length > 0
        ? '          AND videos.id NOT IN (:excludeIds)\n'
        : '';

      // Use raw SQL query to match the timeCreated calculation in videosModule.js
      const query = `
        SELECT DISTINCT
          videos.id,
          videos.youtube_id AS "youtubeId",
          videos.youtube_video_name AS "youTubeVideoName",
          videos.youtube_channel_name AS "youTubeChannelName",
          ${STORED_BYTES_SQL} AS "fileSize",
          COALESCE(videos.last_downloaded_at, jobs.time_created, STR_TO_DATE(videos.original_date, '%Y%m%d')) AS timeCreated
        FROM videos
        LEFT JOIN jobvideos ON videos.id = jobvideos.video_id
        LEFT JOIN jobs ON jobs.id = jobvideos.job_id
        LEFT JOIN channels AS protchannel ON protchannel.channel_id = videos.channel_id AND protchannel.enabled = 1
        WHERE videos.removed = 0
          AND videos.protected = 0
          AND COALESCE(protchannel.auto_removal_protected, 0) = 0
          AND COALESCE(videos.last_downloaded_at, jobs.time_created, STR_TO_DATE(videos.original_date, '%Y%m%d')) IS NOT NULL
          AND COALESCE(videos.last_downloaded_at, jobs.time_created, STR_TO_DATE(videos.original_date, '%Y%m%d')) < DATE_SUB(NOW(), INTERVAL :ageInDays DAY)
${excludeClause}        ORDER BY timeCreated ASC
      `;

      const replacements = { ageInDays };
      if (excludeIds && excludeIds.length > 0) {
        replacements.excludeIds = excludeIds;
      }

      const videos = await sequelize.query(query, {
        replacements,
        type: Sequelize.QueryTypes.SELECT
      });

      logger.info({ count: videos.length, ageInDays }, '[Auto-Removal] Found videos older than threshold');
      return videos;
    } catch (error) {
      logger.error({ err: error }, 'Error getting videos older than threshold');
      return [];
    }
  }

  /**
   * Get the oldest N videos
   * Used for freeing up space when storage is low
   * @param {number} limit - Maximum number of videos to return
   * @returns {Promise<Array<{id: number, youtubeId: string, youTubeVideoName: string, timeCreated: Date, fileSize: number}>>}
   */
  async getOldestVideos(limit, excludeIds = []) {
    const { Sequelize, sequelize } = require('../db.js');

    try {
      const excludeClause = excludeIds && excludeIds.length > 0
        ? '          AND videos.id NOT IN (:excludeIds)\n'
        : '';

      const query = `
        SELECT DISTINCT
          videos.id,
          videos.youtube_id AS "youtubeId",
          videos.youtube_video_name AS "youTubeVideoName",
          videos.youtube_channel_name AS "youTubeChannelName",
          ${STORED_BYTES_SQL} AS "fileSize",
          COALESCE(videos.last_downloaded_at, jobs.time_created, STR_TO_DATE(videos.original_date, '%Y%m%d')) AS timeCreated
        FROM videos
        LEFT JOIN jobvideos ON videos.id = jobvideos.video_id
        LEFT JOIN jobs ON jobs.id = jobvideos.job_id
        LEFT JOIN channels AS protchannel ON protchannel.channel_id = videos.channel_id AND protchannel.enabled = 1
        WHERE videos.removed = 0
          AND videos.protected = 0
          AND COALESCE(protchannel.auto_removal_protected, 0) = 0
          AND COALESCE(videos.last_downloaded_at, jobs.time_created, STR_TO_DATE(videos.original_date, '%Y%m%d')) IS NOT NULL
${excludeClause}        ORDER BY timeCreated ASC
        LIMIT :limit
      `;

      const replacements = { limit };
      if (excludeIds && excludeIds.length > 0) {
        replacements.excludeIds = excludeIds;
      }

      const videos = await sequelize.query(query, {
        replacements,
        type: Sequelize.QueryTypes.SELECT
      });

      logger.info({ count: videos.length, limit }, '[Auto-Removal] Found oldest videos');
      return videos;
    } catch (error) {
      logger.error({ err: error }, 'Error getting oldest videos');
      return [];
    }
  }

  /**
   * Scan the output directory for orphan empty channel directories and remove them.
   * Unlike _tryCleanupChannelDirectory (which only runs after a video deletion), this
   * proactively finds directories that are already empty (or contain only ignorable files
   * like poster.jpg) and cleans them up. Handles both root-level and subfolder-level channels.
   * @returns {Promise<{removed: string[], errors: string[]}>}
   */
  async cleanupOrphanDirectories() {
    const configModule = require('./configModule');
    const baseDir = configModule.directoryPath;
    const removed = [];
    const errors = [];

    if (!baseDir) {
      logger.debug('[Orphan Cleanup] No output directory configured, skipping');
      return { removed, errors };
    }

    try {
      const topLevelDirs = await listSubdirectories(baseDir);

      for (const dir of topLevelDirs) {
        const dirName = path.basename(dir);

        if (isSubfolderDir(dirName)) {
          // Subfolder directory (e.g., __Music) — check its children as channel dirs
          try {
            const channelDirs = await listSubdirectories(dir);
            for (const channelDir of channelDirs) {
              const wasRemoved = await cleanupEmptyChannelDirectory(channelDir, baseDir, {
                includeIgnorableFiles: true
              });
              if (wasRemoved) {
                removed.push(channelDir);
              }
            }
            // Clean up the subfolder itself if it's now empty
            await cleanupEmptyParents(dir, baseDir);
          } catch (dirError) {
            logger.warn({ err: dirError, dir }, '[Orphan Cleanup] Error processing subfolder directory');
            errors.push(dirError.message);
          }
        } else {
          // Root-level channel directory
          const wasRemoved = await cleanupEmptyChannelDirectory(dir, baseDir, {
            includeIgnorableFiles: true
          });
          if (wasRemoved) {
            removed.push(dir);
          }
        }
      }

      if (removed.length > 0) {
        logger.info({ count: removed.length, directories: removed }, '[Orphan Cleanup] Removed empty channel directories');
      } else {
        logger.debug('[Orphan Cleanup] No orphan directories found');
      }
    } catch (error) {
      logger.error({ err: error }, '[Orphan Cleanup] Error scanning for orphan directories');
      errors.push(error.message);
    }

    return { removed, errors };
  }

  /**
   * Remove the oldest removable videos until at least bytesToFree bytes are
   * accounted for. Shared by the free-space and total-usage strategies. In a
   * dry run nothing is deleted and every selected video counts as freed.
   * Each video tried is excluded from later batches, so a video that fails to
   * delete is not retried over and over within one run.
   * @param {object} options
   * @param {number} options.bytesToFree
   * @param {number[]} options.excludeIds - Guarded (and, in dry runs, already-claimed) ids
   * @param {object} options.bucket - The strategy's entry in result.plan
   * @param {string} options.deletedKey - Result counter to increment, e.g. 'deletedBySpace'
   * @param {string} options.label - Strategy name for log messages
   * @param {boolean} options.dryRun
   * @param {boolean} options.includeSamples
   * @param {object} options.result - The cleanup result being built
   * @returns {Promise<{selectedIds: number[]}>}
   * @private
   */
  async _removeOldestUntilFreed({ bytesToFree, excludeIds, bucket, deletedKey, label, dryRun, includeSamples, result }) {
    const triedIds = new Set();
    const affectedChannelIds = [];
    let freedSoFar = 0;
    let iterations = 0;

    const addSample = (video) => {
      if (includeSamples && bucket.sampleVideos.length < PLAN_SAMPLE_LIMIT) {
        bucket.sampleVideos.push(this.formatVideoForPlan(video));
      }
    };

    while (freedSoFar < bytesToFree && iterations < OLDEST_FIRST_MAX_BATCHES) {
      const oldestVideos = await this.getOldestVideos(
        OLDEST_FIRST_BATCH_SIZE,
        [...excludeIds, ...triedIds]
      );

      if (oldestVideos.length === 0) {
        logger.info({ dryRun, label }, '[Auto-Removal] No more videos available for oldest-first cleanup');
        break;
      }

      let batchDeletedCount = 0;
      let batchFreed = 0;

      for (const video of oldestVideos) {
        // Stop at the target so a dry run previews what a real run deletes.
        if (freedSoFar >= bytesToFree) {
          logger.info({ label }, '[Auto-Removal] Target met, stopping oldest-first cleanup');
          break;
        }

        triedIds.add(video.id);
        bucket.candidateCount += 1;
        const videoSize = parseInt(video.fileSize) || 0;

        if (dryRun) {
          freedSoFar += videoSize;
          batchFreed += videoSize;
          bucket.estimatedFreedBytes += videoSize;
          addSample(video);
          continue;
        }

        const deleteResult = await this.deleteVideoById(video.id);

        if (deleteResult.success) {
          freedSoFar += videoSize;
          batchFreed += videoSize;
          batchDeletedCount += 1;
          affectedChannelIds.push(deleteResult.channelId);

          result[deletedKey] += 1;
          bucket.deletedCount += 1;
          result.totalDeleted += 1;
          result.freedBytes += videoSize;
          bucket.estimatedFreedBytes += videoSize;
          addSample(video);
        } else {
          bucket.failedCount += 1;
          result.errors.push(`Failed to delete video ${video.id}: ${deleteResult.error}`);
          logger.error({ videoId: video.id, error: deleteResult.error }, '[Auto-Removal] Failed to delete video');
        }
      }

      if (!dryRun) {
        logger.info({
          label,
          batch: iterations + 1,
          deletedCount: batchDeletedCount,
          batchFreedGB: (batchFreed / (1024 ** 3)).toFixed(2),
          totalFreedGB: (freedSoFar / (1024 ** 3)).toFixed(2)
        }, '[Auto-Removal] Batch completed');
      }

      iterations += 1;
    }

    bucket.iterations = iterations;

    if (!dryRun) {
      if (iterations >= OLDEST_FIRST_MAX_BATCHES) {
        logger.warn({ label }, '[Auto-Removal] Reached maximum iterations for oldest-first cleanup');
        result.errors.push('Reached maximum iterations, may need additional cleanup');
      }
      this._regenerateM3usForChannels(affectedChannelIds);
    }

    return { selectedIds: Array.from(triedIds) };
  }

  /**
   * Perform automatic cleanup based on configured thresholds
   * This is the main method called by the cron job
   * @param {object} options
   * @param {boolean} [options.dryRun=false] - When true, returns a simulation without deleting files
   * @param {Record<string, any>} [options.overrides={}] - Optional config overrides (e.g. thresholds)
   * @param {boolean} [options.includeSamples=true] - Include sample video metadata in the response
   * @returns {Promise<{success: boolean, dryRun: boolean, deletedByAge: number, deletedBySpace: number, totalDeleted: number, freedBytes: number, errors: string[], plan: object, simulationTotals: object | null}>}
   */
  async performAutomaticCleanup(options = {}) {
    const { dryRun = false, overrides = {}, includeSamples = true } = options;
    const configModule = require('./configModule');
    const autoRemovalQueries = require('./autoRemovalQueries');
    const baseConfig = configModule.getConfig();
    const config = { ...baseConfig, ...overrides };

    const watchedEnabled = config.autoRemovalWatchedEnabled === true;
    const keepRecentCount = this._parsePositiveInt(config.autoRemovalKeepRecentCount);
    const hasAgeThreshold = config.autoRemovalVideoAgeThreshold !== null && config.autoRemovalVideoAgeThreshold !== '';
    const hasSpaceThreshold = config.autoRemovalFreeSpaceThreshold !== null && config.autoRemovalFreeSpaceThreshold !== '';
    const hasUsageLimit = config.autoRemovalUsageLimit !== undefined && config.autoRemovalUsageLimit !== null && config.autoRemovalUsageLimit !== '';

    const result = {
      success: true,
      dryRun,
      deletedByAge: 0,
      deletedByWatched: 0,
      deletedBySpace: 0,
      deletedByUsage: 0,
      totalDeleted: 0,
      freedBytes: 0,
      errors: [],
      plan: {
        ageStrategy: {
          enabled: false,
          thresholdDays: null,
          candidateCount: 0,
          estimatedFreedBytes: 0,
          deletedCount: 0,
          failedCount: 0,
          sampleVideos: []
        },
        watchedStrategy: {
          enabled: false,
          minDaysSinceWatched: null,
          minVideoAgeDays: null,
          candidateCount: 0,
          estimatedFreedBytes: 0,
          deletedCount: 0,
          failedCount: 0,
          skippedReason: null,
          sampleVideos: []
        },
        keepRecent: {
          count: keepRecentCount,
          protectedCount: 0
        },
        channelKeepRecent: {
          channelCount: 0,
          protectedCount: 0
        },
        spaceStrategy: {
          enabled: false,
          threshold: config.autoRemovalFreeSpaceThreshold !== undefined && config.autoRemovalFreeSpaceThreshold !== null
            ? config.autoRemovalFreeSpaceThreshold
            : null,
          thresholdBytes: null,
          candidateCount: 0,
          estimatedFreedBytes: 0,
          deletedCount: 0,
          failedCount: 0,
          storageStatus: null,
          needsCleanup: false,
          iterations: 0,
          sampleVideos: []
        },
        usageStrategy: {
          enabled: false,
          limit: hasUsageLimit ? config.autoRemovalUsageLimit : null,
          limitBytes: null,
          usedBytes: null,
          candidateCount: 0,
          estimatedFreedBytes: 0,
          deletedCount: 0,
          failedCount: 0,
          needsCleanup: false,
          iterations: 0,
          sampleVideos: []
        }
      },
      simulationTotals: dryRun ? {
        byAge: 0,
        byWatched: 0,
        bySpace: 0,
        byUsage: 0,
        total: 0,
        estimatedFreedBytes: 0
      } : null
    };

    // In dry-run mode nothing is actually deleted, so later strategies must
    // exclude the ids earlier strategies already claimed to avoid double counting.
    const dryRunProcessedIds = dryRun ? new Set() : null;

    logger.info({ dryRun }, '[Auto-Removal] Starting automatic video cleanup');


    if (!config.autoRemovalEnabled && !dryRun) {
      logger.info('[Auto-Removal] Auto-removal is disabled, skipping cleanup');
      return result;
    }

    if (!hasAgeThreshold && !hasSpaceThreshold && !hasUsageLimit && !watchedEnabled) {
      logger.info('[Auto-Removal] No thresholds configured, skipping cleanup');
      return result;
    }

    // The N most recently downloaded videos are protected from every strategy.
    // If the guard query fails we abort: running without it would delete the
    // videos this setting exists to keep.
    let keepRecentIds = [];
    if (keepRecentCount > 0) {
      try {
        keepRecentIds = await autoRemovalQueries.getRecentVideoIds(keepRecentCount);
        result.plan.keepRecent.protectedCount = keepRecentIds.length;
        logger.info({ keepRecentCount, protectedCount: keepRecentIds.length }, '[Auto-Removal] Protecting most recent downloads from cleanup');
      } catch (error) {
        logger.error({ err: error, keepRecentCount }, '[Auto-Removal] Could not determine the most recent downloads, aborting cleanup');
        result.errors.push('Could not determine the most recent downloads; cleanup aborted for safety');
        result.success = false;
        return result;
      }
    }

    // Per-channel keep-recent guard (channel settings). Runs regardless of the
    // global count; fails closed for the same reason the global guard does.
    try {
      const channelKeep = await autoRemovalQueries.getChannelKeepRecentIds();
      result.plan.channelKeepRecent.channelCount = channelKeep.channelCount;
      result.plan.channelKeepRecent.protectedCount = channelKeep.ids.length;
      if (channelKeep.ids.length > 0) {
        keepRecentIds = Array.from(new Set([...keepRecentIds, ...channelKeep.ids]));
        logger.info(
          { channelCount: channelKeep.channelCount, protectedCount: channelKeep.ids.length },
          '[Auto-Removal] Protecting per-channel most recent downloads from cleanup'
        );
      }
    } catch (error) {
      logger.error({ err: error }, '[Auto-Removal] Could not determine per-channel protected downloads, aborting cleanup');
      result.errors.push('Could not determine per-channel protected downloads; cleanup aborted for safety');
      result.success = false;
      return result;
    }

    // Age-based cleanup
    if (hasAgeThreshold) {
      const thresholdDays = parseInt(config.autoRemovalVideoAgeThreshold, 10);

      if (Number.isNaN(thresholdDays) || thresholdDays <= 0) {
        logger.warn({ threshold: config.autoRemovalVideoAgeThreshold }, '[Auto-Removal] Invalid age threshold provided, skipping age-based cleanup');
      } else {
        result.plan.ageStrategy.enabled = true;
        result.plan.ageStrategy.thresholdDays = thresholdDays;

        try {
          logger.info({ thresholdDays }, '[Auto-Removal] Checking for videos older than threshold');
          const oldVideos = await this.getVideosOlderThanThreshold(thresholdDays, keepRecentIds);
          const estimatedFreed = oldVideos.reduce((sum, v) => sum + (parseInt(v.fileSize) || 0), 0);

          if (dryRun && dryRunProcessedIds) {
            oldVideos.forEach(video => dryRunProcessedIds.add(video.id));
          }

          result.plan.ageStrategy.candidateCount = oldVideos.length;
          result.plan.ageStrategy.estimatedFreedBytes = estimatedFreed;
          if (includeSamples) {
            result.plan.ageStrategy.sampleVideos = oldVideos.slice(0, 10).map(video => this.formatVideoForPlan(video));
          }

          if (dryRun) {
            if (result.simulationTotals) {
              result.simulationTotals.byAge = oldVideos.length;
              result.simulationTotals.total += oldVideos.length;
              result.simulationTotals.estimatedFreedBytes += estimatedFreed;
            }
          } else if (oldVideos.length > 0) {
            logger.info({ count: oldVideos.length }, '[Auto-Removal] Deleting videos older than threshold');
            const videoIds = oldVideos.map(v => v.id);
            const deleteResult = await this.deleteVideos(videoIds);

            result.deletedByAge = deleteResult.deleted.length;
            result.plan.ageStrategy.deletedCount = deleteResult.deleted.length;
            result.plan.ageStrategy.failedCount = deleteResult.failed.length;
            result.totalDeleted += deleteResult.deleted.length;

            if (deleteResult.failed.length > 0) {
              result.errors.push(`Failed to delete ${deleteResult.failed.length} videos by age`);
              deleteResult.failed.forEach(f => {
                logger.error({ videoId: f.videoId, error: f.error }, '[Auto-Removal] Failed to delete video');
              });
            }

            const deletedVideos = oldVideos.filter(v => deleteResult.deleted.includes(v.id));
            const freed = deletedVideos.reduce((sum, v) => sum + (parseInt(v.fileSize) || 0), 0);
            result.freedBytes += freed;
            result.plan.ageStrategy.estimatedFreedBytes = freed;

            if (includeSamples) {
              const deletedSamples = deletedVideos.slice(0, 10).map(video => this.formatVideoForPlan(video));
              result.plan.ageStrategy.sampleVideos = deletedSamples;
            }

            logger.info({ deletedCount: deleteResult.deleted.length, freedGB: (freed / (1024 ** 3)).toFixed(2) }, '[Auto-Removal] Age-based cleanup completed');
          } else {
            logger.info('[Auto-Removal] No videos found older than age threshold');
          }
        } catch (error) {
          logger.error({ err: error }, '[Auto-Removal] Error during age-based cleanup');
          result.errors.push(`Age-based cleanup error: ${error.message}`);
          result.success = false;
        }
      }
    }

    // Watched-based cleanup
    if (watchedEnabled) {
      if (config.watchStatusSyncEnabled === false) {
        result.plan.watchedStrategy.skippedReason = 'Watched-based cleanup skipped: watch status sync is disabled';
        logger.warn('[Auto-Removal] Watch status sync is disabled, skipping watched-based cleanup');
      } else {
        const minDaysSinceWatched = this._parsePositiveInt(config.autoRemovalWatchedMinDaysSinceWatched);
        const minVideoAgeDays = this._parsePositiveInt(config.autoRemovalWatchedMinVideoAgeDays);

        result.plan.watchedStrategy.enabled = true;
        result.plan.watchedStrategy.minDaysSinceWatched = minDaysSinceWatched;
        result.plan.watchedStrategy.minVideoAgeDays = minVideoAgeDays;

        try {
          logger.info({ minDaysSinceWatched, minVideoAgeDays }, '[Auto-Removal] Checking for watched videos eligible for removal');
          // Real runs can't overlap (age deletions are already marked
          // removed), so only dry-run needs the explicit exclusion.
          const watchedExcludeIds = dryRun && dryRunProcessedIds
            ? Array.from(new Set([...keepRecentIds, ...dryRunProcessedIds]))
            : keepRecentIds;
          const watchedVideos = await autoRemovalQueries.getWatchedRemovalCandidates({
            minDaysSinceWatched,
            minVideoAgeDays,
            excludeIds: watchedExcludeIds
          });
          const estimatedFreed = watchedVideos.reduce((sum, v) => sum + (parseInt(v.fileSize) || 0), 0);

          if (dryRun && dryRunProcessedIds) {
            watchedVideos.forEach(video => dryRunProcessedIds.add(video.id));
          }

          result.plan.watchedStrategy.candidateCount = watchedVideos.length;
          result.plan.watchedStrategy.estimatedFreedBytes = estimatedFreed;
          if (includeSamples) {
            result.plan.watchedStrategy.sampleVideos = watchedVideos.slice(0, 10).map(video => this.formatVideoForPlan(video));
          }

          if (dryRun) {
            if (result.simulationTotals) {
              result.simulationTotals.byWatched = watchedVideos.length;
              result.simulationTotals.total += watchedVideos.length;
              result.simulationTotals.estimatedFreedBytes += estimatedFreed;
            }
          } else if (watchedVideos.length > 0) {
            logger.info({ count: watchedVideos.length }, '[Auto-Removal] Deleting watched videos');
            const videoIds = watchedVideos.map(v => v.id);
            const deleteResult = await this.deleteVideos(videoIds);

            result.deletedByWatched = deleteResult.deleted.length;
            result.plan.watchedStrategy.deletedCount = deleteResult.deleted.length;
            result.plan.watchedStrategy.failedCount = deleteResult.failed.length;
            result.totalDeleted += deleteResult.deleted.length;

            if (deleteResult.failed.length > 0) {
              result.errors.push(`Failed to delete ${deleteResult.failed.length} watched videos`);
              deleteResult.failed.forEach(f => {
                logger.error({ videoId: f.videoId, error: f.error }, '[Auto-Removal] Failed to delete video');
              });
            }

            const deletedVideos = watchedVideos.filter(v => deleteResult.deleted.includes(v.id));
            const freed = deletedVideos.reduce((sum, v) => sum + (parseInt(v.fileSize) || 0), 0);
            result.freedBytes += freed;
            result.plan.watchedStrategy.estimatedFreedBytes = freed;

            if (includeSamples) {
              result.plan.watchedStrategy.sampleVideos = deletedVideos.slice(0, 10).map(video => this.formatVideoForPlan(video));
            }

            logger.info({ deletedCount: deleteResult.deleted.length, freedGB: (freed / (1024 ** 3)).toFixed(2) }, '[Auto-Removal] Watched-based cleanup completed');
          } else {
            logger.info('[Auto-Removal] No watched videos eligible for removal');
          }
        } catch (error) {
          logger.error({ err: error }, '[Auto-Removal] Error during watched-based cleanup');
          result.errors.push(`Watched-based cleanup error: ${error.message}`);
          result.success = false;
        }
      }
    }

    // Space-based cleanup
    if (hasSpaceThreshold) {
      try {
        logger.info({ threshold: config.autoRemovalFreeSpaceThreshold }, '[Auto-Removal] Checking storage status against threshold');
        const storageStatus = await configModule.getStorageStatus();

        result.plan.spaceStrategy.storageStatus = storageStatus;

        if (!storageStatus) {
          logger.warn('[Auto-Removal] Could not retrieve storage status - skipping space-based cleanup for safety');
          result.errors.push('Storage status unavailable, skipped space-based cleanup');
        } else {
          const isBelowThreshold = configModule.isStorageBelowThreshold(
            storageStatus.available,
            config.autoRemovalFreeSpaceThreshold
          );

          result.plan.spaceStrategy.needsCleanup = isBelowThreshold;

          const thresholdBytes = configModule.convertStorageThresholdToBytes(config.autoRemovalFreeSpaceThreshold);

          if (thresholdBytes === null) {
            logger.warn('[Auto-Removal] Invalid storage threshold format, skipping space-based cleanup');
            result.errors.push('Invalid storage threshold format, skipped space-based cleanup');
          } else {
            result.plan.spaceStrategy.enabled = true;
            result.plan.spaceStrategy.thresholdBytes = thresholdBytes;

            if (isBelowThreshold) {
              const spaceToFree = thresholdBytes - storageStatus.available;
              logger.info({ spaceToFreeGB: (spaceToFree / (1024 ** 3)).toFixed(2) }, '[Auto-Removal] Need to free storage space');

              const { selectedIds } = await this._removeOldestUntilFreed({
                bytesToFree: spaceToFree,
                excludeIds: dryRun ? [...keepRecentIds, ...dryRunProcessedIds] : keepRecentIds,
                bucket: result.plan.spaceStrategy,
                deletedKey: 'deletedBySpace',
                label: 'space-based',
                dryRun,
                includeSamples,
                result
              });

              if (dryRun) {
                selectedIds.forEach(id => dryRunProcessedIds.add(id));
                if (result.simulationTotals) {
                  result.simulationTotals.bySpace = result.plan.spaceStrategy.candidateCount;
                  result.simulationTotals.total += result.plan.spaceStrategy.candidateCount;
                  result.simulationTotals.estimatedFreedBytes += result.plan.spaceStrategy.estimatedFreedBytes;
                }
              }
            } else {
              logger.info({ availableGB: storageStatus.availableGB }, '[Auto-Removal] Storage is above threshold, no space-based cleanup needed');
            }
          }
        }
      } catch (error) {
        logger.error({ err: error }, '[Auto-Removal] Error during space-based cleanup');
        result.errors.push(`Space-based cleanup error: ${error.message}`);
        result.success = false;
      }
    }

    // Total-usage cleanup: runs last so it only removes what the other
    // strategies left over the limit.
    if (hasUsageLimit) {
      const bucket = result.plan.usageStrategy;
      const limitBytes = configModule.convertStorageThresholdToBytes(config.autoRemovalUsageLimit);

      if (limitBytes === null) {
        logger.warn({ limit: config.autoRemovalUsageLimit }, '[Auto-Removal] Invalid total usage limit format, skipping usage-based cleanup');
        result.errors.push('Invalid total usage limit format, skipped usage-based cleanup');
      } else {
        bucket.enabled = true;
        bucket.limitBytes = limitBytes;

        try {
          const measuredBytes = await storageUsage.getDownloadedBytes();
          // A real run measures after earlier deletions; a dry run deleted
          // nothing, so subtract what the earlier strategies would have freed.
          const alreadyFreed = dryRun && result.simulationTotals ? result.simulationTotals.estimatedFreedBytes : 0;
          const usedBytes = Math.max(0, measuredBytes - alreadyFreed);
          bucket.usedBytes = usedBytes;
          bucket.needsCleanup = usedBytes > limitBytes;

          if (bucket.needsCleanup) {
            const bytesToFree = usedBytes - limitBytes;
            logger.info({ bytesToFreeGB: (bytesToFree / (1024 ** 3)).toFixed(2) }, '[Auto-Removal] Downloaded videos exceed the total usage limit');

            const { selectedIds } = await this._removeOldestUntilFreed({
              bytesToFree,
              excludeIds: dryRun ? [...keepRecentIds, ...dryRunProcessedIds] : keepRecentIds,
              bucket,
              deletedKey: 'deletedByUsage',
              label: 'usage-based',
              dryRun,
              includeSamples,
              result
            });

            if (dryRun) {
              selectedIds.forEach(id => dryRunProcessedIds.add(id));
              if (result.simulationTotals) {
                result.simulationTotals.byUsage = bucket.candidateCount;
                result.simulationTotals.total += bucket.candidateCount;
                result.simulationTotals.estimatedFreedBytes += bucket.estimatedFreedBytes;
              }
            }
          } else {
            logger.info({ usedGB: (usedBytes / (1024 ** 3)).toFixed(2) }, '[Auto-Removal] Downloaded videos are within the total usage limit');
          }
        } catch (error) {
          logger.error({ err: error }, '[Auto-Removal] Error during usage-based cleanup');
          result.errors.push(`Usage-based cleanup error: ${error.message}`);
          result.success = false;
        }
      }
    }

    if (!dryRun && result.totalDeleted > 0) this._refreshDownloadPauseIfPaused();

    logger.info({
      dryRun,
      totalDeleted: result.totalDeleted,
      deletedByAge: result.deletedByAge,
      deletedByWatched: result.deletedByWatched,
      deletedBySpace: result.deletedBySpace,
      deletedByUsage: result.deletedByUsage,
      totalFreedGB: (result.freedBytes / (1024 ** 3)).toFixed(2),
      errorCount: result.errors.length
    }, '[Auto-Removal] Cleanup completed');

    if (dryRun && result.simulationTotals) {
      logger.info({
        simulatedByAge: result.simulationTotals.byAge,
        simulatedByWatched: result.simulationTotals.byWatched,
        simulatedBySpace: result.simulationTotals.bySpace,
        simulatedByUsage: result.simulationTotals.byUsage,
        estimatedFreedGB: (result.simulationTotals.estimatedFreedBytes / (1024 ** 3)).toFixed(2)
      }, '[Auto-Removal] Dry-run simulation summary');
    }

    return result;
  }
}

module.exports = new VideoDeletionModule();
