const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const Job = require('../models/job');
const Video = require('../models/video');
const JobVideo = require('../models/jobvideo');
const JobVideoDownload = require('../models/jobvideodownload');
const ChannelVideo = require('../models/channelvideo');
const cron = require('node-cron');
const MessageEmitter = require('./messageEmitter.js'); // import the helper function
const configModule = require('./configModule');
const logger = require('../logger');

const MAX_SAVE_RETRIES = 3;

class JobModule {
  constructor() {
    this.jobsDir = configModule.getJobsPath();
    this.jobsFilePath = path.join(this.jobsDir, 'jobs.json');
    this.jobsFilePathOld = path.join(this.jobsDir, 'jobs.json.old');
    this.isSaving = false; // Locking mechanism to prevent multiple saves at the same time
    this.jobs = {}; // Initialize this.jobs as an empty object

    if (!fs.existsSync(this.jobsDir)) {
      fs.mkdirSync(this.jobsDir, { recursive: true });
    }

    // If there is a jobs.json file, load it and migrate to the DB
    if (fs.existsSync(this.jobsFilePath)) {
      const fileContent = fs.readFileSync(this.jobsFilePath);
      this.jobs = JSON.parse(fileContent);

      this.migrateJobsFromFile().then(() => {
        // Save the jobs.json file to jobs.json.old just in case we need it later
        fs.renameSync(this.jobsFilePath, this.jobsFilePathOld);

        // Reload from the DB
        this.loadJobsFromDB().then(() => {
          this.terminateInProgressJobs();
          this.saveJobsAndStartNext();
        });
      });
    } else {
      // If there is no jobs.json file, load the jobs from the DB
      this.loadJobsFromDB().then(() => {
        this.terminateInProgressJobs();
        this.saveJobsAndStartNext();
      });
    }

    // Schedule a daily backfill from complete.list and run an initial backfill
    this.scheduleDailyBackfill();

    const disableInitialBackfill = process.env.JOBMODULE_DISABLE_INITIAL_BACKFILL === 'true';
    if (!disableInitialBackfill) {
      setTimeout(() => {
        this.backfillFromCompleteList().catch((err) => {
          logger.error({ err }, 'Initial backfill failed');
        });
      }, 0);
    }
  }

