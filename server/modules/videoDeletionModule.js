const { Video } = require('../models');
const fs = require('fs').promises;
const path = require('path');

class VideoDeletionModule {
  constructor() {}

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

      // Check if we have a file path
      if (!video.filePath) {
        // No file path, just mark as removed in database
        await video.update({ removed: true });
        return {
          success: true,
          videoId,
          message: 'Video marked as removed (no file path)'
        };
      }

      // Get the video directory path
      // filePath format: /path/to/channel/channel - title - id/video.mp4
      // We need to delete the parent directory (channel - title - id)
      const videoDirectory = path.dirname(video.filePath);

      // Safety check: ensure the directory path contains the youtube ID
      // This prevents accidentally deleting the wrong directory
      if (!videoDirectory.includes(video.youtubeId)) {
        console.error(`Safety check failed: directory path ${videoDirectory} doesn't contain youtube ID ${video.youtubeId}`);
        return {
          success: false,
          videoId,
          error: 'Safety check failed: invalid directory path'
        };
      }

      // Delete the video directory
      try {
        await fs.rm(videoDirectory, { recursive: true, force: true });
        console.log(`Deleted video directory: ${videoDirectory}`);
      } catch (fsError) {
        if (fsError.code === 'ENOENT') {
          // Directory already gone; treat as success but still mark removed in DB
          console.info(`Directory ${videoDirectory} already removed: ${fsError.message}`);
        } else {
          console.error(`Failed to delete directory ${videoDirectory}:`, fsError);
          return {
            success: false,
            videoId,
            error: 'Failed to delete video files from disk. Please check filesystem permissions.'
          };
        }
      }

      // Mark video as removed in database
      await video.update({ removed: true });

