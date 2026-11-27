// Library repair: recreates Videos and channelvideos rows from the download
// archive (complete.list) and the cached info.json files, on a schedule and
// once at startup.

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const Video = require('../../models/video');
const ChannelVideo = require('../../models/channelvideo');
const videoPersistence = require('../videoPersistence');
const archiveModule = require('../archiveModule');
const scheduledTasks = require('../scheduledTaskManager');
const scheduledTaskRuns = require('../scheduledTaskRuns');
const { getSchedule } = require('../scheduleConfig');
const configModule = require('../configModule');
const { unchangedSinceRead } = require('../videoRowGuard');
const { REMOVAL_REASONS, removedColumns, presentColumns } = require('../videoRemovalState');
const videosModule = require('../videosModule');
const logger = require('../../logger');

// Library repair looks for an existing row's missing file at its guessed .mp4 path, then these.
const BACKFILL_ALT_VIDEO_EXTENSIONS = ['.webm', '.mkv', '.m4v', '.avi'];
const ARCHIVE_BACKFILL_TASK_KEY = 'archiveBackfillFrequency';

class JobBackfill {
  // The startup pass is written as one finished row rather than started and
  // finished separately: it begins before server.js marks stale running rows
  // interrupted, so a running row created here would be flagged by that pass.
  async _runStartupBackfill() {
    const startedAt = new Date();
    const record = await this.backfillFromCompleteList();
    await scheduledTaskRuns.record({
      taskKey: ARCHIVE_BACKFILL_TASK_KEY,
      trigger: 'startup',
      startedAt,
      finishedAt: new Date(),
      ...record,
    });
  }

  // Runs outside the scheduler, so open Scheduling pages are told when it
  // starts and ends. The repair's lock is set before this broadcasts.
  runStartupBackfill() {
    return scheduledTasks.announceRun(ARCHIVE_BACKFILL_TASK_KEY, this._runStartupBackfill());
  }

  /**
   * Look for a backfilled video's file at its guessed .mp4 path, then with the
   * other common video extensions.
   * @param {string} mp4Path - Guessed path ending in .mp4
   * @returns {Promise<{path: string, size: string}|null>} The file found, or null
   */
  async _findArchivedVideoFile(mp4Path) {
    // Swap only the trailing extension; the channel name or title may contain ".mp4" too.
    const basePath = mp4Path.slice(0, -'.mp4'.length);
    const candidates = [mp4Path, ...BACKFILL_ALT_VIDEO_EXTENSIONS.map((ext) => `${basePath}${ext}`)];
    for (const candidate of candidates) {
      try {
        const stats = await fsPromises.stat(candidate);
        if (stats.isFile()) return { path: candidate, size: stats.size.toString() };
      } catch (err) {
        // Try the next extension
      }
    }
    return null;
  }

  // The startup pass runs outside the scheduler, so the repair keeps its own
  // lock; two walks at once would race on the same rows.
  async backfillFromCompleteList() {
    if (this._archiveRepairRunning) {
      return { status: 'skipped', outcome: 'skipped', message: 'A library repair was already running.' };
    }
    this._archiveRepairRunning = true;
    try {
      return await this._repairFromArchive();
    } finally {
      this._archiveRepairRunning = false;
    }
  }

  isArchiveRepairRunning() {
    return Boolean(this._archiveRepairRunning);
  }

