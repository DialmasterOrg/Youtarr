const { Sequelize, sequelize } = require('../db.js');
const { injectReplacements } = require('sequelize/lib/utils/sql');
const { Video, JobVideo, Job } = require('../models');
const fs = require('fs').promises;
const path = require('path');
const configModule = require('./configModule');
const fileCheckModule = require('./fileCheckModule');
const watchStatusQueries = require('./mediaServers/watchStatusQueries');
const logger = require('../logger');
const messageEmitter = require('./messageEmitter');
const m3uGenerator = require('./m3uGenerator');
const scheduledTaskRuns = require('./scheduledTaskRuns');
const rescanRunSummary = require('./rescanRunSummary');
const { AUDIO_EXTENSIONS, MEDIA_EXTENSIONS } = require('./filesystem/constants');
const { probeVideoDimensions } = require('./resolutionTier');
const createLimiter = require('./subscriptionImport/concurrencyLimiter');

// Backfill row updates are applied in parameterized batches of this size,
// and flushed mid-chunk at the same cadence so completed work survives a
// time-limit abort.
const BACKFILL_UPDATE_BATCH_SIZE = 100;

// ffprobes are I/O-bound, so running 4 at once cuts backfill wall time
// ~4x without piling up subprocesses next to downloads and Plex.
const BACKFILL_PROBE_CONCURRENCY = 4;

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
      const where = {};

      if (search) {
        where[Sequelize.Op.and] = [{
          [Sequelize.Op.or]: [
            { youTubeVideoName: { [Sequelize.Op.like]: `%${search}%` } },
            { youTubeChannelName: { [Sequelize.Op.like]: `%${search}%` } },
          ],
        }];
      }

      if (channelFilter) {
        where.youTubeChannelName = channelFilter;
      }

      if (dateFrom) {
        where.originalDate = { [Sequelize.Op.gte]: dateFrom.replace(/-/g, '') };
      }

      if (dateTo) {
        where.originalDate ??= {};
        where.originalDate[Sequelize.Op.lte] = dateTo.replace(/-/g, '');
      }

      if (protectedFilter === 'only') {
        where.protected = true;
      } else if (protectedFilter === 'exclude') {
        where.protected = false;
      }

      if (missingFilter === 'only') {
        where.removed = true;
      } else if (missingFilter === 'exclude') {
        where.removed = false;
      }

      if (watchedFilter === 'only' || watchedFilter === 'exclude') {
        const watched = watchStatusQueries.buildWatchedExistsSql('Video');
        const sql = injectReplacements(watched.sql, sequelize.dialect, watched.replacements);
        where[Sequelize.Op.and] ??= [];
        where[Sequelize.Op.and].push(sequelize.literal(watchedFilter === 'only' ? sql : `NOT ${sql}`));
      }

      const options = {
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
        where,
      };

      // Get total count
      const total = await Video.count({
        ...options,
        distinct: true,
      });

      // Define attributes
      options.attributes = {
        include: [
          [
            sequelize.fn(
              'COALESCE',
              sequelize.col('Video.last_downloaded_at'),
              sequelize.col('jobVideos->job.time_created'),
              sequelize.fn('STR_TO_DATE', sequelize.col('Video.original_date'), '%Y%m%d'),
            ),
            'timeCreated',
          ],
        ],
      };

      // Add ordering
      let orderByColumn;
      if (sortBy === 'published') {
        orderByColumn = sequelize.col('originalDate');
      } else {
        orderByColumn = sequelize.col('timeCreated');
      }
      options.order = [[orderByColumn, sortOrder.toUpperCase()]];

      // Get paginated videos
      options.limit = limit;
      options.offset = offset;
      options.subQuery = false;
      options.raw = true;
      const videos = await Video.findAll(options);

      // Real-time file check for videos that have a known file path
      // Only check videos with an existing filePath to avoid incorrectly marking videos as removed
      // Videos without a filePath will be handled by the backfill process
      const { videos: checkedVideos, updates } = await fileCheckModule.checkVideoFiles(videos);

      // Update the videos array with the checked results
      for (let i = 0; i < videos.length; i++) {
        videos[i] = checkedVideos[i];
      }

      // Batch update the database if there are changes
      await fileCheckModule.applyVideoUpdates(updates);

      // Check if videos still exist on YouTube and mark as removed if they don't
      const videoValidationModule = require('./videoValidationModule');
      const youtubeUpdates = [];
      const timestampUpdates = [];
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      // One stamp for the whole pass, so the response and the rows agree.
      const checkedAt = new Date();

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

          if (!exists) {
            logger.info({ youtubeId: video.youtubeId }, 'Video no longer exists on YouTube, marking as removed');
            video.youtube_removed = true;
            video.youtube_removed_checked_at = checkedAt;
            return { id: video.id, removed: true, checked_at: checkedAt };
          } else {
            // Video exists, just update the timestamp
            video.youtube_removed_checked_at = checkedAt;
            return { id: video.id, removed: false, checked_at: checkedAt };
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

      // Bulk update videos table for removed videos
      if (youtubeUpdates.length > 0) {
        await Video.update(
          { youtube_removed: true, youtube_removed_checked_at: checkedAt },
          { where: { id: youtubeUpdates.map(u => u.id) } }
        );
      }

      // Bulk update videos table for timestamp-only updates
      if (timestampUpdates.length > 0) {
        await Video.update(
          { youtube_removed_checked_at: checkedAt },
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
      const videoChannels = await Video.aggregate('youTubeChannelName', 'distinct', {
        where: {
          youTubeChannelName: {
            [Sequelize.Op.not]: null,
          },
        },
        order: [['youTubeChannelName', 'ASC']],
        plain: false,
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
        if (row.distinct) {
          channelSet.add(row.distinct);
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
        const attributes = {
          filePath: update.filePath,
          fileSize: update.fileSize,
          audioFilePath: update.audioFilePath,
          audioFileSize: update.audioFileSize,
          video_resolution: update.video_resolution,
          removed: update.removed,
        };

        if (Object.values(attributes).some((v) => v !== undefined)) {
          try {
            await Video.update(attributes, { where: { id: update.id } });
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
      const probeLimit = createLimiter(BACKFILL_PROBE_CONCURRENCY);
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

        // Process the chunk in 100-row slices: probe, apply the row logic, flush.
        for (let sliceStart = 0; sliceStart < videos.length; sliceStart += BACKFILL_UPDATE_BATCH_SIZE) {
          checkTimeLimit();
          await new Promise(resolve => setImmediate(resolve)); // Yield control

          const slice = videos.slice(sliceStart, sliceStart + BACKFILL_UPDATE_BATCH_SIZE);

          // Backfill dimensions for rows that predate the video_resolution
          // column. ffprobe on the actual file is ground truth; only probed
          // while the column is NULL. "0x0" = probed but undeterminable,
          // which stops failed rows from being re-probed every night (the
          // file may sit on a network share); a later re-download re-stamps
          // at download time regardless.
          const probeResults = new Map();
          await Promise.all(slice.map((video) => {
            const fileInfo = fileMap.get(video.youtubeId);
            if (!fileInfo || !fileInfo.videoFilePath || video.video_resolution != null) {
              return null;
            }
            return probeLimit(async () => {
              const probed = await probeVideoDimensions(fileInfo.videoFilePath);
              probeResults.set(video.youtubeId, probed === null ? '0x0' : probed);
            });
          }).filter(Boolean));

          for (const video of slice) {
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

                const probedResolution = probeResults.get(video.youtubeId) ?? null;

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
          }

          // Flush each slice's updates right away: on a slow network share the
          // probes can outlast the whole time budget, and work lost to an abort
          // would get re-probed next run and never converge.
          if (bulkUpdates.length > 0) {
            logProgress(`Updating ${bulkUpdates.length} records (chunk ${Math.floor(offset / VIDEO_CHUNK_SIZE) + 1})...`);
            await this._flushBackfillUpdates(bulkUpdates.splice(0));
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
      // Resolve with the failure and the counters it reached rather than
      // rethrow, so every caller and the run history keep the partial progress.
      return result;
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

        // Scheduled runs are recorded by the task scheduler itself.
        if (result.trigger !== 'scheduled') {
          try {
            await scheduledTaskRuns.record({
              taskKey: rescanRunSummary.TASK_KEY,
              trigger: result.trigger,
              startedAt: new Date(result.startedAt),
              finishedAt: new Date(result.completedAt),
              ...rescanRunSummary.toRunRecord(result),
            });
          } catch (persistErr) {
            logger.error({ err: persistErr }, 'Failed to record rescan run');
          }
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
