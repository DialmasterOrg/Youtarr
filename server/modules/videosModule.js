const { Sequelize, sequelize } = require('../db.js');
const { Video } = require('../models');
const fs = require('fs').promises;
const path = require('path');
const configModule = require('./configModule');
const fileCheckModule = require('./fileCheckModule');
const watchStatusQueries = require('./mediaServers/watchStatusQueries');
const logger = require('../logger');
const messageEmitter = require('./messageEmitter');
const m3uGenerator = require('./m3uGenerator');
const { AUDIO_EXTENSIONS, MEDIA_EXTENSIONS } = require('./filesystem/constants');
const { probeVideoDimensions } = require('./resolutionTier');

// Backfill row updates are applied in parameterized batches of this size,
// and flushed mid-chunk at the same cadence so completed work survives a
// time-limit abort.
const BACKFILL_UPDATE_BATCH_SIZE = 100;

class VideosModule {
  constructor() {
    this._backfillRunning = false;
  }

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
      protectedFilter = 'off',
      missingFilter = 'off',
      watchedFilter = 'off',
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

      if (protectedFilter === 'only') {
        whereConditions.push('Videos.protected = 1');
      } else if (protectedFilter === 'exclude') {
        whereConditions.push('Videos.protected = 0');
      }

      if (missingFilter === 'only') {
        whereConditions.push('Videos.removed = 1');
      } else if (missingFilter === 'exclude') {
        whereConditions.push('Videos.removed = 0');
      }

