const Job = require('../models/job');
const Video = require('../models/video');
const JobVideo = require('../models/jobvideo');
const ChannelVideo = require('../models/channelvideo');
const channelVideoReanchor = require('./channelVideoReanchor');
const { PUBLISHED_AT_SOURCE } = require('./constants/publishedAtSource');
const VideoMetadataProcessor = require('./download/videoMetadataProcessor');
const logger = require('../logger');

/**
 * Persistence of downloaded videos into the videos + channelvideos tables.
 *
 * This is intentionally a side-effect-free module (no constructor work, no
 * timers, no job orchestration) so it can be required both by jobModule (the
 * end-of-batch finalizer) and by the per-video yt-dlp --exec post-processor,
 * which runs in a separate Node process. jobModule must NOT be required from
 * that child process because its constructor migrates jobs, terminates
 * in-progress jobs and starts the next one.
 */
class VideoPersistence {
  /**
   * Prepares video data for database save, setting last_downloaded_at if file is verified
   */
  prepareVideoDataForSave(video, isNewVideo = false) {
    const data = { ...video };
    const hasVerifiedVideoFile = Boolean(
      video.filePath && video.fileSize !== null && video.fileSize !== undefined
    );
    const hasVerifiedAudioFile = Boolean(
      video.audioFilePath && video.audioFileSize !== null && video.audioFileSize !== undefined
    );
    const hasVerifiedFile = hasVerifiedVideoFile || hasVerifiedAudioFile;

    // Only write a format's path fields when that format was verified on disk;
    // otherwise an update would overwrite an existing path with null.
    if (!hasVerifiedVideoFile && !isNewVideo) {
      delete data.filePath;
      delete data.fileSize;
      delete data.video_resolution;
    }
    if (!hasVerifiedAudioFile && !isNewVideo) {
      delete data.audioFilePath;
      delete data.audioFileSize;
    }

    if (hasVerifiedFile) {
      data.removed = false;
      data.last_downloaded_at = new Date();
      logger.debug({ youtubeId: video.youtubeId, fileSize: video.fileSize, audioFileSize: video.audioFileSize, isNewVideo }, 'Setting last_downloaded_at - file verified');
    } else {
      if (!isNewVideo) {
        delete data.removed;
      }
      logger.debug({ youtubeId: video.youtubeId, filePath: video.filePath, fileSize: video.fileSize, isNewVideo }, 'NOT setting last_downloaded_at - hasVerifiedFile is false');
    }

    if (!video.media_type) {
      delete data.media_type;
    }

    return data;
  }

  /**
   * Upserts a video and creates JobVideo relationship
   * @param {Object} video - Video data
   * @param {Object} jobInstance - Job instance
   * @param {boolean} alwaysCreateJobVideo - Always create JobVideo relationship even if video exists (for recovery)
   */
  async upsertVideoForJob(video, jobInstance, alwaysCreateJobVideo = false) {
    let videoInstance = await Video.findOne({
      where: { youtubeId: video.youtubeId },
    });

    let videoExisted = !!videoInstance;

    if (videoInstance) {
      // During recovery (alwaysCreateJobVideo=true), treat updates like new videos
      // to ensure file metadata and last_downloaded_at are set
      const updateData = this.prepareVideoDataForSave(video, alwaysCreateJobVideo);
      await videoInstance.update(updateData);
    } else {
      try {
        const createData = this.prepareVideoDataForSave(video, true);
        videoInstance = await Video.create(createData);
      } catch (err) {
        // If unique constraint error, the video was created by another process (like backfill)
        if (err.name === 'SequelizeUniqueConstraintError' || err.original?.code === 'ER_DUP_ENTRY') {
          logger.info({ youtubeId: video.youtubeId }, 'Video already exists (created by another process), fetching it');
          videoInstance = await Video.findOne({
            where: { youtubeId: video.youtubeId },
          });
          videoExisted = true;

          if (!videoInstance) {
            // This shouldn't happen, but if it does, re-throw the error
            throw new Error(`Failed to find video ${video.youtubeId} after unique constraint error`);
          }
        } else {
          throw err;
        }
      }
    }

    // Create JobVideo relationship if needed
    const shouldCreateJobVideo = alwaysCreateJobVideo || !videoExisted;

    if (shouldCreateJobVideo) {
      const existingJobVideo = await JobVideo.findOne({
        where: {
          job_id: jobInstance.id,
          video_id: videoInstance.id
        }
      });

      if (!existingJobVideo) {
        await JobVideo.create({
          job_id: jobInstance.id,
          video_id: videoInstance.id,
        });
        logger.debug({ youtubeId: video.youtubeId, job_id: jobInstance.id, video_id: videoInstance.id }, 'Created JobVideo relationship');
      } else {
        logger.debug({ youtubeId: video.youtubeId }, 'JobVideo relationship already exists');
      }
    }

    return videoInstance;
  }

