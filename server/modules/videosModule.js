const { Sequelize, sequelize } = require('../db.js');
const { injectReplacements } = require('sequelize/lib/utils/sql');
const { Video, JobVideo, Job } = require('../models');
const fs = require('fs').promises;
const path = require('path');
const configModule = require('./configModule');
const fileCheckModule = require('./fileCheckModule');
const watchStatusQueries = require('./mediaServers/watchStatusQueries');
const ratingMapper = require('./ratingMapper');
const logger = require('../logger');
const messageEmitter = require('./messageEmitter');
const m3uGenerator = require('./m3uGenerator');
const scheduledTaskRuns = require('./scheduledTaskRuns');
const rescanRunSummary = require('./rescanRunSummary');
const { AUDIO_EXTENSIONS, MEDIA_EXTENSIONS } = require('./filesystem/constants');
const { probeVideoDimensions } = require('./resolutionTier');
const createLimiter = require('./subscriptionImport/concurrencyLimiter');
const { isRescanCandidate, resolveRescanUpdate } = require('./rescanRowUpdate');
const { unchangedSinceRead, GUARDED_COLUMNS } = require('./videoRowGuard');
const youtubeExistenceCheck = require('./youtubeExistenceCheck');
const { LIBRARY_CHECK_REASONS, checkLibraryRoot, isRowUnderLibraryCheck, libraryCheckCoversRows } = require('./libraryRootCheck');
const { REMOVAL_STATES, stateWhere, notStateWhere } = require('./videoRemovalState');

const { EXISTENCE } = youtubeExistenceCheck;

// Backfill row updates are applied in parameterized batches of this size,
// and flushed mid-chunk at the same cadence so completed work survives a
// time-limit abort.
const BACKFILL_UPDATE_BATCH_SIZE = 100;

// ffprobes are I/O-bound, so running 4 at once cuts backfill wall time
// ~4x without piling up subprocesses next to downloads and Plex.
const BACKFILL_PROBE_CONCURRENCY = 4;

