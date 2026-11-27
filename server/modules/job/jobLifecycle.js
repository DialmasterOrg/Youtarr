// Creates jobs and applies their status changes, and tells listeners when a
// job ends or is abandoned.

const { v4: uuidv4, validate: uuidValidate } = require('uuid');
const Job = require('../../models/job');
const MessageEmitter = require('../messageEmitter.js');
const videoActivity = require('../download/videoActivity');
const { isDownloadJob, isSpecificUrlDownloadJob } = require('../download/jobTypes');
const { FINAL_JOB_STATUSES } = require('../constants/jobStatuses');
const logger = require('../../logger');
const jobRegistry = require('./jobRegistry');
const jobPersistence = require('./jobPersistence');

// Terminal download statuses whose output is rewritten to "N videos.".
const SUCCESS_STATUSES = new Set(['Complete', 'Complete with Warnings']);
// Download statuses that broadcast the legacy downloadComplete event.
const DOWNLOAD_COMPLETE_STATUSES = new Set(['Complete', 'Complete with Warnings', 'Error', 'Terminated']);

class JobLifecycle {
  constructor() {
    // Told when failUnstartedJob gives up on a queued job; see onJobAbandoned.
    this.jobAbandonedListeners = new Set();
    // Told whenever updateJob gives a job a final status; see onJobEnded.
    this.jobEndedListeners = new Set();
  }

  /**
   * Listen for queued jobs abandoned before they started, so a download run
   * can count them without jobModule depending on the run tracker.
   * @param {Function} listener - called with { jobId, runId, reason }
   * @returns {Function} unsubscribe
   */
  onJobAbandoned(listener) {
    this.jobAbandonedListeners.add(listener);
    return () => this.jobAbandonedListeners.delete(listener);
  }

  /**
   * Listen for jobs given a final status (by any path: the download
   * finalizer, error handlers, or failUnstartedJob), so a download run can
   * tell a job that ended without reporting from one still running.
   * @param {Function} listener - called with { jobId }
   * @returns {Function} unsubscribe
   */
  onJobEnded(listener) {
    this.jobEndedListeners.add(listener);
    return () => this.jobEndedListeners.delete(listener);
  }

  notifyJobEnded(event) {
    for (const listener of this.jobEndedListeners) {
      try {
        listener(event);
      } catch (err) {
        logger.warn({ err, jobId: event.jobId }, 'Job ended listener failed');
      }
    }
  }

  notifyJobAbandoned(event) {
    for (const listener of this.jobAbandonedListeners) {
      try {
        listener(event);
      } catch (err) {
        logger.warn({ err, jobId: event.jobId }, 'Abandoned job listener failed');
      }
    }
  }

  // Lets listing pages (e.g. Download History) refetch when a job is enqueued or starts.
  emitJobsUpdated(jobId, status) {
    MessageEmitter.emitMessage('broadcast', null, 'download', 'jobsUpdated', {
      jobId,
      status,
    });
  }

  async addJob(job, preferredJobId = null) {
    // Trusted internal callers may supply a stable UUID so enqueueing can be
    // retried safely across an external-request persistence boundary.
    if (preferredJobId != null && !uuidValidate(preferredJobId)) {
      throw new Error('Preferred job id must be a UUID');
    }
    const jobId = preferredJobId || uuidv4();
    if (isSpecificUrlDownloadJob(job.jobType) && Array.isArray(job.data?.urls)) {
      const admission = videoActivity.claim(jobId, job.data.urls);
      job.data.urls = admission.acceptedUrls;
      if (!admission.acceptedUrls.length) return null;
    }
    job.timeInitiated = Date.now();
    job.timeCreated = Date.now();
    job.id = jobId;
    jobRegistry.setJob(jobId, job);

    try {
      await Job.create({
        id: jobId,
        jobType: job.jobType,
        status: job.status,
        output: job.output || '',
        timeInitiated: job.timeInitiated,
        timeCreated: job.timeCreated,
      });
      this.emitJobsUpdated(jobId, job.status);
      return jobId;
    } catch (error) {
      videoActivity.finishJob(jobId);
      jobRegistry.removeJob(jobId);
      logger.error({ err: error }, 'Error saving job');
      throw error;
    }
  }

  async updateJob(jobId, updatedFields) {
    logger.debug({ jobId, status: updatedFields.status }, 'updateJob called');
    if (updatedFields.data && updatedFields.data.videos) {
      logger.debug({ jobId, videoCount: updatedFields.data.videos.length }, 'updateJob data contains videos');
    }

    const job = jobRegistry.jobs[jobId];
    if (!job) {
      logger.warn('Job to update did not exist!');
      return;
    }

    // Non-download jobs (e.g. Import Subscriptions) manage their own output field.
    const jobIsDownload = isDownloadJob(job.jobType);

    if (jobIsDownload && DOWNLOAD_COMPLETE_STATUSES.has(updatedFields.status)) {
      // downloadModule already sends proper completion messages with finalSummary
      // Only send the downloadComplete event for backwards compatibility
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadComplete',
        { text: 'Download job completed.', videos: updatedFields.data?.videos || [] }
      );

      // Successful completions report a video count; failures keep their own
      // status and output so the reason survives into Download History.
      if (SUCCESS_STATUSES.has(updatedFields.status)) {
        let numVideos = updatedFields.data?.videos?.length || 0;
        updatedFields.output = numVideos + ' videos.';
      }
    }

    for (let field in updatedFields) {
      job[field] = updatedFields[field];
    }
    // Before the database work below: listeners (the download run tracker)
    // must know the job has ended even while its results are still on the way.
    const isCompletedJob = FINAL_JOB_STATUSES.has(updatedFields.status);
    if (isCompletedJob) this.notifyJobEnded({ jobId });

    if (isCompletedJob) videoActivity.finishJob(jobId);

    if (isCompletedJob && jobIsDownload) {
      // For completed download jobs, reload videos from DB to ensure accurate counts
      // This is especially important for multi-group downloads where each group
      // updates the job with only its own videos, potentially losing earlier videos
      try {
        const videos = await jobPersistence.loadJobVideos(jobId);

        if (!job.data) {
          job.data = {};
        }
        job.data.videos = videos;

        if (SUCCESS_STATUSES.has(updatedFields.status)) {
          job.output = `${videos.length} videos.`;
        }

        logger.info({ jobId, videoCount: videos.length }, 'Reloaded videos from database for completed job');
      } catch (loadErr) {
        logger.error({ err: loadErr, jobId }, 'Error loading videos from database for completed job');
        // Continue with save anyway - don't fail the job completion
      }
    }

    if (isCompletedJob) {
      // Save ALL completed jobs to DB (download and non-download alike) with retry on failure
      jobPersistence.saveCompletedJob(jobId, job);
    } else {
      jobPersistence.saveJobs().catch(err => {
        logger.error({ err, jobId }, 'Failed to save in-progress job');
      });
    }
  }
}

module.exports = new JobLifecycle();
