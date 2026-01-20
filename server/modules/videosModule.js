const { Sequelize, sequelize } = require('../db.js');
const { Video } = require('../models');
const fs = require('fs').promises;
const path = require('path');
const configModule = require('./configModule');
const fileCheckModule = require('./fileCheckModule');
const logger = require('../logger');
const ratingMapper = require('./ratingMapper');

class VideosModule {
  constructor() {}

  async getVideosPaginated(options = {}) {
    const {
      page = 1,
      limit = 12,
      search = '',
      dateFrom = null,
      dateTo = null,
      sortBy = 'added',
      sortOrder = 'desc',
      channelFilter = '',
      maxRating = ''
    } = options;

    try {
      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const whereConditions = [];
      const replacements = {};

      if (search) {
        whereConditions.push('(Videos.youTubeVideoName LIKE :search OR Videos.youTubeChannelName LIKE :search)');
        replacements.search = `%${search}%`;
      }

      if (channelFilter) {
        whereConditions.push('Videos.youTubeChannelName = :channelFilter');
        replacements.channelFilter = channelFilter;
      }

      if (dateFrom) {
        whereConditions.push('Videos.originalDate >= :dateFrom');
        replacements.dateFrom = dateFrom.replace(/-/g, '');
      }

      if (dateTo) {
        whereConditions.push('Videos.originalDate <= :dateTo');
        replacements.dateTo = dateTo.replace(/-/g, '');
      }

      const maxRatingLimit = ratingMapper.getRatingAgeLimit(maxRating);
      const ratingRankCase = `CASE
        WHEN Videos.normalized_rating IN ('TV-Y','TV-G','G') THEN 0
        WHEN Videos.normalized_rating IN ('TV-Y7','TV-PG','PG') THEN 7
        WHEN Videos.normalized_rating IN ('TV-14') THEN 13
        WHEN Videos.normalized_rating IN ('PG-13') THEN 16
        WHEN Videos.normalized_rating IN ('R','TV-MA','NC-17') THEN 18
        ELSE NULL
      END`;

      if (maxRatingLimit !== null && maxRatingLimit !== undefined) {
        whereConditions.push(`(${ratingRankCase} IS NULL OR ${ratingRankCase} <= :maxRatingLimit)`);
        replacements.maxRatingLimit = maxRatingLimit;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Build ORDER BY
      let orderByColumn;
      if (sortBy === 'published') {
        orderByColumn = 'Videos.originalDate';
      } else {
        orderByColumn = 'COALESCE(Videos.last_downloaded_at, Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, \'%Y%m%d\'))';
      }
      const orderByClause = `ORDER BY ${orderByColumn} ${sortOrder.toUpperCase()}`;

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT Videos.id) as total
        FROM Videos
        LEFT JOIN JobVideos ON Videos.id = JobVideos.video_id
        LEFT JOIN Jobs ON Jobs.id = JobVideos.job_id
        ${whereClause}
      `;

      const countResult = await sequelize.query(countQuery, {
        replacements,
        type: Sequelize.QueryTypes.SELECT
      });

      const total = countResult[0].total;

      // Get paginated videos
      const query = `
        SELECT
          Videos.id,
          Videos.youtubeId,
          Videos.youTubeChannelName,
          Videos.youTubeVideoName,
          Videos.duration,
          Videos.originalDate,
          Videos.description,
          Videos.channel_id,
          Videos.filePath,
          Videos.fileSize,
          Videos.removed,
          Videos.youtube_removed,
          Videos.media_type,
          Videos.normalized_rating,
          Videos.rating_source,
          COALESCE(Videos.last_downloaded_at, Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, '%Y%m%d')) AS timeCreated
        FROM Videos
        LEFT JOIN JobVideos ON Videos.id = JobVideos.video_id
        LEFT JOIN Jobs ON Jobs.id = JobVideos.job_id
        ${whereClause}
        ${orderByClause}
        LIMIT :limit OFFSET :offset
      `;

      replacements.limit = limit;
      replacements.offset = offset;

      const videos = await sequelize.query(query, {
        replacements,
        type: Sequelize.QueryTypes.SELECT,
        model: Video,
        mapToModel: true,
        raw: true
      });

      // Real-time file check for videos that have a known file path
      // Only check videos with an existing filePath to avoid incorrectly marking videos as removed
      // Videos without a filePath will be handled by the backfill process
      const { videos: checkedVideos, updates } = await fileCheckModule.checkVideoFiles(videos);

      // Update the videos array with the checked results
      for (let i = 0; i < videos.length; i++) {
        videos[i] = checkedVideos[i];
      }

      // Batch update the database if there are changes
      await fileCheckModule.applyVideoUpdates(sequelize, Sequelize, updates);

      // Check if videos still exist on YouTube and mark as removed if they don't
      const videoValidationModule = require('./videoValidationModule');
      const youtubeUpdates = [];
      const timestampUpdates = [];
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Check all videos concurrently for better performance
      // Only check videos that haven't been checked in the last 24 hours
      const checkPromises = videos.map(async (video) => {
        const lastChecked = video.youtube_removed_checked_at ? new Date(video.youtube_removed_checked_at) : null;

        // Skip if already marked as removed or checked within last 24 hours
        if (video.youtube_removed || (lastChecked && lastChecked > twentyFourHoursAgo)) {
          return null;
        }

        if (video.youtubeId) {
          const exists = await videoValidationModule.checkVideoExistsOnYoutube(video.youtubeId);
          const now = new Date();

          if (!exists) {
            logger.info({ youtubeId: video.youtubeId }, 'Video no longer exists on YouTube, marking as removed');
            video.youtube_removed = true;
            video.youtube_removed_checked_at = now;
            return { id: video.id, removed: true, checked_at: now };
          } else {
            // Video exists, just update the timestamp
            video.youtube_removed_checked_at = now;
            return { id: video.id, removed: false, checked_at: now };
          }
        }
        return null;
      });

      const checkResults = await Promise.all(checkPromises);
      const validResults = checkResults.filter(result => result !== null);

      // Separate updates for removed videos and timestamp updates
      for (const result of validResults) {
        if (result.removed) {
          youtubeUpdates.push(result);
        } else {
          timestampUpdates.push(result);
        }
      }

      // Bulk update Videos table for removed videos
      if (youtubeUpdates.length > 0) {
        await Video.update(
          { youtube_removed: true, youtube_removed_checked_at: new Date() },
          { where: { id: youtubeUpdates.map(u => u.id) } }
        );
      }

      // Bulk update Videos table for timestamp-only updates
      if (timestampUpdates.length > 0) {
        await Video.update(
          { youtube_removed_checked_at: new Date() },
          { where: { id: timestampUpdates.map(u => u.id) } }
        );
      }

      // Get all unique channels for the filter dropdown
      const channels = await this.getAllUniqueChannels();

      // Get enabled channels with their channel_ids
      const Channel = require('../models/channel');
      const enabledChannels = await Channel.findAll({
        where: { enabled: true },
        attributes: ['channel_id', 'uploader']
      });

      return {
        videos,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        channels,
        enabledChannels: enabledChannels.map(ch => ({ channel_id: ch.channel_id, uploader: ch.uploader }))
      };
    } catch (err) {
      logger.error({ err }, 'Error in getVideosPaginated');
      throw err;
    }
  }

  async getAllUniqueChannels() {
    try {
      // Get all channels from the channels table
      const Channel = require('../models/channel');
      const allChannels = await Channel.findAll({
        attributes: ['title'],
        order: [['title', 'ASC']]
      });

      // Get all unique channel names from videos table
      const videoChannelsQuery = `
        SELECT DISTINCT youTubeChannelName
        FROM Videos
        WHERE youTubeChannelName IS NOT NULL
        ORDER BY youTubeChannelName
      `;

      const videoChannels = await sequelize.query(videoChannelsQuery, {
        type: Sequelize.QueryTypes.SELECT
      });

      // Combine both sets and deduplicate
      const channelSet = new Set();

      // Add channels from channels table
      allChannels.forEach(channel => {
        if (channel.uploader) {
          channelSet.add(channel.uploader);
        }
      });

      // Add channels from videos table
      videoChannels.forEach(row => {
        if (row.youTubeChannelName) {
          channelSet.add(row.youTubeChannelName);
        }
      });

      // Convert to sorted array
      return Array.from(channelSet).sort();
    } catch (err) {
      logger.error({ err }, 'Error in getAllUniqueChannels');
      return [];
    }
  }

  /**
   * Bulk update video ratings
   * @param {number[]} videoIds - List of database IDs
   * @param {string} rating - The new rating value
   */
  async bulkUpdateVideoRatings(videoIds, rating) {
    const results = {
      success: [],
      failed: []
    };

    const nfoGenerator = require('./nfoGenerator');
    const normalizedRating = rating && rating !== 'NR' ? rating : null;

    for (const id of videoIds) {
      try {
        const video = await Video.findByPk(id);
        if (!video) {
          results.failed.push({ id, error: 'Video not found' });
          continue;
        }

        await video.update({
          normalized_rating: normalizedRating,
          rating_source: 'Manual Override'
        });

        if (video.filePath) {
          const parsedPath = path.parse(video.filePath);
          const jsonPath = path.format({
            dir: parsedPath.dir,
            name: parsedPath.name,
            ext: '.info.json'
          });

          const jsonExists = await fs.access(jsonPath).then(() => true).catch(() => false);

          if (jsonExists) {
            const content = await fs.readFile(jsonPath, 'utf8');
            let jsonData;
            try {
              jsonData = JSON.parse(content);
            } catch (parseError) {
              logger.warn({ parseError, jsonPath }, 'Failed to parse .info.json for rating update');
              results.success.push(id);
              continue;
            }

            jsonData.normalized_rating = normalizedRating;
            jsonData.rating_source = 'Manual Override';

            await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
            nfoGenerator.writeVideoNfoFile(video.filePath, jsonData);
          }
        }

        results.success.push(id);
      } catch (err) {
        logger.error({ err, videoId: id }, 'Failed to update video rating');
        results.failed.push({ id, error: err.message });
      }
    }

    return results;
  }

  async scanForVideoFiles(dir, fileMap = new Map(), duplicates = new Map()) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanForVideoFiles(fullPath, fileMap, duplicates);
        } else if (entry.isFile() && entry.name.endsWith('.mp4')) {
          // Extract YouTube ID from filename - matches files ending with [youtube_id].mp4
          // Accepts ANY characters before the final [id].mp4 pattern
          const match = entry.name.match(/\[([^[\]]+)\]\.mp4$/);
          if (match) {
            const youtubeId = match[1];
            const stats = await fs.stat(fullPath);

            // Check for duplicates
            if (fileMap.has(youtubeId)) {
              // Track duplicate for logging
              if (!duplicates.has(youtubeId)) {
                duplicates.set(youtubeId, [fileMap.get(youtubeId).filePath]);
              }
              duplicates.get(youtubeId).push(fullPath);

              // Keep the larger file (likely the more complete download)
              const existingFile = fileMap.get(youtubeId);
              if (stats.size > existingFile.fileSize) {
                logger.warn({ youtubeId, filePath: fullPath, size: stats.size }, 'Duplicate found: keeping larger file');
                fileMap.set(youtubeId, {
                  filePath: fullPath,
                  fileSize: stats.size
                });
              }
            } else {
              fileMap.set(youtubeId, {
                filePath: fullPath,
                fileSize: stats.size
              });
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err, dir }, 'Error scanning directory');
    }

    return { fileMap, duplicates };
  }

  async backfillVideoMetadata(timeLimit = 5 * 60 * 1000) { // Default 5 minutes
    const startTime = Date.now();
    const logProgress = (message) => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.info({ elapsed, context: 'backfill' }, message);
    };

    try {
      logProgress('Starting video metadata backfill...');
      const outputDir = configModule.directoryPath;

      if (!outputDir) {
        logger.info('No YouTube output directory configured, skipping backfill');
        return;
      }

      // Check time limit before expensive operations
      const checkTimeLimit = () => {
        if (Date.now() - startTime > timeLimit) {
          throw new Error(`Time limit exceeded (${timeLimit / 1000}s)`);
        }
      };

      // First, scan filesystem for all video files
      logProgress('Scanning filesystem for video files...');
      const { fileMap, duplicates } = await this.scanForVideoFiles(outputDir);
      logProgress(`Found ${fileMap.size} video files on disk`);


      if (duplicates.size > 0) {
        logger.warn({ duplicateCount: duplicates.size }, 'Found videos with duplicate files');
        for (const [youtubeId, paths] of duplicates.entries()) {
          logger.warn({ youtubeId, fileCount: paths.length, paths }, 'Duplicate video files found');
        }
      }

      checkTimeLimit();

      // Process videos in chunks to avoid memory issues
      const VIDEO_CHUNK_SIZE = 1000; // Process 1000 videos at a time
      let offset = 0;
      let totalProcessed = 0;
      let totalUpdated = 0;
      let totalRemoved = 0;

      // Get total count first
      const totalCount = await Video.count();
      logProgress(`Processing ${totalCount} videos from database...`);

      while (offset < totalCount) {
        checkTimeLimit();

        // Fetch a chunk of videos
        const videos = await Video.findAll({
          attributes: ['id', 'youtubeId', 'filePath', 'fileSize', 'removed'],
          limit: VIDEO_CHUNK_SIZE,
          offset: offset,
          raw: true
        });

        if (videos.length === 0) break;

        const bulkUpdates = [];
        let chunkUpdated = 0;
        let chunkRemoved = 0;

        // Process this chunk
        for (const video of videos) {
          // Yield control periodically to keep event loop responsive
          if ((totalProcessed + bulkUpdates.length) % 100 === 0) {
            await new Promise(resolve => setImmediate(resolve));
            checkTimeLimit();
          }

          const fileInfo = fileMap.get(video.youtubeId);


          if (fileInfo) {
            // File exists - check if update needed
            if (video.filePath !== fileInfo.filePath ||
                !video.fileSize ||
                video.fileSize !== fileInfo.fileSize.toString() ||
                video.removed === true) {

              bulkUpdates.push({
                id: video.id,
                filePath: fileInfo.filePath,
                fileSize: fileInfo.fileSize,
                removed: false
              });
              chunkUpdated++;
            }
          } else {
            // File doesn't exist in fileMap
            if (!video.removed) {
              // Only mark as removed, don't touch filePath or fileSize
              // They might still be valid even if we can't find the file right now
              bulkUpdates.push({
                id: video.id,
                removed: true
                // DO NOT include filePath or fileSize here - leave them unchanged
              });
              chunkRemoved++;
            }
          }
        }

        // Perform bulk update if there are changes
        if (bulkUpdates.length > 0) {
          logProgress(`Updating ${bulkUpdates.length} records (chunk ${Math.floor(offset / VIDEO_CHUNK_SIZE) + 1})...`);

          // Process updates in batches to avoid query size limits
          const BATCH_SIZE = 100;

          for (let i = 0; i < bulkUpdates.length; i += BATCH_SIZE) {
            checkTimeLimit();
            await new Promise(resolve => setImmediate(resolve)); // Yield control

            const batch = bulkUpdates.slice(i, i + BATCH_SIZE);

            // Use individual parameterized updates to handle special characters properly
            let batchSuccess = 0;
            let batchFailed = 0;

            for (const update of batch) {
              const setClauses = [];
              const replacements = [];

              if (update.filePath !== undefined) {
                setClauses.push('filePath = ?');
                replacements.push(update.filePath);
              }
              if (update.fileSize !== undefined) {
                setClauses.push('fileSize = ?');
                replacements.push(update.fileSize);
              }
              if (update.removed !== undefined) {
                setClauses.push('removed = ?');
                replacements.push(update.removed ? 1 : 0);
              }

              if (setClauses.length > 0) {
                replacements.push(update.id);
                const query = `UPDATE Videos SET ${setClauses.join(', ')} WHERE id = ?`;

                try {
                  await sequelize.query(query, {
                    replacements: replacements,
                    type: Sequelize.QueryTypes.UPDATE
                  });
                  batchSuccess++;
                } catch (err) {
                  batchFailed++;
                  logger.error({ err, videoId: update.id }, 'Failed to update video');
                }
              }
            }

            if (batchFailed > 0) {
              logger.info({ batchSuccess, batchFailed }, 'Batch update results');
            }
          }
        }

        totalProcessed += videos.length;
        totalUpdated += chunkUpdated;
        totalRemoved += chunkRemoved;
        offset += VIDEO_CHUNK_SIZE;

        // Log progress every few chunks
        if (offset % (VIDEO_CHUNK_SIZE * 5) === 0) {
          logProgress(`Progress: ${totalProcessed}/${totalCount} videos processed, ${totalUpdated} updated, ${totalRemoved} removed`);
        }
      }

      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.info({
        elapsed,
        totalProcessed,
        filesOnDisk: fileMap.size,
        updated: totalUpdated,
        removed: totalRemoved
      }, 'Video metadata backfill completed');

      return {
        processed: totalProcessed,
        filesOnDisk: fileMap.size,
        updated: totalUpdated,
        removed: totalRemoved,
        timeElapsed: elapsed
      };
    } catch (err) {
      if (err.message && err.message.includes('Time limit exceeded')) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logger.info({ elapsed }, 'Video metadata backfill stopped (time limit reached), will continue at next scheduled run');
        return { timedOut: true, timeElapsed: elapsed };
      }
      logger.error({ err }, 'Error during video metadata backfill');
      throw err;
    }
  }
}

module.exports = new VideosModule();