  /**
   * Recover completed videos from JobVideoDownload tracking table
   * Reads .info.json files and ensures videos are properly saved to DB
   * @param {string} jobId - The job ID to recover videos for
   * @returns {Promise<number>} Number of videos successfully recovered
   */
  async recoverCompletedVideos(jobId) {
    let recoveredCount = 0;

    try {
      // Find all completed video downloads for this job
      const completedDownloads = await JobVideoDownload.findAll({
        where: {
          job_id: jobId,
          status: 'completed'
        }
      });

      if (completedDownloads.length === 0) {
        logger.info({ jobId }, 'No completed videos to recover for job');
        return 0;
      }

      logger.info({ jobId, count: completedDownloads.length }, 'Found completed videos to recover for job');

      // Try to get the job instance for creating JobVideo relationships
      let jobInstance = await Job.findOne({ where: { id: jobId } });

      for (const download of completedDownloads) {
        try {
          const youtubeId = download.youtube_id;
          const infoJsonPath = path.join(this.jobsDir, 'info', `${youtubeId}.info.json`);

          // Check if .info.json file exists
          let infoExists = false;
          try {
            await fsPromises.access(infoJsonPath);
            infoExists = true;
          } catch (err) {
            logger.warn({ youtubeId }, 'Info file not found for video, skipping recovery');
            continue;
          }

          if (!infoExists) {
            continue;
          }

          // Read and parse the info.json file
          const infoContent = await fsPromises.readFile(infoJsonPath, 'utf-8');
          const info = JSON.parse(infoContent);

          // Build video data object from info.json
          const preferredChannelName = info.uploader || info.channel || info.uploader_id || info.channel_id || 'Unknown Channel';

          const videoData = {
            youtubeId: info.id,
            youTubeChannelName: preferredChannelName,
            youTubeVideoName: info.title,
            duration: info.duration,
            description: info.description,
            originalDate: info.upload_date,
            channel_id: info.channel_id,
            media_type: info.media_type || 'video',
          };

          // Determine candidate file paths, preferring yt-dlp's recorded actual location
          const candidatePaths = [];
          const pushCandidate = (candidatePath) => {
            if (candidatePath && !candidatePaths.includes(candidatePath)) {
              candidatePaths.push(candidatePath);
            }
          };

          const actualFilePath = info._actual_filepath ? path.normalize(info._actual_filepath) : null;
          pushCandidate(actualFilePath);

          // If post-processing updated the tracking record with an exact path, use it
          if (!actualFilePath && download.file_path && path.extname(download.file_path)) {
            pushCandidate(path.normalize(download.file_path));
          }

          const fallbackBasePath = path.join(
            configModule.directoryPath,
            preferredChannelName,
            `${preferredChannelName} - ${info.title} - ${info.id}`,
            `${preferredChannelName} - ${info.title}  [${info.id}]`
          );

          const fallbackExtensions = ['.mp4', '.webm', '.mkv', '.m4v', '.avi'];
          for (const ext of fallbackExtensions) {
            pushCandidate(`${fallbackBasePath}${ext}`);
          }

          // Check candidates until we find an existing file
          let resolvedPath = null;
          let resolvedStats = null;
          for (const candidate of candidatePaths) {
            try {
              const stats = await fsPromises.stat(candidate);
              resolvedPath = candidate;
              resolvedStats = stats;
              break;
            } catch (err) {
              // Try next candidate
            }
          }

          if (resolvedPath) {
            videoData.filePath = resolvedPath;
            videoData.fileSize = resolvedStats?.size !== undefined ? resolvedStats.size.toString() : null;
            videoData.removed = false;
          } else {
            // File not found, but we still want to record the expected metadata location
            const assumedPath = actualFilePath || `${fallbackBasePath}.mp4`;
            videoData.filePath = assumedPath;
            videoData.fileSize = null;
            videoData.removed = false;
          }

          // Upsert video into Videos table and ensure JobVideo relationship exists
          // Note: Video and ChannelVideo were already created during normal download processing
          // We just need to ensure the JobVideo relationship exists for this terminated job
          await this.upsertVideoForJob(videoData, jobInstance, true);

          recoveredCount++;
          logger.info({ youtubeId, title: info.title }, 'Recovered video');
        } catch (err) {
          logger.error({ err, youtubeId: download.youtube_id }, 'Error recovering video');
        }
      }

      logger.info({ jobId, recoveredCount }, 'Successfully recovered videos for job');
      return recoveredCount;
    } catch (err) {
      logger.error({ err, jobId }, 'Error in recoverCompletedVideos for job');
      return recoveredCount;
    }
  }

