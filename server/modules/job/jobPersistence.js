// Reads and writes jobs in the database. Owns the save lock and the retry of
// a failed final save.

const { Op } = require('sequelize');
const Job = require('../../models/job');
const Video = require('../../models/video');
const JobVideo = require('../../models/jobvideo');
const videoPersistence = require('../videoPersistence');
const { serializeAuxData, parseAuxData } = require('../jobAuxData');
const { FINAL_JOB_STATUSES } = require('../constants/jobStatuses');
const logger = require('../../logger');
const jobRegistry = require('./jobRegistry');

const MAX_SAVE_RETRIES = 3;
// Linear backoff: 1s, 2s, 3s
const SAVE_RETRY_DELAY_MS = 1000;
const VIDEO_LOOKUP_BATCH_SIZE = 500;

class JobPersistence {
  constructor() {
    this.isSaving = false; // Locking mechanism to prevent multiple saves at the same time
  }

  // Save a single job and its video data to the database. Never rejects: the
  // download finalizer awaits it bare, so a failed write is logged and dropped.
  async saveJobOnly(jobId, jobDataOriginal) {
    try {
      await this._writeJob(jobId, jobDataOriginal);
    } catch (error) {
      logger.error({ err: error }, 'Error saving job');
    }
  }

  // The job row and then its videos. Rejects on a database error.
  async _writeJob(jobId, jobDataOriginal) {
    const { jobInstance, videos } = await this._writeJobRow(jobId, jobDataOriginal);
    await this._writeJobVideos(jobInstance, videos);
  }

  // The Jobs row alone: status, output, timestamps and aux_data. Returns the
  // row, the status written, and the videos held back from the row, which
  // live in their own tables.
  async _writeJobRow(jobId, jobDataOriginal) {
    let jobInstance = await Job.findOne({ where: { id: jobId } });

    // Copied after the lookup, not before: a bulk save and a final save for
    // the same job overlap, and a copy taken before a slow lookup would write
    // an older status over a newer one. Writes are not queued per job instead,
    // because the finalizer awaits saveJobOnly and one hung query would then
    // hold up the job and the queue behind it.
    const jobData = { ...jobDataOriginal };

    // Download jobs carry their videos in data; non-download jobs may have no data
    let videos = [];
    jobData.aux_data = serializeAuxData(jobData.data);
    if (jobData.data) {
      videos = jobData.data.videos ? jobData.data.videos : [];
      delete jobData.data;
    }

    if (!jobInstance) {
      jobInstance = await Job.create(jobData);
    } else if (FINAL_JOB_STATUSES.has(jobData.status)) {
      await jobInstance.update(jobData);
    } else {
      // A status that is not final never replaces a final one already stored:
      // this update can still reach the row after a final save from another
      // connection, and the database is the only place that order is known.
      await Job.update(jobData, {
        where: { id: jobId, status: { [Op.notIn]: [...FINAL_JOB_STATUSES] } },
      });
    }
    return { jobInstance, videos, status: jobData.status };
  }

  async _writeJobVideos(jobInstance, videos) {
    for (let video of videos) {
      await videoPersistence.upsertVideoForJob(video, jobInstance);

      // Also upsert into channelvideos so Channel page reflects downloaded items
      try {
        await videoPersistence.upsertChannelVideoFromInfo({
          id: video.youtubeId,
          title: video.youTubeVideoName,
          duration: video.duration,
          upload_date: video.originalDate,
          channel_id: video.channel_id,
          media_type: video.media_type || 'video',
        });
      } catch (cvErr) {
        logger.error({ err: cvErr }, 'Error upserting channel video');
      }
    }
  }

  async saveJobs() {
    if (this.isSaving) {
      logger.debug('Save operation already in progress, skipping');
      return;
    }
    this.isSaving = true;
    try {
      logger.debug({ jobCount: Object.keys(jobRegistry.jobs).length }, 'saveJobs() called - processing jobs');

      for (let jobId in jobRegistry.jobs) {
        const job = jobRegistry.jobs[jobId];
        // The map was replaced during this pass (startup load).
        if (!job) continue;
        try {
          const { jobInstance, videos, status } = await this._writeJobRow(jobId, job);

          // Skip updating video data for completed/terminated jobs to avoid overwriting fresher data
          if (FINAL_JOB_STATUSES.has(status)) {
            logger.debug({ jobId }, 'Skipping video updates for completed job');
            continue;
          }

          await this._writeJobVideos(jobInstance, videos);
        } catch (error) {
          logger.error({ err: error, jobId }, 'Error saving job');
        }
      }
    } finally {
      this.isSaving = false;
    }
  }

  // Save a completed job (download and non-download alike). Never rejects: a
  // failed job row write is retried in the background, a failed video write is
  // logged and not retried (see _retryJobRow).
  async saveCompletedJob(jobId, job) {
    let written;
    try {
      written = await this._writeJobRow(jobId, job);
    } catch (err) {
      logger.error({ err, jobId }, 'Failed to save completed job; will retry its job row');
      this._scheduleJobRowRetry(jobId, 1);
      return;
    }

    try {
      await this._writeJobVideos(written.jobInstance, written.videos);
    } catch (err) {
      logger.error({ err, jobId }, 'Failed to save the videos of a completed job');
    }
  }

  _scheduleJobRowRetry(jobId, attempt) {
    const retryDelay = SAVE_RETRY_DELAY_MS * attempt;
    logger.info({ jobId, attempt, maxRetries: MAX_SAVE_RETRIES, retryDelay }, 'Will retry save for job');

    setTimeout(() => {
      this._retryJobRow(jobId, attempt).catch((err) => {
        logger.error({ err, jobId, attempt }, 'Retry of a job save failed unexpectedly');
      });
    }, retryDelay);
  }