      if (watchedFilter === 'only' || watchedFilter === 'exclude') {
        const watched = watchStatusQueries.buildWatchedExistsSql();
        whereConditions.push(watchedFilter === 'only' ? watched.sql : `NOT ${watched.sql}`);
        Object.assign(replacements, watched.replacements);
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
          Videos.audioFilePath,
          Videos.audioFileSize,
          Videos.removed,
          Videos.youtube_removed,
          Videos.youtube_removed_checked_at,
          Videos.media_type,
          Videos.normalized_rating,
          Videos.rating_source,
          Videos.protected,
          Videos.video_resolution,
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

      // Watched-servers summary for the list UI, honoring the configured
      // watched rule; per-server detail lives behind /api/videos/:id/watch-status.
      const watchedByVideoId = await watchStatusQueries.getWatchedByMap(videos.map((v) => v.id));
      for (const video of videos) {
        video.watchedBy = watchedByVideoId.get(video.id) || [];
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

  /**
   * Bulk update video ratings
   * @param {number[]} videoIds - List of database IDs
   * @param {string|null} rating - The new rating value
   * @returns {Promise<{success:number[], warnings:Array<{id:number, warning:string}>, failed:Array<{id:number, error:string}>}>}
   */
  async bulkUpdateVideoRatings(videoIds, rating) {
    const results = {
      success: [],
      warnings: [],
      failed: []
    };

    const nfoGenerator = require('./nfoGenerator');

    for (const id of videoIds) {
      try {
        const video = await Video.findByPk(id);
        if (!video) {
          results.failed.push({ id, error: 'Video not found' });
          continue;
        }

        await video.update({
          normalized_rating: rating,
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
            } catch (parseErr) {
              logger.warn({ parseErr, jsonPath }, 'Failed to parse .info.json for rating update');
              results.warnings.push({ id, warning: 'Database updated but NFO not regenerated (corrupt .info.json)' });
              continue;
            }

            jsonData.normalized_rating = rating;
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

  async scanForVideoFiles(dir, fileMap = new Map(), duplicates = new Map()) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanForVideoFiles(fullPath, fileMap, duplicates);
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const ext = path.extname(entry.name).toLowerCase();
        if (!MEDIA_EXTENSIONS.includes(ext)) {
          continue;
        }

        // Match files ending with [<id>].<ext>; <id> is whatever yt-dlp wrote
        // between the brackets at the end of the filename.
        const match = entry.name.match(/\[([^[\]]+)\]\.[a-z0-9]+$/i);
        if (!match) {
          continue;
        }

        const youtubeId = match[1];
        const isAudio = AUDIO_EXTENSIONS.includes(ext);
        const stats = await fs.stat(fullPath);

        if (!fileMap.has(youtubeId)) {
          fileMap.set(youtubeId, {
            videoFilePath: null,
            videoFileSize: null,
            audioFilePath: null,
            audioFileSize: null
          });
        }

        const existing = fileMap.get(youtubeId);
        const pathKey = isAudio ? 'audioFilePath' : 'videoFilePath';
        const sizeKey = isAudio ? 'audioFileSize' : 'videoFileSize';

        if (existing[pathKey]) {
          if (!duplicates.has(youtubeId)) {
            duplicates.set(youtubeId, []);
          }
          duplicates.get(youtubeId).push(fullPath);

          if (stats.size > existing[sizeKey]) {
            logger.warn(
              { youtubeId, filePath: fullPath, size: stats.size, type: ext },
              'Duplicate found: keeping larger file'
            );
            existing[pathKey] = fullPath;
            existing[sizeKey] = stats.size;
          }
        } else {
          existing[pathKey] = fullPath;
          existing[sizeKey] = stats.size;
        }
      }
    } catch (err) {
      logger.error({ err, dir }, 'Error scanning directory');
    }

    return { fileMap, duplicates };
  }

  /**
   * Apply backfill row updates in small parameterized batches. Deliberately
   * does not check the run's time limit: once a flush starts it completes,
   * so the expensive work already done (ffprobes, file stats) is never
   * discarded. A flush of <= 1000 plain UPDATEs overruns the limit by
   * seconds at most.
   */
  async _flushBackfillUpdates(updates) {
    for (let i = 0; i < updates.length; i += BACKFILL_UPDATE_BATCH_SIZE) {
      await new Promise(resolve => setImmediate(resolve)); // Yield control

      const batch = updates.slice(i, i + BACKFILL_UPDATE_BATCH_SIZE);

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
        if (update.audioFilePath !== undefined) {
          setClauses.push('audioFilePath = ?');
          replacements.push(update.audioFilePath);
        }
        if (update.audioFileSize !== undefined) {
          setClauses.push('audioFileSize = ?');
          replacements.push(update.audioFileSize);
        }
        if (update.video_resolution !== undefined) {
          setClauses.push('video_resolution = ?');
          replacements.push(update.video_resolution);
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

  async backfillVideoMetadata(arg = {}) {
    const opts = typeof arg === 'number' ? { timeLimit: arg } : arg;
    const timeLimit = opts.timeLimit ?? 5 * 60 * 1000;
    const trigger = opts.trigger ?? 'scheduled';

    if (this._backfillRunning) {
      logger.info({ trigger }, 'Backfill already running, skipping');
      return { skipped: true, reason: 'already-running' };
    }
    this._backfillRunning = true;

    const startTime = Date.now();
    const startedAtIso = new Date(startTime).toISOString();
    const logProgress = (message) => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      logger.info({ elapsed, context: 'backfill' }, message);
    };

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalRemoved = 0;
    let fileMapSize = 0;
    let result;

    try {
      // Emit inside the try so a synchronous emit failure still triggers the
      // finally block and clears the lock.
      messageEmitter.emitMessage('broadcast', null, 'server', 'rescanStatus', {
        running: true,
        trigger
      });

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
      fileMapSize = fileMap.size;
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

      // Get total count first
      const totalCount = await Video.count();
      logProgress(`Processing ${totalCount} videos from database...`);

      while (offset < totalCount) {
        checkTimeLimit();

        // Fetch a chunk of videos
        const videos = await Video.findAll({
          attributes: ['id', 'youtubeId', 'filePath', 'fileSize', 'audioFilePath', 'audioFileSize', 'removed', 'video_resolution'],
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
            // Check if any file exists (video or audio)
            const hasVideoFile = !!fileInfo.videoFilePath;
            const hasAudioFile = !!fileInfo.audioFilePath;
            const hasAnyFile = hasVideoFile || hasAudioFile;

            if (hasAnyFile) {
              // Check if update needed for video file
              const videoPathChanged = hasVideoFile && video.filePath !== fileInfo.videoFilePath;
              const videoSizeChanged = hasVideoFile && (!video.fileSize || video.fileSize !== fileInfo.videoFileSize.toString());

              // Check if update needed for audio file
              const audioPathChanged = hasAudioFile && video.audioFilePath !== fileInfo.audioFilePath;
              const audioSizeChanged = hasAudioFile && (!video.audioFileSize || video.audioFileSize !== fileInfo.audioFileSize.toString());

              // Check if we need to clear audio fields (audio file was deleted)
              const audioFileRemoved = !hasAudioFile && (video.audioFilePath || video.audioFileSize);

              // Check if we need to clear video fields (video file was deleted but audio exists)
              const videoFileRemoved = !hasVideoFile && hasAudioFile && (video.filePath || video.fileSize);

              // Backfill dimensions for rows that predate the
              // video_resolution column. ffprobe on the actual file is ground
              // truth; only probed while the column is NULL. "0x0" = probed
              // but undeterminable, which stops failed rows from being
              // re-probed every night (the file may sit on a network share);
              // a later re-download re-stamps at download time regardless.
              let probedResolution = null;
              if (hasVideoFile && video.video_resolution == null) {
                probedResolution = await probeVideoDimensions(fileInfo.videoFilePath);
                if (probedResolution === null) {
                  probedResolution = '0x0';
                }
              }

              // Sequelize BOOLEAN columns come back as 0/1 in raw mode, so use a
              // truthy check; `=== true` would never match the raw integer.
              if (videoPathChanged || videoSizeChanged || audioPathChanged || audioSizeChanged ||
                  audioFileRemoved || videoFileRemoved || video.removed || probedResolution !== null) {
                const update = {
                  id: video.id,
                  removed: false
                };

                // Update video file info
                if (hasVideoFile) {
                  update.filePath = fileInfo.videoFilePath;
                  update.fileSize = fileInfo.videoFileSize;
                } else if (videoFileRemoved) {
                  update.filePath = null;
                  update.fileSize = null;
                  // The stored dimensions belong to the deleted file; clearing
                  // them lets a reappearing file be re-probed instead of
                  // keeping a stale label.
                  update.video_resolution = null;
                }

                // Update audio file info
                if (hasAudioFile) {
                  update.audioFilePath = fileInfo.audioFilePath;
                  update.audioFileSize = fileInfo.audioFileSize;
                } else if (audioFileRemoved) {
                  update.audioFilePath = null;
                  update.audioFileSize = null;
                }

                if (probedResolution !== null) {
                  update.video_resolution = probedResolution;
                }

                bulkUpdates.push(update);
                chunkUpdated++;
              }
            }
          } else {
            // No files exist in fileMap for this video
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

          // Flush completed work periodically instead of once per chunk: on a
          // slow network share a chunk's ffprobes can exceed the whole time
          // budget, and losing the chunk's pending updates on abort would
          // re-probe the same rows next run and never converge.
          if (bulkUpdates.length >= BACKFILL_UPDATE_BATCH_SIZE) {
            await this._flushBackfillUpdates(bulkUpdates.splice(0));
          }
        }

        // Flush the chunk's remaining updates
        if (bulkUpdates.length > 0) {
          logProgress(`Updating ${bulkUpdates.length} records (chunk ${Math.floor(offset / VIDEO_CHUNK_SIZE) + 1})...`);
          await this._flushBackfillUpdates(bulkUpdates.splice(0));
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
        filesOnDisk: fileMapSize,
        updated: totalUpdated,
        removed: totalRemoved
      }, 'Video metadata backfill completed');

      result = {
        processed: totalProcessed,
        filesOnDisk: fileMapSize,
        updated: totalUpdated,
        removed: totalRemoved,
        timeElapsed: elapsed,
        trigger,
        startedAt: startedAtIso,
        completedAt: new Date().toISOString(),
        status: 'completed'
      };
      return result;
    } catch (err) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (err.message && err.message.includes('Time limit exceeded')) {
        logger.info({ elapsed }, 'Video metadata backfill stopped (time limit reached), will continue at next scheduled run');
        result = {
          timedOut: true,
          timeElapsed: elapsed,
          trigger,
          startedAt: startedAtIso,
          completedAt: new Date().toISOString(),
          status: 'timed-out',
          processed: totalProcessed,
          filesOnDisk: fileMapSize,
          updated: totalUpdated,
          removed: totalRemoved
        };
        return result;
      }
      logger.error({ err }, 'Error during video metadata backfill');
      result = {
        trigger,
        startedAt: startedAtIso,
        completedAt: new Date().toISOString(),
        status: 'error',
        errorMessage: err.message || 'Unknown error',
        processed: totalProcessed,
        filesOnDisk: fileMapSize,
        updated: totalUpdated,
        removed: totalRemoved
      };
      throw err;
    } finally {
      let lastRun = null;

      if (result) {
        lastRun = {
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          trigger: result.trigger,
          status: result.status,
          videosUpdated: result.updated || 0,
          videosMarkedMissing: result.removed || 0,
          videosScanned: result.processed || 0,
          filesFoundOnDisk: result.filesOnDisk || 0,
          errorMessage: result.errorMessage || null
        };

        try {
          const currentConfig = configModule.getConfig();
          configModule.updateConfig({ ...currentConfig, rescanLastRun: lastRun });
        } catch (persistErr) {
          logger.error({ err: persistErr }, 'Failed to persist rescanLastRun');
        }
      }

      this._backfillRunning = false;

      try {
        messageEmitter.emitMessage('broadcast', null, 'server', 'rescanStatus', {
          running: false,
          lastRun
        });
      } catch (emitErr) {
        logger.error({ err: emitErr }, 'Failed to emit rescanStatus completion');
      }

      if (result) {
        // Reconcile channel .m3u files with what the rescan found on disk.
        m3uGenerator.regenerateAllChannelM3Us().catch((err) => {
          logger.error({ err }, 'Failed to refresh channel M3Us after rescan');
        });
      }
    }
  }

  /**
   * Atomically check the lock and kick off a backfill. Returns synchronously
   * with `started: true` (caller should respond 202) or `started: false`
   * (caller should respond 409). The actual backfill runs as a fire-and-forget
   * task; errors are logged inside `backfillVideoMetadata` itself.
   */
  tryStartBackfill({ trigger = 'manual' } = {}) {
    if (this._backfillRunning) {
      return { started: false, reason: 'already-running' };
    }
    // backfillVideoMetadata sets the flag synchronously before its first await,
    // so launching it here is race-free for in-process callers.
    this.backfillVideoMetadata({ trigger }).catch((err) => {
      logger.error({ err }, 'Manual backfill run failed');
    });
    return { started: true };
  }

  isBackfillRunning() {
    return this._backfillRunning;
  }

  async setVideoProtection(id, protectedState) {
    const video = await Video.findByPk(id);
    if (!video) {
      throw new Error('Video not found');
    }
    await video.update({ protected: protectedState });
    return { id: video.id, protected: protectedState };
  }
}

module.exports = new VideosModule();