  async terminateInProgressJobs() {
    // Change the status of "In Progress" jobs to "Terminated" and recover/cleanup videos
    for (let jobId in this.jobs) {
      if (this.jobs[jobId].status === 'In Progress') {
        logger.info({ jobId }, 'Recovering job after server restart');

        let recoveredCount = 0;
        let outputMessage = 'Job terminated due to server restart';

        try {
          // Step 1: Recover completed videos from JobVideoDownload table
          recoveredCount = await this.recoverCompletedVideos(jobId);

          // Step 2: Clean up in-progress videos from disk
          try {
            // Import downloadExecutor to access cleanup method
            const DownloadExecutor = require('./download/downloadExecutor');
            const downloadExecutor = new DownloadExecutor();
            await downloadExecutor.cleanupInProgressVideos(jobId);
          } catch (cleanupErr) {
            logger.error({ err: cleanupErr, jobId }, 'Error cleaning up in-progress videos for job');
          }

          // Step 3: Set appropriate output message
          if (recoveredCount > 0) {
            outputMessage = `${recoveredCount} video${recoveredCount === 1 ? '' : 's'} completed (recovered after server restart)`;
          }

          // Step 4: Clean up all JobVideoDownload entries for this job
          try {
            const deletedCount = await JobVideoDownload.destroy({
              where: { job_id: jobId }
            });
            if (deletedCount > 0) {
              logger.info({ jobId, deletedCount }, 'Cleaned up JobVideoDownload tracking entries for job');
            }
          } catch (deleteErr) {
            logger.error({ err: deleteErr, jobId }, 'Error deleting JobVideoDownload entries for job');
          }
        } catch (err) {
          logger.error({ err, jobId }, 'Error during recovery for job');
          outputMessage = `Job terminated with errors: ${err.message}`;
        }

        // Step 5: Reload job videos from database into in-memory structure
        // This ensures Download History shows the correct count
        try {
          const jobVideos = await JobVideo.findAll({
            where: { job_id: jobId }
          });

          const videos = [];
          for (const jobVideo of jobVideos) {
            const video = await Video.findOne({ where: { id: jobVideo.video_id } });
            if (video) {
              videos.push(video.dataValues);
            }
          }

          if (!this.jobs[jobId].data) {
            this.jobs[jobId].data = {};
          }
          this.jobs[jobId].data.videos = videos;

          logger.info({ jobId, videoCount: videos.length }, 'Loaded videos into in-memory structure for job');
        } catch (loadErr) {
          logger.error({ err: loadErr, jobId }, 'Error loading videos into memory for job');
        }

        // Step 6: Update job status and output
        this.jobs[jobId].status = 'Terminated';
        this.jobs[jobId].output = outputMessage;

        try {
          await Job.update(
            {
              status: 'Terminated',
              output: outputMessage
            },
            { where: { id: jobId } }
          );
          logger.info({ jobId, outputMessage }, 'Job marked as Terminated');
        } catch (err) {
          logger.error({ err, jobId }, 'Failed to update job in database');
        }
      }
    }

    // Terminate all Pending jobs (they can't be safely resumed after restart)
    for (let jobId in this.jobs) {
      if (this.jobs[jobId].status === 'Pending') {
        logger.warn({ jobId, jobType: this.jobs[jobId].jobType },
          'Terminating pending job - jobs cannot be resumed after server restart');

        this.jobs[jobId].status = 'Terminated';
        this.jobs[jobId].output = 'Job terminated during server restart';

        try {
          await Job.update(
            {
              status: 'Terminated',
              output: 'Job terminated during server restart'
            },
            { where: { id: jobId } }
          );
          logger.info({ jobId }, 'Pending job marked as Terminated');
        } catch (err) {
          logger.error({ err, jobId }, 'Failed to update pending job in database');
        }
      }
    }
  }

  async saveJobsAndStartNext() {
    // Just start the next job - no need to save anything on startup
    await this.startNextJob();
  }