      return {
        success: true,
        videoId,
        message: 'Video deleted successfully'
      };
    } catch (error) {
      console.error(`Error deleting video ${videoId}:`, error);
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

    // Process deletions sequentially to avoid overwhelming the file system
    for (const videoId of videoIds) {
      const result = await this.deleteVideoById(videoId);

      if (result.success) {
        deleted.push(videoId);
      } else {
        failed.push({
          videoId,
          error: result.error || 'Unknown error'
        });
      }
    }

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

    return {
      success: failed.length === 0,
      deleted,
      failed
    };
  }

  /**
   * Get videos older than the specified threshold
   * Uses the same timeCreated calculation as videosModule.js
   * @param {number} ageInDays - Age threshold in days
   * @returns {Promise<Array<{id: number, youtubeId: string, youTubeVideoName: string, timeCreated: Date, fileSize: number}>>}
   */
  async getVideosOlderThanThreshold(ageInDays) {
    const { Sequelize, sequelize } = require('../db.js');

    try {
      // Use raw SQL query to match the timeCreated calculation in videosModule.js
      const query = `
        SELECT DISTINCT
          Videos.id,
          Videos.youtubeId,
          Videos.youTubeVideoName,
          Videos.youTubeChannelName,
          Videos.fileSize,
          COALESCE(Videos.last_downloaded_at, Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, '%Y%m%d')) AS timeCreated
        FROM Videos
        LEFT JOIN JobVideos ON Videos.id = JobVideos.video_id
        LEFT JOIN Jobs ON Jobs.id = JobVideos.job_id
        WHERE Videos.removed = 0
          AND COALESCE(Videos.last_downloaded_at, Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, '%Y%m%d')) IS NOT NULL
          AND COALESCE(Videos.last_downloaded_at, Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, '%Y%m%d')) < DATE_SUB(NOW(), INTERVAL :ageInDays DAY)
        ORDER BY timeCreated ASC
      `;

      const videos = await sequelize.query(query, {
        replacements: { ageInDays },
        type: Sequelize.QueryTypes.SELECT
      });

      console.log(`[Auto-Removal] Found ${videos.length} videos older than ${ageInDays} days`);
      return videos;
    } catch (error) {
      console.error('Error getting videos older than threshold:', error);
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
        ? '          AND Videos.id NOT IN (:excludeIds)\n'
        : '';

      const query = `
        SELECT DISTINCT
          Videos.id,
          Videos.youtubeId,
          Videos.youTubeVideoName,
          Videos.youTubeChannelName,
          Videos.fileSize,
          COALESCE(Videos.last_downloaded_at, Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, '%Y%m%d')) AS timeCreated
        FROM Videos
        LEFT JOIN JobVideos ON Videos.id = JobVideos.video_id
        LEFT JOIN Jobs ON Jobs.id = JobVideos.job_id
        WHERE Videos.removed = 0
          AND COALESCE(Videos.last_downloaded_at, Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, '%Y%m%d')) IS NOT NULL
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

      console.log(`[Auto-Removal] Found ${videos.length} oldest videos (limit: ${limit})`);
      return videos;
    } catch (error) {
      console.error('Error getting oldest videos:', error);
      return [];
    }
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
    const baseConfig = configModule.getConfig();
    const config = { ...baseConfig, ...overrides };

    const result = {
      success: true,
      dryRun,
      deletedByAge: 0,
      deletedBySpace: 0,
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
        }
      },
      simulationTotals: dryRun ? {
        byAge: 0,
        bySpace: 0,
        total: 0,
        estimatedFreedBytes: 0
      } : null
    };

    const dryRunAgeCandidateIds = dryRun ? new Set() : null;

    console.log(`[Auto-Removal] Starting ${dryRun ? 'dry-run ' : ''}automatic video cleanup...`);

    const hasAgeThreshold = config.autoRemovalVideoAgeThreshold !== null && config.autoRemovalVideoAgeThreshold !== '';
    const hasSpaceThreshold = config.autoRemovalFreeSpaceThreshold !== null && config.autoRemovalFreeSpaceThreshold !== '';

    if (!config.autoRemovalEnabled && !dryRun) {
      console.log('[Auto-Removal] Auto-removal is disabled, skipping cleanup');
      return result;
    }

    if (!hasAgeThreshold && !hasSpaceThreshold) {
      console.log('[Auto-Removal] No thresholds configured, skipping cleanup');
      return result;
    }

    // Age-based cleanup
    if (hasAgeThreshold) {
      const thresholdDays = parseInt(config.autoRemovalVideoAgeThreshold, 10);

      if (Number.isNaN(thresholdDays) || thresholdDays <= 0) {
        console.warn('[Auto-Removal] Invalid age threshold provided, skipping age-based cleanup');
      } else {
        result.plan.ageStrategy.enabled = true;
        result.plan.ageStrategy.thresholdDays = thresholdDays;

        try {
          console.log(`[Auto-Removal] Checking for videos older than ${thresholdDays} days...`);
          const oldVideos = await this.getVideosOlderThanThreshold(thresholdDays);
          const estimatedFreed = oldVideos.reduce((sum, v) => sum + (parseInt(v.fileSize) || 0), 0);

          if (dryRun && dryRunAgeCandidateIds) {
            oldVideos.forEach(video => dryRunAgeCandidateIds.add(video.id));
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
            console.log(`[Auto-Removal] Deleting ${oldVideos.length} videos older than threshold...`);
            const videoIds = oldVideos.map(v => v.id);
            const deleteResult = await this.deleteVideos(videoIds);

            result.deletedByAge = deleteResult.deleted.length;
            result.plan.ageStrategy.deletedCount = deleteResult.deleted.length;
            result.plan.ageStrategy.failedCount = deleteResult.failed.length;
            result.totalDeleted += deleteResult.deleted.length;

            if (deleteResult.failed.length > 0) {
              result.errors.push(`Failed to delete ${deleteResult.failed.length} videos by age`);
              deleteResult.failed.forEach(f => {
                console.error(`[Auto-Removal] Failed to delete video ${f.videoId}: ${f.error}`);
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

            console.log(`[Auto-Removal] Age-based cleanup: deleted ${deleteResult.deleted.length} videos, freed ${(freed / (1024 ** 3)).toFixed(2)} GB`);
          } else {
            console.log('[Auto-Removal] No videos found older than age threshold');
          }
        } catch (error) {
          console.error('[Auto-Removal] Error during age-based cleanup:', error);
          result.errors.push(`Age-based cleanup error: ${error.message}`);
          result.success = false;
        }
      }
    }

    // Space-based cleanup
    if (hasSpaceThreshold) {
      try {
        console.log(`[Auto-Removal] Checking storage status against threshold ${config.autoRemovalFreeSpaceThreshold}...`);
        const storageStatus = await configModule.getStorageStatus();

        result.plan.spaceStrategy.storageStatus = storageStatus;

        if (!storageStatus) {
          console.warn('[Auto-Removal] WARNING: Could not retrieve storage status - skipping space-based cleanup for safety');
          result.errors.push('Storage status unavailable, skipped space-based cleanup');
        } else {
          const isBelowThreshold = configModule.isStorageBelowThreshold(
            storageStatus.available,
            config.autoRemovalFreeSpaceThreshold
          );

          result.plan.spaceStrategy.needsCleanup = isBelowThreshold;

          const thresholdBytes = configModule.convertStorageThresholdToBytes(config.autoRemovalFreeSpaceThreshold);

          if (thresholdBytes === null) {
            console.warn('[Auto-Removal] Invalid storage threshold format, skipping space-based cleanup');
            result.errors.push('Invalid storage threshold format, skipped space-based cleanup');
          } else {
            result.plan.spaceStrategy.enabled = true;
            result.plan.spaceStrategy.thresholdBytes = thresholdBytes;

            if (isBelowThreshold) {
              const spaceToFree = thresholdBytes - storageStatus.available;
              console.log(`[Auto-Removal] Need to free approximately ${(spaceToFree / (1024 ** 3)).toFixed(2)} GB`);

              const batchSize = 50;
              const maxIterations = 10;

              if (dryRun) {
                const processedIds = new Set(dryRunAgeCandidateIds || []);
                let freedSoFar = 0;
                let iterations = 0;

                while (freedSoFar < spaceToFree && iterations < maxIterations) {
                  const oldestVideos = await this.getOldestVideos(batchSize, Array.from(processedIds));

                  if (oldestVideos.length === 0) {
                    console.log('[Auto-Removal] Dry-run: no more videos available for space-based cleanup');
                    break;
                  }

                  oldestVideos.forEach(v => processedIds.add(v.id));

                  const batchFreed = oldestVideos.reduce((sum, v) => sum + (parseInt(v.fileSize) || 0), 0);
                  freedSoFar += batchFreed;

                  result.plan.spaceStrategy.candidateCount += oldestVideos.length;
                  result.plan.spaceStrategy.estimatedFreedBytes += batchFreed;

                  if (includeSamples && result.plan.spaceStrategy.sampleVideos.length < 10) {
                    const remainingSlots = 10 - result.plan.spaceStrategy.sampleVideos.length;
                    result.plan.spaceStrategy.sampleVideos.push(
                      ...oldestVideos.slice(0, remainingSlots).map(video => this.formatVideoForPlan(video))
                    );
                  }

                  iterations += 1;
                }

                result.plan.spaceStrategy.iterations = iterations;

                if (result.simulationTotals) {
                  result.simulationTotals.bySpace = result.plan.spaceStrategy.candidateCount;
                  result.simulationTotals.total += result.plan.spaceStrategy.candidateCount;
                  result.simulationTotals.estimatedFreedBytes += result.plan.spaceStrategy.estimatedFreedBytes;
                }
              } else {
                let freedSoFar = 0;
                let iterations = 0;

                while (freedSoFar < spaceToFree && iterations < maxIterations) {
                  const oldestVideos = await this.getOldestVideos(batchSize);

                  if (oldestVideos.length === 0) {
                    console.log('[Auto-Removal] No more videos available to delete');
                    break;
                  }

                  let batchDeletedCount = 0;
                  let batchFreed = 0;

                  // Delete videos one-by-one until threshold is met to avoid over-deletion
                  for (const video of oldestVideos) {
                    if (freedSoFar >= spaceToFree) {
                      console.log('[Auto-Removal] Space threshold met, stopping space-based cleanup');
                      break;
                    }

                    result.plan.spaceStrategy.candidateCount += 1;

                    const deleteResult = await this.deleteVideoById(video.id);

                    if (deleteResult.success) {
                      const videoSize = parseInt(video.fileSize) || 0;
                      freedSoFar += videoSize;
                      batchFreed += videoSize;
                      batchDeletedCount += 1;

                      result.deletedBySpace += 1;
                      result.plan.spaceStrategy.deletedCount += 1;
                      result.totalDeleted += 1;
                      result.freedBytes += videoSize;
                      result.plan.spaceStrategy.estimatedFreedBytes += videoSize;

                      if (includeSamples && result.plan.spaceStrategy.sampleVideos.length < 10) {
                        result.plan.spaceStrategy.sampleVideos.push(this.formatVideoForPlan(video));
                      }
                    } else {
                      result.plan.spaceStrategy.failedCount += 1;
                      result.errors.push(`Failed to delete video ${video.id}: ${deleteResult.error}`);
                      console.error(`[Auto-Removal] Failed to delete video ${video.id}: ${deleteResult.error}`);
                    }
                  }

                  console.log(`[Auto-Removal] Batch ${iterations + 1}: deleted ${batchDeletedCount} videos, freed ${(batchFreed / (1024 ** 3)).toFixed(2)} GB (total freed: ${(freedSoFar / (1024 ** 3)).toFixed(2)} GB)`);

                  iterations += 1;

                  if (freedSoFar >= spaceToFree) {
                    break;
                  }
                }

                result.plan.spaceStrategy.iterations = iterations;

                if (iterations >= maxIterations) {
                  console.warn('[Auto-Removal] Reached maximum iterations for space-based cleanup');
                  result.errors.push('Reached maximum iterations, may need additional cleanup');
                }
              }
            } else {
              console.log(`[Auto-Removal] Storage is above threshold (${storageStatus.availableGB} GB available), no space-based cleanup needed`);
            }
          }
        }
      } catch (error) {
        console.error('[Auto-Removal] Error during space-based cleanup:', error);
        result.errors.push(`Space-based cleanup error: ${error.message}`);
        result.success = false;
      }
    }

    console.log(`[Auto-Removal] ${dryRun ? 'Dry-run ' : ''}cleanup completed:`);
    console.log(`  - Total videos deleted: ${result.totalDeleted}`);
    console.log(`  - Deleted by age: ${result.deletedByAge}`);
    console.log(`  - Deleted by space: ${result.deletedBySpace}`);
    console.log(`  - Total space freed: ${(result.freedBytes / (1024 ** 3)).toFixed(2)} GB`);

    if (dryRun && result.simulationTotals) {
      console.log(`  - Simulated deletions (age/space): ${result.simulationTotals.byAge}/${result.simulationTotals.bySpace}`);
      console.log(`  - Estimated space to free: ${(result.simulationTotals.estimatedFreedBytes / (1024 ** 3)).toFixed(2)} GB`);
    }

    if (result.errors.length > 0) {
      console.log(`  - Errors: ${result.errors.length}`);
    }

    return result;
  }
}

module.exports = new VideoDeletionModule();