  // Writes the job's row only, on its own rather than through saveJobs, so a
  // running bulk save cannot swallow the attempt. Videos are never retried:
  // the per-video post-processor wrote their rows as each download finished,
  // so the copies held here are normally rows just read back from the
  // database, and replaying them seconds later could undo a change the user
  // made in between.
  async _retryJobRow(jobId, attempt) {
    const job = jobRegistry.jobs[jobId];
    if (!job) {
      logger.warn({ jobId, attempt }, 'Retry attempt skipped - job no longer exists in memory');
      return;
    }

    try {
      await this._writeJobRow(jobId, job);
      logger.info({ jobId, attempt }, 'Saved job on retry');
    } catch (err) {
      if (attempt >= MAX_SAVE_RETRIES) {
        logger.error({ err, jobId, maxRetries: MAX_SAVE_RETRIES }, 'Max retries exhausted for job. Its final status may be lost on restart. Giving up.');
        return;
      }
      logger.error({ err, jobId, attempt, maxRetries: MAX_SAVE_RETRIES }, 'Retry of job save failed. Scheduling next attempt');
      this._scheduleJobRowRetry(jobId, attempt + 1);
    }
  }

  async loadJobsFromDB() {
    try {
      const jobs = await Job.findAll();
      const jobVideos = await JobVideo.findAll();

      jobRegistry.replaceAll({});

      for (let job of jobs) {
        const { aux_data: auxData, ...row } = job.dataValues;
        jobRegistry.setJob(job.id, {
          ...row,
          data: {
            ...parseAuxData(auxData),
            videos: [],
          },
          // Don't restore action functions - pending jobs will be terminated on startup
          // since they can't be safely resumed (missing urls, etc.)
        });
      }

      // Attached a batch at a time, so a failed read costs only that batch's
      // videos rather than every job's list.
      for (let start = 0; start < jobVideos.length; start += VIDEO_LOOKUP_BATCH_SIZE) {
        const links = jobVideos.slice(start, start + VIDEO_LOOKUP_BATCH_SIZE);
        let videosById;
        try {
          videosById = await this._loadVideosById(links.map((jobVideo) => jobVideo.video_id));
        } catch (error) {
          logger.error({ err: error, linkCount: links.length }, 'Error loading a batch of job videos; some jobs will list fewer videos until restart');
          continue;
        }
        for (let jobVideo of links) {
          const video = videosById.get(jobVideo.video_id);
          if (video && jobRegistry.jobs[jobVideo.job_id]) {
            jobRegistry.jobs[jobVideo.job_id].data.videos.push({ ...video });
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Error loading jobs from DB');
    }
  }

  // The videos still linked to a job, as Download History shows them.
  async loadJobVideos(jobId) {
    const jobVideos = await JobVideo.findAll({
      where: { job_id: jobId }
    });

    const videosById = await this._loadVideosById(jobVideos.map((jobVideo) => jobVideo.video_id));
    const videos = [];
    for (const jobVideo of jobVideos) {
      const video = videosById.get(jobVideo.video_id);
      if (video) {
        videos.push({ ...video });
      }
    }
    return videos;
  }

  // Video rows by id, read a batch at a time instead of one query per row.
  async _loadVideosById(videoIds) {
    const videosById = new Map();
    for (let start = 0; start < videoIds.length; start += VIDEO_LOOKUP_BATCH_SIZE) {
      const batch = videoIds.slice(start, start + VIDEO_LOOKUP_BATCH_SIZE);
      const rows = await Video.findAll({ where: { id: batch } });
      for (const row of rows) {
        videosById.set(row.id, row.dataValues);
      }
    }
    return videosById;
  }

  /**
   * Refresh the in-memory video lists of the given jobs from the database,
   * after their rows changed outside the download path (emptying the trash
   * deletes jobvideos rows). Jobs not held in memory are skipped; a failure
   * is logged and the job keeps its previous list.
   * @param {string[]} jobIds
   */
  async reloadJobVideos(jobIds) {
    for (const jobId of jobIds || []) {
      const job = jobRegistry.jobs[jobId];
      if (!job) continue;
      try {
        const videos = await this.loadJobVideos(jobId);
        if (!job.data) {
          job.data = {};
        }
        job.data.videos = videos;
      } catch (err) {
        logger.error({ err, jobId }, 'Error reloading videos for job');
      }
    }
  }

  // The in-memory job snapshot only refreshes at job completion or server
  // startup, so per-video fields (removed, protected, normalized_rating, etc.)
  // go stale after the user mutates a video. Re-read fresh rows from the
  // Videos table and substitute them in before returning to the client.
  async getRunningJobsWithFreshVideos() {
    const jobs = jobRegistry.getRunningJobs();

    const videoIds = new Set();
    for (const job of jobs) {
      const videos = job.data?.videos;
      if (!Array.isArray(videos)) continue;
      for (const video of videos) {
        if (typeof video?.id === 'number') {
          videoIds.add(video.id);
        }
      }
    }

    if (videoIds.size === 0) {
      return jobs;
    }

    const freshVideos = await Video.findAll({
      where: { id: Array.from(videoIds) }
    });
    const freshById = new Map(freshVideos.map(v => [v.id, v.dataValues]));

    return jobs.map(job => {
      const videos = job.data?.videos;
      if (!Array.isArray(videos)) return job;
      return {
        ...job,
        data: {
          ...job.data,
          videos: videos.map(video => freshById.get(video?.id) || video),
        },
      };
    });
  }
}

module.exports = new JobPersistence();