  async loadJobsFromDB() {
    try {
      const jobs = await Job.findAll();
      const jobVideos = await JobVideo.findAll();

      this.jobs = {};

      for (let job of jobs) {
        this.jobs[job.id] = {
          ...job.dataValues,
          data: {
            videos: [],
          },
          // Don't restore action functions - pending jobs will be terminated on startup
          // since they can't be safely resumed (missing urls, etc.)
        };
      }

      for (let jobVideo of jobVideos) {
        const video = await Video.findOne({ where: { id: jobVideo.video_id } });
        if (video && this.jobs[jobVideo.job_id]) {
          this.jobs[jobVideo.job_id].data.videos.push(video.dataValues);
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Error loading jobs from DB');
    }
  }

  async migrateJobsFromFile() {
    for (let jobId in this.jobs) {
      const jobData = this.jobs[jobId];
      if (!jobData.data) {
        continue;
      }
      const videos = jobData.data.videos ? jobData.data.videos : [];
      delete jobData.data; // Remove videos from job data

      // Convert timestamps to Date objects
      jobData.timeInitiated = new Date(jobData.timeInitiated);
      jobData.timeCreated = new Date(jobData.timeCreated);

      try {
        const jobInstance = await Job.create(jobData); // Create job entry

        // Create video entries and jobVideo relationships
        for (let video of videos) {
          let videoInstance;
          try {
            videoInstance = await Video.create(video); // Create video entry
          } catch (error) {
            logger.error({ err: error }, 'Error migrating video');
          }

          // Create jobVideo relationship
          try {
            await JobVideo.create({
              job_id: jobInstance.id,
              video_id: videoInstance.id,
            });
          } catch (error) {
            logger.error({ err: error }, 'Error migrating jobVideo');
          }
        }
      } catch (error) {
        logger.error({ err: error }, 'Error migrating job');
      }
    }
  }

  getInProgressJobId() {
    for (let id in this.jobs) {
      if (this.jobs[id].status === 'In Progress') {
        return id;
      }
    }
    return null;
  }

  async startNextJob() {
    logger.info('Looking for next job to start');
    const jobs = this.getAllJobs();
    for (let id in jobs) {
      if (jobs[id].status === 'Pending') {
        jobs[id].id = id;
        if (jobs[id].action) {
          jobs[id].action(jobs[id], true); // Invoke the function
        } else {
          // Job is missing its action function (likely loaded from DB after restart)
          logger.warn({ jobId: id, jobType: jobs[id].jobType },
            'Cannot start pending job - missing action function, marking as Terminated');

          await this.updateJob(id, {
            status: 'Terminated',
            output: 'Job could not be started after server restart',
          });

          // Try to start the next pending job
          this.startNextJob();
        }
        break;
      }
    }
  }

  async addOrUpdateJob(jobData, isNextJob = false) {
    let jobId;
    const inProgressJobId = this.getInProgressJobId();
    if (!isNextJob) {
      if (inProgressJobId) {
        // If there is a job in progress, create a new job with status Pending
        logger.info({ jobType: jobData.jobType }, 'A job is already in progress. Adding job to the queue');
        jobData.status = 'Pending';
        jobId = await this.addJob(jobData);
      } else {
        // Otherwise, add a job with status In Progress
        logger.info({ jobType: jobData.jobType }, 'Adding job to jobs list as In Progress');
        jobData.status = 'In Progress';
        jobId = await this.addJob(jobData);
      }
    } else if (isNextJob && !inProgressJobId) {
      // If this is a next job and there's no job in progress, update its status to In Progress
      logger.info('This is a "next job", flipping from Pending to In Progress');
      await this.updateJob(jobData.id, {
        status: 'In Progress',
        timeInitiated: Date.now(),
      });
      jobId = jobData.id;
    } else {
      logger.warn('Cannot start next job as a job is already in progress');
    }
    return jobId;
  }

  /**
   * Prepares video data for database save, setting last_downloaded_at if file is verified
   */
  prepareVideoDataForSave(video, isNewVideo = false) {
    const data = { ...video };
    const hasVerifiedFile = Boolean(
      video.filePath && video.fileSize !== null && video.fileSize !== undefined
    );

    if (hasVerifiedFile) {
      // Always set these fields when file is verified
      data.filePath = video.filePath;
      data.fileSize = video.fileSize;
      data.removed = false;
      data.last_downloaded_at = new Date();
      logger.debug({ youtubeId: video.youtubeId, fileSize: video.fileSize, isNewVideo }, 'Setting last_downloaded_at - file verified');
    } else {
      if (!isNewVideo) {
        // For updates, delete fields to leave them untouched
        delete data.filePath;
        delete data.fileSize;
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
      // Try to create the video
      try {
        const createData = this.prepareVideoDataForSave(video, true);
        videoInstance = await Video.create(createData);
      } catch (err) {
        // If unique constraint error, the video was created by another process (like backfill)
        // Query for it again
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
          // Some other error, re-throw it
          throw err;
        }
      }
    }

    // Create JobVideo relationship if needed
    const shouldCreateJobVideo = alwaysCreateJobVideo || !videoExisted;

    if (shouldCreateJobVideo) {
      // Check if JobVideo relationship already exists
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

  // Save a single job and its video data to the database
  async saveJobOnly(jobId, jobDataOriginal) {
    const jobData = { ...jobDataOriginal };

    if (!jobData.data) {
      return;
    }

    let videos = jobData.data.videos ? jobData.data.videos : [];
    delete jobData.data; // Remove videos from job data

    try {
      // Update the job in the database
      let jobInstance = await Job.findOne({ where: { id: jobId } });
      if (jobInstance) {
        await jobInstance.update(jobData);
      } else {
        jobInstance = await Job.create(jobData);
      }

      // Process videos for this job only
      for (let video of videos) {
        await this.upsertVideoForJob(video, jobInstance);

        // Upsert into channelvideos
        try {
          await this.upsertChannelVideoFromInfo({
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
    } catch (error) {
      logger.error({ err: error }, 'Error saving job');
    }
  }

  async saveJobs() {
    if (this.isSaving) {
      // If a save operation is already in progress, skip this one
      logger.debug('Save operation already in progress, skipping');
      return;
    }
    this.isSaving = true; // Set the locking variable
    logger.debug({ jobCount: Object.keys(this.jobs).length }, 'saveJobs() called - processing jobs');

    for (let jobId in this.jobs) {
      let jobDataOriginal = this.jobs[jobId];
      const jobData = { ...jobDataOriginal };

      if (!jobData.data) {
        logger.debug({ jobId }, 'Job has no data field, skipping');
        continue;
      }
      let videos = jobData.data.videos ? jobData.data.videos : [];
      logger.debug({ jobId, videoCount: videos.length }, 'Job has videos to save');
      delete jobData.data; // Remove videos from job data

      try {
        // Find the job in the database.
        let jobInstance = await Job.findOne({ where: { id: jobId } });

        // If the job exists, update it. Otherwise, create it.
        if (jobInstance) {
          await jobInstance.update(jobData);
        } else {
          jobInstance = await Job.create(jobData);
        }

        // Skip updating video data for completed/terminated jobs to avoid overwriting fresher data
        // UNLESS the job is marked as needing save (e.g., after saveJobOnly failed)
        const isCompletedJob = jobData.status === 'Complete' ||
                               jobData.status === 'Complete with Warnings' ||
                               jobData.status === 'Error' ||
                               jobData.status === 'Terminated' ||
                               jobData.status === 'Killed';

        if (isCompletedJob && !jobDataOriginal._needsSave) {
          logger.debug({ jobId }, 'Skipping video updates for completed job');
          continue;
        }

        if (jobDataOriginal._needsSave) {
          logger.debug({ jobId, retryAttempt: jobDataOriginal._saveRetries || 1 }, 'Processing job due to previous save failure');
          // Don't clear flags yet - only clear after successful video processing
        }

        // For each video, find it in the database. If it exists, update it. Otherwise, create it.
        try {
          for (let video of videos) {
            logger.debug({ youtubeId: video.youtubeId, title: video.youTubeVideoName }, 'Processing video');
            await this.upsertVideoForJob(video, jobInstance);

            // Also upsert into channelvideos so Channel page reflects downloaded items
            try {
              await this.upsertChannelVideoFromInfo({
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

          // Only clear retry flags if video processing succeeded
          if (jobDataOriginal._needsSave) {
            logger.debug({ jobId }, 'Successfully saved job on retry, clearing flags');
            delete jobDataOriginal._needsSave;
            delete jobDataOriginal._saveRetries;
          }
        } catch (error) {
          logger.error({ err: error, jobId }, 'Error saving videos for job');
          // Don't clear flags - let retry logic handle it
          if (jobDataOriginal._needsSave) {
            logger.error({ jobId }, 'Retry failed for job, flags preserved for next attempt');
          }
          throw error; // Re-throw to be caught by outer catch
        }
      } catch (error) {
        logger.error({ err: error }, 'Error saving job');
      }
    }
    this.isSaving = false; // Reset the locking variable when done
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

    const [record, created] = await ChannelVideo.findOrCreate({
      where: { youtube_id, channel_id },
      defaults: { title, thumbnail, duration, publishedAt, availability, media_type },
    });
    if (!created && !skipUpdateIfExists) {
      await record.update({ title, thumbnail, duration, availability, media_type });
    }
  }

  // Backfill Videos and channelvideos tables from complete.list and jobs info JSON
  async backfillFromCompleteList() {
    try {
      const archivePath = path.join(__dirname, '../../config', 'complete.list');
      let archiveContent;
      try {
        archiveContent = await fsPromises.readFile(archivePath, 'utf-8');
      } catch (e) {
        if (e && e.code === 'ENOENT') {
          logger.info('No complete.list found for backfill. Skipping.');
          return;
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

      // Cap per run to 300 items
      const maxPerRun = 300;
      const capped = candidates.slice(0, maxPerRun);

      let processed = 0;
      for (const { id, needsVideo, needsChannelVideo } of capped) {
        const infoPath = path.join(__dirname, `../../jobs/info/${id}.info.json`);

        let info;
        try {
          const content = await fsPromises.readFile(infoPath, 'utf-8');
          info = JSON.parse(content);
        } catch (e) {
          if (e && e.code === 'ENOENT') {
            // Record ids missing info.json only if we needed to backfill and cannot
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
          const configModule = require('./configModule');
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
          };

          // Check if file exists and get file size
          try {
            const stats = await fsPromises.stat(fullPath);
            payload.filePath = fullPath;
            payload.fileSize = stats.size.toString();
            payload.removed = false;
          } catch (err) {
            // Try other common extensions
            const extensions = ['.webm', '.mkv', '.m4v', '.avi'];
            let fileFound = false;

            for (const ext of extensions) {
              const altPath = fullPath.replace('.mp4', ext);
              try {
                const stats = await fsPromises.stat(altPath);
                payload.filePath = altPath;
                payload.fileSize = stats.size.toString();
                payload.removed = false;
                fileFound = true;
                break;
              } catch (altErr) {
                // Continue trying other extensions
              }
            }

            if (!fileFound) {
              payload.filePath = fullPath;
              payload.fileSize = null;
              payload.removed = false;
            }
          }

          let videoInstance = await Video.findOne({ where: { youtubeId: info.id } });
          if (!videoInstance && needsVideo) {
            await Video.create(payload);
            videosUpserts += 1;
          } else if (videoInstance) {
            const updates = {};

            // Update file metadata only if not already set
            if (!videoInstance.filePath || !videoInstance.fileSize) {
              if (payload.filePath || payload.fileSize) {
                updates.filePath = payload.filePath;
                updates.fileSize = payload.fileSize;
                updates.removed = payload.removed;
              }
            }

            // Update media_type only if currently set to default 'video' (meaning it hasn't been set yet)
            if (videoInstance.media_type === 'video' && payload.media_type && payload.media_type !== 'video') {
              updates.media_type = payload.media_type;
            }

            if (Object.keys(updates).length > 0) {
              await videoInstance.update(updates);
            }
          }
        } catch (vidErr) {
          logger.error({ err: vidErr, id }, 'Error upserting Videos');
        }

        // Upsert into channelvideos table only if missing
        try {
          if (needsChannelVideo) {
            await this.upsertChannelVideoFromInfo(info, { skipUpdateIfExists: true });
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
    } catch (err) {
      logger.error({ err }, 'Backfill error');
    }
  }

  // Schedule daily backfill at 2:20am local time
  scheduleDailyBackfill() {
    try {
      cron.schedule('20 2 * * *', () => {
        this.backfillFromCompleteList().catch((err) => {
          logger.error({ err }, 'Scheduled backfill failed');
        });
      });
      logger.info('Scheduled daily backfill from complete.list at 2:20am');
    } catch (err) {
      logger.error({ err }, 'Failed to schedule daily backfill');
    }
  }

  getJob(jobId) {
    return this.jobs[jobId];
  }

  getRunningJobs() {
    // If this.jobs is undefined or null, return an empty array
    if (!this.jobs) {
      logger.debug('No jobs found. Returning empty array.');
      return [];
    }

    const now = Date.now();
    const cutoff = now - 14 * 24 * 60 * 60 * 1000; // 14 days ago

    // Delete jobs older than the cutoff
    for (let jobId in this.jobs) {
      if (this.jobs[jobId].timeCreated < cutoff) {
        delete this.jobs[jobId];
      }
    }

    // Convert jobs into an array and add 'id' field
    let jobsArray = Object.entries(this.jobs).map(([id, job]) => {
      return { id, ...job };
    });

    // Sort jobs by timeCreated in descending order
    jobsArray.sort((a, b) => b.timeCreated - a.timeCreated);

    // Return the last 240 jobs (we may want to adjust this)
    return jobsArray.slice(0, 240);
  }

  getAllJobs() {
    return this.jobs;
  }

  async addJob(job) {
    const jobId = uuidv4(); // Generate a new UUID
    job.timeInitiated = Date.now();
    job.timeCreated = Date.now();
    job.id = jobId;
    this.jobs[jobId] = job;

    try {
      // Only save the new job to DB, don't touch other jobs
      await Job.create({
        id: jobId,
        jobType: job.jobType,
        status: job.status,
        output: job.output || '',
        timeInitiated: job.timeInitiated,
        timeCreated: job.timeCreated,
      });
      return jobId;
    } catch (error) {
      logger.error({ err: error }, 'Error saving job');
      throw error;
    }
  }

  async updateJob(jobId, updatedFields) {
    logger.debug({ jobId, status: updatedFields.status }, 'updateJob called');
    if (updatedFields.data && updatedFields.data.videos) {
      logger.debug({ jobId, videoCount: updatedFields.data.videos.length }, 'updateJob data contains videos');
    }

    if (
      updatedFields.status === 'Complete' ||
      updatedFields.status === 'Error' ||
      updatedFields.status === 'Complete with Warnings' ||
      updatedFields.status === 'Terminated'
    ) {
      // downloadModule already sends proper completion messages with finalSummary
      // Only send the downloadComplete event for backwards compatibility
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadComplete',
        { text: 'Download job completed.', videos: updatedFields.data?.videos || [] }
      );

      // Only modify output and status for actual completions, not terminations
      if (updatedFields.status !== 'Terminated') {
        let numVideos = updatedFields.data?.videos?.length || 0;
        updatedFields.output = numVideos + ' videos.';
        updatedFields.status = 'Complete';
      }
    }
    const job = this.jobs[jobId];
    if (!job) {
      logger.warn('Job to update did not exist!');
      return;
    }

    // Update in-memory job
    for (let field in updatedFields) {
      job[field] = updatedFields[field];
    }

    // Save only THIS job to DB, don't iterate through all jobs
    const isCompletedJob = updatedFields.status === 'Complete' ||
                           updatedFields.status === 'Complete with Warnings' ||
                           updatedFields.status === 'Error' ||
                           updatedFields.status === 'Terminated' ||
                           updatedFields.status === 'Killed';

    if (isCompletedJob) {
      // For completed jobs, reload videos from DB to ensure accurate counts
      // This is especially important for multi-group downloads where each group
      // updates the job with only its own videos, potentially losing earlier videos
      try {
        const jobVideos = await JobVideo.findAll({
          where: { job_id: jobId }
        });

        const videos = [];
        for (const jobVideo of jobVideos) {
          const video = await Video.findOne({ where: { id: jobVideo.video_id } });
          if (video) {
            videos.push(video.dataValues);
          }
        }

        // Update in-memory structure with complete video list from DB
        if (!job.data) {
          job.data = {};
        }
        job.data.videos = videos;

        // Update output message to reflect correct video count
        if (updatedFields.status !== 'Terminated') {
          job.output = `${videos.length} videos.`;
        }

        logger.info({ jobId, videoCount: videos.length }, 'Reloaded videos from database for completed job');
      } catch (loadErr) {
        logger.error({ err: loadErr, jobId }, 'Error loading videos from database for completed job');
        // Continue with save anyway - don't fail the job completion
      }

      // For completed jobs, save the job and its video data with retry on failure
      this.saveJobOnly(jobId, job).catch(err => {
        logger.error({ err, jobId }, 'Failed to save completed job, marking for retry');
        // Track retry attempts to avoid infinite loops
        if (this.jobs[jobId]) {
          this.jobs[jobId]._needsSave = true;
          this.jobs[jobId]._saveRetries = (this.jobs[jobId]._saveRetries || 0) + 1;

          // Only retry up to 3 times
          if (this.jobs[jobId]._saveRetries <= MAX_SAVE_RETRIES) {
            this.scheduleSaveRetry(jobId, this.jobs[jobId]._saveRetries);
          } else {
            logger.error({ jobId, maxRetries: MAX_SAVE_RETRIES }, 'Max retries exceeded for job. Video data may be lost. Check database connectivity.');
            // Clear flags so we don't keep trying
            delete this.jobs[jobId]._needsSave;
            delete this.jobs[jobId]._saveRetries;
          }
        }
      });
    } else {
      // For in-progress jobs, call saveJobs to handle updates
      this.saveJobs().catch(err => {
        logger.error({ err, jobId }, 'Failed to save in-progress job');
      });
    }
  }

  deleteJob(jobId) {
    delete this.jobs[jobId];

    this.saveJobs().then(() => {
      return;
    });
  }

  scheduleSaveRetry(jobId, attempt) {
    const job = this.jobs[jobId];
    if (!job) {
      logger.warn({ jobId }, 'Cannot schedule retry for missing job');
      return;
    }

    const retryDelay = 1000 * attempt; // Exponential backoff: 1s, 2s, 3s
    logger.info({ jobId, attempt, maxRetries: MAX_SAVE_RETRIES, retryDelay }, 'Will retry save for job');

    setTimeout(() => {
      this.runSaveRetry(jobId, attempt);
    }, retryDelay);
  }

  async runSaveRetry(jobId, attempt) {
    const jobBeforeRetry = this.jobs[jobId];
    if (!jobBeforeRetry) {
      logger.warn({ jobId, attempt }, 'Retry attempt skipped - job no longer exists in memory');
      return;
    }

    try {
      await this.saveJobs();
    } catch (err) {
      logger.error({ err, jobId, attempt }, 'Retry attempt for job failed while saving jobs');
    }

    const jobAfterRetry = this.jobs[jobId];
    if (!jobAfterRetry) {
      logger.warn({ jobId, attempt }, 'Retry attempt completed but job is no longer tracked');
      return;
    }

    if (!jobAfterRetry._needsSave) {
      // Retry succeeded - clear counters if present
      if (jobAfterRetry._saveRetries) {
        logger.debug({ jobId, attempt }, 'Successfully saved job after retry attempt, clearing retry flags');
        delete jobAfterRetry._saveRetries;
      }
      return;
    }

    if (attempt >= MAX_SAVE_RETRIES) {
      logger.error({ jobId, maxRetries: MAX_SAVE_RETRIES }, 'Max retries exhausted for job. Video data may be lost. Giving up.');
      delete jobAfterRetry._needsSave;
      delete jobAfterRetry._saveRetries;
      return;
    }

    const nextAttempt = attempt + 1;
    jobAfterRetry._saveRetries = nextAttempt;
    logger.error({ jobId, attempt, nextAttempt, maxRetries: MAX_SAVE_RETRIES }, 'Retry attempt did not clear the pending save. Scheduling next attempt');
    this.scheduleSaveRetry(jobId, nextAttempt);
  }
}

module.exports = new JobModule();