// Each nominated row gets a fresh stat and then its write, as one unit so the
// gap between them stays short. Bounded so network shares and the database
// pool aren't flooded.
const RESCAN_WRITE_CONCURRENCY = 4;

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
      deletedFilter = 'off',
      watchedFilter = 'off',
      maxRating = null,
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

      // Missing (file not found) and deleted (removed by Youtarr, or before
      // the reason was recorded) are both `removed` rows; see videoRemovalState.
      const stateFilter = (mode, state) => {
        if (mode !== 'only' && mode !== 'exclude') return null;
        return mode === 'only' ? stateWhere(state) : notStateWhere(state);
      };
      const missingWhere = stateFilter(missingFilter, REMOVAL_STATES.MISSING);
      const deletedWhere = stateFilter(deletedFilter, REMOVAL_STATES.DELETED);
      for (const clause of [missingWhere, deletedWhere]) {
        if (!clause) continue;
        where[Sequelize.Op.and] ??= [];
        where[Sequelize.Op.and].push(clause);
      }

      if (watchedFilter === 'only' || watchedFilter === 'exclude') {
        const watched = watchStatusQueries.buildWatchedExistsSql('Video');
        const sql = injectReplacements(watched.sql, sequelize.dialect, watched.replacements);
        where[Sequelize.Op.and] ??= [];
        where[Sequelize.Op.and].push(sequelize.literal(watchedFilter === 'only' ? sql : `NOT ${sql}`));
      }

      const allowedRatings = maxRating ? ratingMapper.getRatingsAtOrBelow(maxRating) : null;
      if (allowedRatings) {
        where[Sequelize.Op.and] ??= [];
        where[Sequelize.Op.and].push({
          [Sequelize.Op.or]: [
            { normalized_rating: null },
            { normalized_rating: { [Sequelize.Op.in]: allowedRatings } },
          ],
        });
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

      // How many deleted videos the default view hides, for the "N deleted
      // hidden" note: the same filters with "deleted only" in place of the
      // exclusion.
      let hiddenDeletedCount = null;
      if (deletedFilter === 'exclude') {
        const hiddenWhere = {
          ...where,
          [Sequelize.Op.and]: where[Sequelize.Op.and].map((clause) => (clause === deletedWhere ? stateWhere(REMOVAL_STATES.DELETED) : clause)),
        };
        hiddenDeletedCount = await Video.count({ ...options, where: hiddenWhere, distinct: true });
      }

      // Define attributes
      options.attributes = {
        include: [
          [
            sequelize.fn(
              'COALESCE',
              sequelize.col('Video.last_downloaded_at'),
              sequelize.fn('MAX', sequelize.col('jobVideos->job.time_created')),
              sequelize.fn('STR_TO_DATE', sequelize.col('Video.original_date'), '%Y%m%d'),
            ),
            'timeCreated',
          ],
        ],
      };

      // A video downloaded by more than one job has a jobvideos row per job;
      // without grouping, each of those rows became a listing row (#922).
      options.group = 'Video.id';

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
      const { videos: checkedVideos, updates, libraryWarning } = await fileCheckModule.checkVideoFiles(videos);

      // Update the videos array with the checked results
      for (let i = 0; i < videos.length; i++) {
        videos[i] = checkedVideos[i];
      }

      // Batch update the database if there are changes
      await fileCheckModule.applyVideoUpdates(updates);

      // Check if videos still exist on YouTube and mark as removed if they don't
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
          const existence = await youtubeExistenceCheck.check(video.youtubeId);
          if (existence === EXISTENCE.UNKNOWN) {
            return null;
          }

          if (existence === EXISTENCE.REMOVED) {
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
        enabledChannels: enabledChannels.map(ch => ({ channel_id: ch.channel_id, uploader: ch.uploader })),
        // Set when rows were not marked missing because the downloads folder looks unmounted.
        libraryWarning,
        hiddenDeletedCount
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

  /**
   * Walk a folder tree for downloaded media files, keyed by YouTube id.
   * A folder or file that can't be read is skipped and counted in `unreadable`,
   * so callers can tell a partial walk from a complete one; a file deleted
   * mid-walk is simply absent.
   * @returns {Promise<{fileMap: Map, duplicates: Map, unreadable: number}>}
   */
  async scanForVideoFiles(dir, fileMap = new Map(), duplicates = new Map(), problems = { unreadable: 0 }) {
    const result = () => ({ fileMap, duplicates, unreadable: problems.unreadable });
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      problems.unreadable++;
      logger.error({ err, dir }, 'Error scanning directory');
      return result();
    }

    // Files in this folder that couldn't be checked, logged once per folder:
    // a folder listable but not searchable (e.g. after chmod -R 644) fails
    // every file in it.
    let uncheckedFiles = 0;
    let firstCheckError = null;
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.scanForVideoFiles(fullPath, fileMap, duplicates, problems);
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
      // One bad file must not end the walk of its folder.
      let stats;
      try {
        stats = await fs.stat(fullPath);
      } catch (err) {
        // ENOENT: deleted since the folder was listed, so it's simply gone.
        if (err.code !== 'ENOENT') {
          problems.unreadable++;
          uncheckedFiles++;
          firstCheckError = firstCheckError || err;
        }
        continue;
      }

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

    if (uncheckedFiles > 0) {
      logger.warn({ err: firstCheckError, dir, uncheckedFiles }, 'Could not check files while scanning');
    }
    return result();
  }

  /**
   * Write the rescan's nominated rows. Each row's update is recomputed from a
   * fresh stat and written only if the row is unchanged since it was read, so
   * a download or deletion that landed after the walk is never undone.
   * Deliberately does not check the run's time limit: once started, a slice's
   * writes complete, so the expensive work already done is never discarded.
   * @param {Array<{row: Object, fileInfo: Object|undefined, probedResolution: string|null}>} candidates
   * @param {{holdBackMissing?: function(Object): boolean}} [options] - holdBackMissing: true for a row
   *   stored where the downloads folder looks partly unmounted; if it would be marked missing it is
   *   left alone and counted
   * @returns {Promise<{updated: number, removed: number, kept: number, skipped: number, failed: number, notMarkedMissing: number}>}
   */
  async _applyRescanUpdates(candidates, { holdBackMissing = () => false } = {}) {
    const counts = { updated: 0, removed: 0, kept: 0, skipped: 0, failed: 0, notMarkedMissing: 0 };
    const limit = createLimiter(RESCAN_WRITE_CONCURRENCY);
    await Promise.all(candidates.map(({ row, fileInfo, probedResolution }) => limit(async () => {
      try {
        const changes = await resolveRescanUpdate(row, fileInfo, probedResolution, (filePath) => fs.stat(filePath));
        // Kept as recorded: the files are where the row says, or couldn't be
        // checked. Counted so rows re-checked every run are visible.
        if (!changes) {
          counts.kept++;
          return;
        }
        if (changes.removed === true && holdBackMissing(row)) {
          counts.notMarkedMissing++;
          return;
        }
        const [affected] = await Video.update(changes, { where: unchangedSinceRead(row) });
        if (affected === 0) {
          counts.skipped++;
        } else if (changes.removed === true) {
          counts.removed++;
        } else {
          counts.updated++;
        }
      } catch (err) {
        counts.failed++;
        logger.error({ err, videoId: row.id }, 'Failed to update video');
      }
    })));
    return counts;
  }

  async backfillVideoMetadata(arg = {}) {
    const opts = typeof arg === 'number' ? { timeLimit: arg } : arg;
    const timeLimit = opts.timeLimit ?? 5 * 60 * 1000;
    const trigger = opts.trigger ?? 'scheduled';
    // Rescan anyway: a manual run over a folder the user emptied on purpose.
    const ignoreLibraryCheck = opts.ignoreLibraryCheck === true;

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
    let totalKept = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let totalNotMarkedMissing = 0;
    let fileMapSize = 0;
    let unreadableOnDisk = 0;
    // Set when the downloads folder looks partly unmounted: the scan runs, but
    // nothing is marked missing (see libraryRootCheck).
    let libraryCheckMessage = null;
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

      // An unmounted drive or share would make every present video look
      // gone. With no present rows under the failing folder there is nothing
      // to protect (a fresh install, or an empty subfolder nothing is stored
      // in), so the scan simply runs.
      let holdBackMissing = () => false;
      if (ignoreLibraryCheck) logger.warn({ trigger }, 'Rescan is skipping the downloads folder check by request');
      const libraryCheck = ignoreLibraryCheck ? { ok: true } : await checkLibraryRoot(outputDir);
      if (await libraryCheckCoversRows(libraryCheck, Video, { removed: false })) {
        const subfolderOnly = libraryCheck.reason === LIBRARY_CHECK_REASONS.SUBFOLDER_EMPTY
          || libraryCheck.reason === LIBRARY_CHECK_REASONS.SUBFOLDER_UNREADABLE;
        if (subfolderOnly) {
          // Only the rows stored under that subfolder are in doubt.
          holdBackMissing = (row) => isRowUnderLibraryCheck(libraryCheck, row);
          libraryCheckMessage = libraryCheck.message;
          logger.warn({ libraryCheck }, 'A subfolder looks unmounted or unreadable; the rescan will not mark videos in it missing');
        } else {
          logger.warn({ libraryCheck }, 'The downloads folder looks unmounted; skipping the rescan');
          result = {
            trigger,
            startedAt: startedAtIso,
            completedAt: new Date().toISOString(),
            status: 'error',
            errorMessage: `${libraryCheck.message} Nothing was marked missing; is the drive mounted?`,
            libraryCheckMessage: libraryCheck.message,
            processed: 0,
            filesOnDisk: 0,
            unreadableOnDisk: 0,
            updated: 0,
            removed: 0,
            kept: 0,
            skippedChanged: 0,
            failed: 0,
            notMarkedMissing: 0
          };
          return result;
        }
      }

      // Check time limit before expensive operations
      const checkTimeLimit = () => {
        if (Date.now() - startTime > timeLimit) {
          throw new Error(`Time limit exceeded (${timeLimit / 1000}s)`);
        }
      };

      // First, scan filesystem for all video files
      logProgress('Scanning filesystem for video files...');
      const { fileMap, duplicates, unreadable } = await this.scanForVideoFiles(outputDir);
      fileMapSize = fileMap.size;
      unreadableOnDisk = unreadable;
      // Rows whose files sit in unreadable parts are re-checked by path below.
      logProgress(unreadable > 0
        ? `Found ${fileMap.size} video files on disk (${unreadable} folders or files could not be read)`
        : `Found ${fileMap.size} video files on disk`);


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

        // Fetch a chunk of videos. Every guarded column is read so the write
        // can require the row to be unchanged since this read.
        const videos = await Video.findAll({
          attributes: ['id', 'youtubeId', 'removed', ...GUARDED_COLUMNS],
          limit: VIDEO_CHUNK_SIZE,
          offset: offset,
          raw: true
        });

        if (videos.length === 0) break;

        // Process the chunk in 100-row slices: probe, nominate, write.
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

          // The walk only nominates rows; what gets written is decided from a
          // fresh stat at write time (see rescanRowUpdate).
          const candidates = [];
          for (const video of slice) {
            const fileInfo = fileMap.get(video.youtubeId);
            const probedResolution = probeResults.get(video.youtubeId) ?? null;
            if (isRescanCandidate(video, fileInfo, probedResolution)) {
              candidates.push({ row: video, fileInfo, probedResolution });
            }
          }

          // Write each slice right away: on a slow network share the probes can
          // outlast the whole time budget, and work lost to an abort would get
          // re-probed next run and never converge.
          if (candidates.length > 0) {
            logProgress(`Checking ${candidates.length} records (chunk ${Math.floor(offset / VIDEO_CHUNK_SIZE) + 1})...`);
            const counts = await this._applyRescanUpdates(candidates, { holdBackMissing });
            totalUpdated += counts.updated;
            totalRemoved += counts.removed;
            totalKept += counts.kept;
            totalSkipped += counts.skipped;
            totalFailed += counts.failed;
            totalNotMarkedMissing += counts.notMarkedMissing;
          }
        }

        totalProcessed += videos.length;
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
        unreadableOnDisk,
        updated: totalUpdated,
        removed: totalRemoved,
        kept: totalKept,
        skippedChanged: totalSkipped,
        failed: totalFailed,
        notMarkedMissing: totalNotMarkedMissing
      }, 'Video metadata backfill completed');

      result = {
        processed: totalProcessed,
        filesOnDisk: fileMapSize,
        unreadableOnDisk,
        updated: totalUpdated,
        removed: totalRemoved,
        kept: totalKept,
        skippedChanged: totalSkipped,
        failed: totalFailed,
        notMarkedMissing: totalNotMarkedMissing,
        libraryCheckMessage,
        libraryCheckSkipped: ignoreLibraryCheck,
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
          unreadableOnDisk,
          updated: totalUpdated,
          removed: totalRemoved,
          kept: totalKept,
          skippedChanged: totalSkipped,
          failed: totalFailed,
          notMarkedMissing: totalNotMarkedMissing,
          libraryCheckMessage,
          libraryCheckSkipped: ignoreLibraryCheck
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
        unreadableOnDisk,
        updated: totalUpdated,
        removed: totalRemoved,
        kept: totalKept,
        skippedChanged: totalSkipped,
        failed: totalFailed,
        notMarkedMissing: totalNotMarkedMissing,
        libraryCheckMessage,
        libraryCheckSkipped: ignoreLibraryCheck
      };
      // Resolve with the failure and the counters it reached rather than
      // rethrow, so every caller and the run history keep the partial progress.
      return result;
    } finally {
      let lastRun = null;

      if (result) {
        // Build the broadcast from the same record the run history stores, so
        // the live Maintenance view and a reload agree (e.g. a partial scan).
        const record = rescanRunSummary.toRunRecord(result);
        lastRun = rescanRunSummary.fromRunRecord({
          ...record,
          trigger: result.trigger,
          startedAt: result.startedAt,
          finishedAt: result.completedAt,
        });

        // Startup rescans begin outside the scheduler; every other trigger is
        // recorded by scheduledTaskManager.
        if (result.trigger === 'startup') {
          try {
            await scheduledTaskRuns.record({
              taskKey: rescanRunSummary.TASK_KEY,
              trigger: result.trigger,
              startedAt: new Date(result.startedAt),
              finishedAt: new Date(result.completedAt),
              ...record,
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