  // Convert yt-dlp upload_date (YYYYMMDD) to ISO string
  uploadDateToIso(upload_date) {
    if (!upload_date || typeof upload_date !== 'string' || upload_date.length < 8) {
      return null;
    }
    const year = upload_date.substring(0, 4);
    const month = upload_date.substring(4, 6);
    const day = upload_date.substring(6, 8);
    const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Upsert into channelvideos using info.json-like fields
  async upsertChannelVideoFromInfo(info, { skipUpdateIfExists = false } = {}) {
    const youtube_id = info.id || info.youtubeId;
    const channel_id = info.channel_id || info.channelId;
    if (!youtube_id || !channel_id) return;

    const title = info.title || info.youTubeVideoName || 'Untitled';
    const duration = typeof info.duration === 'number' ? info.duration : null;
    const publishedAt = info.upload_date ? this.uploadDateToIso(info.upload_date) : null;
    const availability = info.availability || null;
    const media_type = info.media_type || 'video';
    const thumbnail = `https://i.ytimg.com/vi/${youtube_id}/mqdefault.jpg`;
    const content_rating = info.content_rating || null;
    const age_limit = info.age_limit ?? null;
    const normalized_rating = info.normalized_rating || null;

    const defaults = {
      title,
      thumbnail,
      duration,
      publishedAt,
      published_at_source: publishedAt ? PUBLISHED_AT_SOURCE.EXACT : null,
      availability,
      media_type,
      ignored: false,
      ignored_at: null
    };
    if (content_rating != null) defaults.content_rating = content_rating;
    if (age_limit != null) defaults.age_limit = age_limit;
    if (normalized_rating != null) defaults.normalized_rating = normalized_rating;

    const [record, created] = await ChannelVideo.findOrCreate({
      where: { youtube_id, channel_id },
      defaults,
    });
    if (!created && !skipUpdateIfExists) {
      // Clear ignored flag when video is downloaded - user action shows they want this video
      const updates = {
        title,
        thumbnail,
        duration,
        availability,
        media_type,
        ignored: false,
        ignored_at: null
      };
      if (content_rating != null) updates.content_rating = content_rating;
      if (age_limit != null) updates.age_limit = age_limit;
      if (normalized_rating != null) updates.normalized_rating = normalized_rating;
      await record.update(updates);

      // The .info.json upload_date is authoritative; it replaces estimated and
      // approximate dates from flat-playlist fetches. Delegated to the re-anchor
      // module (which owns the publishedAt write) so the row's existing position
      // is read first and neighbouring synthetic dates are shifted to keep the
      // channel in YouTube order. On create the date is set via defaults above;
      // a brand-new row has no prior position to preserve, so no re-anchor.
      if (publishedAt) {
        try {
          await channelVideoReanchor.applyExactDateForGroup({
            channelId: channel_id,
            mediaType: media_type,
            youtubeId: youtube_id,
            exactIso: publishedAt,
          });
        } catch (reanchorErr) {
          logger.error({ err: reanchorErr, youtube_id }, 'Error re-anchoring channel video order after download');
        }
      }
    }
  }

  /**
   * Persist a single just-completed download into the videos + channelvideos
   * tables so listing pages can show it mid-batch. Mirrors one iteration of
   * the end-of-batch loop, which still runs afterwards and is idempotent.
   *
   * Reuses VideoMetadataProcessor so the channelvideos row gets the info.json
   * channel_id, same as the batch path; otherwise VEVO/Topic uploads would
   * get two divergent rows.
   */
  async persistDownloadedVideoForJob({ jobId, youtubeId }) {
    if (!jobId || !youtubeId) {
      return null;
    }

    const [metadata] = await VideoMetadataProcessor.processVideoMetadata([`youtu.be/${youtubeId}`]);
    // Skip until a real media file was resolved; the end-of-batch save still runs.
    if (!metadata || (!metadata.filePath && !metadata.audioFilePath)) {
      return null;
    }

    const jobInstance = await Job.findOne({ where: { id: jobId } });
    if (!jobInstance) {
      return null;
    }

    const videoInstance = await this.upsertVideoForJob(metadata, jobInstance);

    // Upsert the channelvideos row too (creates it for manual downloads, clears
    // ignored otherwise). A failure must not lose the videos write above.
    try {
      await this.upsertChannelVideoFromInfo({
        id: metadata.youtubeId,
        title: metadata.youTubeVideoName,
        duration: metadata.duration,
        upload_date: metadata.originalDate,
        channel_id: metadata.channel_id,
        media_type: metadata.media_type || 'video',
      });
    } catch (cvErr) {
      logger.error({ err: cvErr, youtubeId }, 'Error upserting channel video during per-video persist');
    }

    return videoInstance;
  }
}

module.exports = new VideoPersistence();
