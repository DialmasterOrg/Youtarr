const { Sequelize, sequelize } = require('../db.js');
const { Video } = require('../models');
const fs = require('fs').promises;
const path = require('path');
const configModule = require('./configModule');

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
      channelFilter = ''
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

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Build ORDER BY
      let orderByColumn;
      if (sortBy === 'published') {
        orderByColumn = 'Videos.originalDate';
      } else {
        orderByColumn = 'COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, \'%Y%m%d\'))';
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
          COALESCE(Jobs.timeCreated, STR_TO_DATE(Videos.originalDate, '%Y%m%d')) AS timeCreated
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

      // Real-time file check for paginated results
      const outputDir = configModule.directoryPath;
      if (outputDir && videos.length > 0) {
        const updates = [];

        for (const video of videos) {
          if (video.filePath) {
            try {
              const stats = await fs.stat(video.filePath);

              // File exists - update if marked as removed or size changed
              if (video.removed || video.fileSize !== stats.size.toString()) {
                updates.push({
                  id: video.id,
                  fileSize: stats.size,
                  removed: false
                });
                // Update the video object for immediate response
                video.fileSize = stats.size.toString();
                video.removed = false;
              }
            } catch (err) {
              // File doesn't exist - mark as removed if not already
              if (err.code === 'ENOENT' && !video.removed) {
                updates.push({
                  id: video.id,
                  removed: true
                });
                // Update the video object for immediate response
                video.removed = true;
              }
            }
          } else if (!video.removed && video.youTubeChannelName && video.youtubeId) {
            // No file path stored, try to find the file by scanning the channel directory
            const channelDir = path.join(outputDir, video.youTubeChannelName);
            let found = false;

            try {
              const files = await fs.readdir(channelDir);

              // Look for a file ending with [youtubeId].mp4
              for (const file of files) {
                if (file.endsWith(`[${video.youtubeId}].mp4`)) {
                  const filePath = path.join(channelDir, file);
                  const stats = await fs.stat(filePath);

                  updates.push({
                    id: video.id,
                    filePath: filePath,
                    fileSize: stats.size,
                    removed: false
                  });
                  // Update the video object for immediate response
                  video.filePath = filePath;
                  video.fileSize = stats.size.toString();
                  video.removed = false;
                  found = true;
                  break;
                }
              }

              // If not found with brackets, check for simple format
              if (!found) {
                for (const file of files) {
                  if (file === `${video.youtubeId}.mp4`) {
                    const filePath = path.join(channelDir, file);
                    const stats = await fs.stat(filePath);

                    updates.push({
                      id: video.id,
                      filePath: filePath,
                      fileSize: stats.size,
                      removed: false
                    });
                    // Update the video object for immediate response
                    video.filePath = filePath;
                    video.fileSize = stats.size.toString();
                    video.removed = false;
                    found = true;
                    break;
                  }
                }
              }

              if (!found && !video.removed) {
                updates.push({
                  id: video.id,
                  removed: true
                });
                // Update the video object for immediate response
                video.removed = true;
              }
            } catch (err) {
              // Channel directory doesn't exist or can't be read
              if (!video.removed) {
                updates.push({
                  id: video.id,
                  removed: true
                });
                // Update the video object for immediate response
                video.removed = true;
              }
            }
          }
        }

        // Batch update the database if there are changes
        if (updates.length > 0) {
          // Build a simple UPDATE query for the changes
          for (const update of updates) {
            const setClauses = [];
            const values = [];

            if (update.filePath !== undefined) {
              setClauses.push('filePath = ?');
              values.push(update.filePath);
            }
            if (update.fileSize !== undefined) {
              setClauses.push('fileSize = ?');
              values.push(update.fileSize);
            }
            if (update.removed !== undefined) {
              setClauses.push('removed = ?');
              values.push(update.removed ? 1 : 0);
            }

            if (setClauses.length > 0) {
              values.push(update.id);
              await sequelize.query(
                `UPDATE Videos SET ${setClauses.join(', ')} WHERE id = ?`,
                {
                  replacements: values,
                  type: Sequelize.QueryTypes.UPDATE
                }
              );
            }
          }
        }
      }

      return {
        videos,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (err) {
      console.error('Error in getVideosPaginated:', err);
      throw err;
    }
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
          // Extract YouTube ID from filename (format: [title] [youtube_id].mp4)
          // Match the LAST bracketed item before .mp4
          // This handles titles with brackets like "Video [Part 1] [youtube_id].mp4"
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
                console.log(`  Duplicate found for ${youtubeId}: keeping larger file (${fullPath})`);
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
      console.error(`Error scanning directory ${dir}:`, err.message);
    }

    return { fileMap, duplicates };
  }

  async backfillVideoMetadata(timeLimit = 5 * 60 * 1000) { // Default 5 minutes
    const startTime = Date.now();
    const logProgress = (message) => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Backfill ${elapsed}s] ${message}`);
    };

    try {
      logProgress('Starting video metadata backfill...');
      const outputDir = configModule.directoryPath;

      if (!outputDir) {
        console.log('No YouTube output directory configured, skipping backfill');
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
        console.log(`WARNING: Found ${duplicates.size} videos with duplicate files:`);
        for (const [youtubeId, paths] of duplicates.entries()) {
          console.log(`  ${youtubeId}: ${paths.length} files found`);
          paths.forEach(p => console.log(`    - ${p}`));
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
            // File doesn't exist
            if (!video.removed) {
              bulkUpdates.push({
                id: video.id,
                removed: true
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

            // Build bulk update query using CASE statements for efficiency
            const updateIds = batch.map(u => u.id);

            // Build CASE statements for each field
            const filePathCases = [];
            const fileSizeCases = [];
            const removedCases = [];

            for (const update of batch) {
              if (update.filePath !== undefined) {
                filePathCases.push(`WHEN ${update.id} THEN '${update.filePath.replace(/'/g, '\'\'')}'`);
              }
              if (update.fileSize !== undefined) {
                fileSizeCases.push(`WHEN ${update.id} THEN ${update.fileSize}`);
              }
              if (update.removed !== undefined) {
                removedCases.push(`WHEN ${update.id} THEN ${update.removed ? 1 : 0}`);
              }
            }

            // Build and execute update query
            let query = 'UPDATE Videos SET ';
            const setClauses = [];

            if (filePathCases.length > 0) {
              setClauses.push(`filePath = CASE id ${filePathCases.join(' ')} ELSE filePath END`);
            }
            if (fileSizeCases.length > 0) {
              setClauses.push(`fileSize = CASE id ${fileSizeCases.join(' ')} ELSE fileSize END`);
            }
            if (removedCases.length > 0) {
              setClauses.push(`removed = CASE id ${removedCases.join(' ')} ELSE removed END`);
            }

            if (setClauses.length > 0) {
              query += setClauses.join(', ');
              query += ` WHERE id IN (${updateIds.join(',')})`;

              await sequelize.query(query);
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
      console.log(`Video metadata backfill completed in ${elapsed} seconds:`);
      console.log(`  - Total videos processed: ${totalProcessed}`);
      console.log(`  - Video files found on disk: ${fileMap.size}`);
      console.log(`  - Videos updated with file info: ${totalUpdated}`);
      console.log(`  - Videos marked as removed: ${totalRemoved}`);

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
        console.log(`Video metadata backfill stopped after ${elapsed} seconds (time limit reached)`);
        console.log('Backfill will continue at next scheduled run');
        return { timedOut: true, timeElapsed: elapsed };
      }
      console.error('Error during video metadata backfill:', err);
      throw err;
    }
  }
}

module.exports = new VideosModule();