  // Backfill Videos and channelvideos tables from complete.list and jobs info JSON
  async _repairFromArchive() {
    try {
      const archivePath = archiveModule.getArchivePath();
      let archiveContent;
      try {
        archiveContent = await fsPromises.readFile(archivePath, 'utf-8');
      } catch (e) {
        if (e && e.code === 'ENOENT') {
          logger.info('No complete.list found for backfill. Skipping.');
          return {
            status: 'skipped',
            outcome: 'skipped',
            message: 'No download archive (complete.list) found.',
          };
        }
        throw e;
      }

      const lines = archiveContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const ids = lines
        .map((line) => line.split(' ')[1])
        .filter(Boolean);

      let videosUpserts = 0;
      let channelVideosUpserts = 0;
      let failedWrites = 0;
      const missingInfoIds = [];

      // Build fast lookup sets of existing youtube IDs to avoid overwriting fresher DB data
      const existingVideos = await Video.findAll({ attributes: ['youtubeId'] });
      const existingVideoIdSet = new Set(existingVideos.map(v => v.youtubeId));
      const existingChannelVideos = await ChannelVideo.findAll({ attributes: ['youtube_id'] });
      const existingChannelVideoIdSet = new Set(existingChannelVideos.map(cv => cv.youtube_id));

      // Build candidate list first (IDs needing backfill in either table),
      // starting from newest entries at the end of complete.list
      const candidates = [];
      for (let i = ids.length - 1; i >= 0; i--) {
        const id = ids[i];
        const needsVideo = !existingVideoIdSet.has(id);
        const needsChannelVideo = !existingChannelVideoIdSet.has(id);
        // Always include in candidates - we may need to update media_type on existing records
        candidates.push({ id, needsVideo, needsChannelVideo });
      }

      const maxPerRun = 300;
      const capped = candidates.slice(0, maxPerRun);

      // A lost row's files are looked up by YouTube id anywhere under the
      // downloads folder: the guessed path only fits the oldest folder layout
      // and never an audio file. The folder is walked at most once per run,
      // and only if a lost row needs recreating.
      let downloadedFiles = null;
      let unreadableOnDisk = 0;
      // Lost rows recreated as missing while the walk was partial: their file
      // may sit in a part that couldn't be read.
      let recreatedUnverified = 0;
      const findDownloadedFiles = async (youtubeId) => {
        if (!downloadedFiles) {
          const outputDir = configModule.directoryPath;
          if (outputDir) {
            const { fileMap, unreadable } = await videosModule.scanForVideoFiles(outputDir);
            downloadedFiles = fileMap;
            unreadableOnDisk = unreadable;
            logger.info({ filesOnDisk: fileMap.size }, 'Searched the downloads folder for lost video records');
            if (unreadable > 0) {
              logger.warn({ unreadable }, 'Parts of the downloads folder could not be read; lost videos stored there are recreated as missing');
            }
          } else {
            downloadedFiles = new Map();
          }
        }
        return downloadedFiles.get(youtubeId) || null;
      };

      let processed = 0;
      for (const { id, needsVideo, needsChannelVideo } of capped) {
        const infoPath = path.join(configModule.getJobsPath(), 'info', `${id}.info.json`);

        let info;
        try {
          const content = await fsPromises.readFile(infoPath, 'utf-8');
          info = JSON.parse(content);
        } catch (e) {
          if (e && e.code === 'ENOENT') {
            missingInfoIds.push(id);
            // Yield occasionally even on misses to keep loop responsive
            processed++;
            if (processed % 20 === 0) {
              await new Promise((resolve) => setImmediate(resolve));
            }
            continue;
          }
          logger.error({ err: e, id }, 'Failed parsing info.json');
          processed++;
          if (processed % 20 === 0) {
            await new Promise((resolve) => setImmediate(resolve));
          }
          continue;
        }

        // Upsert into Videos table only if missing
        try {
          const baseOutputPath = configModule.directoryPath;
          const preferredChannelName = info.uploader || info.channel || info.uploader_id || info.channel_id || 'Unknown Channel';
          const videoFolder = `${preferredChannelName} - ${info.title} - ${info.id}`;
          const videoFileName = `${preferredChannelName} - ${info.title}  [${info.id}].mp4`;
          const fullPath = path.join(baseOutputPath, preferredChannelName, videoFolder, videoFileName);

          const payload = {
            youtubeId: info.id,
            youTubeChannelName: preferredChannelName,
            youTubeVideoName: info.title,
            duration: info.duration,
            description: info.description,
            originalDate: info.upload_date,
            channel_id: info.channel_id,
            media_type: info.media_type || 'video',
            content_rating: info.content_rating || null,
            age_limit: info.age_limit ?? null,
            normalized_rating: info.normalized_rating || null,
            rating_source: info.rating_source || null,
          };

          // Read the row before searching the disk, so a deletion that lands
          // in between can't be undone by an earlier "file found".
          const videoInstance = await Video.findOne({ where: { youtubeId: info.id } });
          const foundFile = videoInstance && (!videoInstance.filePath || !videoInstance.fileSize)
            ? await this._findArchivedVideoFile(fullPath)
            : null;

          if (!videoInstance && needsVideo) {
            const files = await findDownloadedFiles(info.id);
            const sizeOf = (size) => (size === null || size === undefined ? null : String(size));
            try {
              // Without a file on disk the row is recreated as missing; the
              // guessed path is kept, as the rescan keeps stored paths. This
              // also applies when the walk was partial (unreadable folders):
              // deferring instead would block recovery for good wherever a
              // folder is never readable (lost+found, NAS recycle bins), while
              // a row wrongly recreated as missing is restored by the next
              // rescan that finds its file.
              await Video.create({
                ...payload,
                filePath: files ? files.videoFilePath : fullPath,
                fileSize: files ? sizeOf(files.videoFileSize) : null,
                audioFilePath: files ? files.audioFilePath : null,
                audioFileSize: files ? sizeOf(files.audioFileSize) : null,
                ...(files ? presentColumns() : removedColumns(REMOVAL_REASONS.NOT_FOUND)),
              });
              videosUpserts += 1;
              if (!files && unreadableOnDisk > 0) recreatedUnverified += 1;
            } catch (createErr) {
              if (createErr.name !== 'SequelizeUniqueConstraintError' && createErr.original?.code !== 'ER_DUP_ENTRY') {
                throw createErr;
              }
              // A download created the row in the meantime; its data is newer.
              logger.info({ youtubeId: info.id }, 'Video already exists (created by another process), skipping backfill');
            }
          } else if (videoInstance) {
            // Only claim a file that was actually found, and only if no other
            // writer changed the row since it was read. This only runs when
            // filePath or fileSize was empty, so the write always changes a
            // column, which the zero-rows conflict check relies on.
            if (foundFile) {
              const [affected] = await Video.update(
                { filePath: foundFile.path, fileSize: foundFile.size, ...presentColumns() },
                { where: unchangedSinceRead(videoInstance) }
              );
              if (affected === 0) {
                logger.info({ youtubeId: info.id }, 'Video changed during backfill, skipping file update');
              }
            }

            const updates = {};

            // Update media_type only if currently set to default 'video' (meaning it hasn't been set yet)
            if (videoInstance.media_type === 'video' && payload.media_type && payload.media_type !== 'video') {
              updates.media_type = payload.media_type;
            }

            if (!videoInstance.normalized_rating && payload.normalized_rating) {
              updates.normalized_rating = payload.normalized_rating;
              updates.content_rating = payload.content_rating;
              updates.age_limit = payload.age_limit;
              updates.rating_source = payload.rating_source;
            }

            if (Object.keys(updates).length > 0) {
              await videoInstance.update(updates);
            }
          }
        } catch (vidErr) {
          failedWrites += 1;
          logger.error({ err: vidErr, id }, 'Error upserting Videos');
        }

        // Upsert into channelvideos table only if missing
        try {
          if (needsChannelVideo) {
            await videoPersistence.upsertChannelVideoFromInfo(info, { skipUpdateIfExists: true });
            channelVideosUpserts += 1;
          } else {
            // For existing records, only update media_type if it's currently 'video' (default)
            const existing = await ChannelVideo.findOne({
              where: { youtube_id: info.id, channel_id: info.channel_id }
            });
            if (existing && existing.media_type === 'video' && info.media_type && info.media_type !== 'video') {
              await existing.update({ media_type: info.media_type });
            }
          }
        } catch (cvErr) {
          failedWrites += 1;
          logger.error({ err: cvErr, id }, 'Error upserting channelvideos');
        }

        // Yield to event loop every 20 items to keep server responsive
        processed++;
        if (processed % 20 === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      }

      logger.info({ videosUpserts, channelVideosUpserts }, 'Backfill complete');
      if (missingInfoIds.length > 0) {
        logger.warn({ missingCount: missingInfoIds.length, missingIds: missingInfoIds.join(', ') }, 'Backfill skipped due to missing info.json');
      }
      const failures = failedWrites > 0 ? `; ${failedWrites} write${failedWrites === 1 ? '' : 's'} failed` : '';
      const unverified = recreatedUnverified > 0
        ? `; ${recreatedUnverified} recreated as missing because parts of the downloads folder could not be read`
        : '';
      const partial = failedWrites > 0 || recreatedUnverified > 0;
      return {
        status: partial ? 'error' : 'success',
        outcome: partial ? 'partial' : 'completed',
        message: `Recovered ${videosUpserts} video records and ${channelVideosUpserts} channel video records${failures}${unverified}.`,
        details: {
          videosUpserts,
          channelVideosUpserts,
          failed: failedWrites,
          unreadableOnDisk,
          recreatedUnverified,
        },
      };
    } catch (err) {
      logger.error({ err }, 'Backfill error');
      return { status: 'error', outcome: 'error', message: err.message || 'Unknown error' };
    }
  }

  scheduleDailyBackfill() {
    scheduledTasks.updateTask({
      id: ARCHIVE_BACKFILL_TASK_KEY,
      expression: getSchedule(configModule.getConfig(), ARCHIVE_BACKFILL_TASK_KEY),
      run: () => this.backfillFromCompleteList(),
      isRunning: () => this.isArchiveRepairRunning(),
    });
  }
}

module.exports = new JobBackfill();
