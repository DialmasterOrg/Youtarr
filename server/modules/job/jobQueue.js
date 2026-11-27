// Decides which job runs next: one job In Progress at a time, the rest
// Pending until a scan starts them.

const storageGuard = require('../storageGuard');
const { JOB_NOT_STARTED } = require('../constants/jobOutputPrefixes');
const logger = require('../../logger');
const jobRegistry = require('./jobRegistry');
const jobLifecycle = require('./jobLifecycle');

class JobQueue {
  // Jobs held while downloads were paused for storage start once it clears.
  listenForDownloadsResumed() {
    storageGuard.on('resumed', () => {
      if (jobRegistry.getInProgressJobId()) return;
      this.startNextJob().catch((err) => {
        logger.error({ err }, 'Failed to start queued job after downloads resumed');
      });
    });
  }

  /**
   * Start the first Pending job. Overlapping calls share one in-flight scan:
   * a job stays Pending while its action prepares (channel downloads build
   * their groups first), so two concurrent scans would both start it.
   * @returns {Promise<void>}
   */
  startNextJob() {
    if (!this.nextJobStart) {
      // Deferred a tick so the promise is stored before the scan runs; a
      // caller re-entering from inside the scan then joins this one.
      this.nextJobStart = Promise.resolve()
        .then(() => this._startNextJob())
        .finally(() => {
          this.nextJobStart = null;
        });
    }
    return this.nextJobStart;
  }

  async _startNextJob() {
    logger.info('Looking for next job to start');
    // Re-checking here also runs after every finished job, so crossing a
    // storage limit pauses downloads (and alerts the user) right away.
    // A failed check fails open, like the guard's own measurements.
    let guardStatus = null;
    try {
      guardStatus = await storageGuard.refresh();
    } catch (err) {
      logger.error({ err }, 'Could not check the download pause state; starting the next job anyway');
    }
    if (guardStatus && guardStatus.paused) {
      logger.info('Downloads are paused for storage; holding queued jobs');
      return;
    }
    const jobs = jobRegistry.getAllJobs();
    for (let id in jobs) {
      if (jobs[id].status !== 'Pending') continue;
      jobs[id].id = id;
      if (!jobs[id].action) {
        // Job is missing its action function (likely loaded from DB after restart)
        logger.warn({ jobId: id, jobType: jobs[id].jobType },
          'Cannot start pending job - missing action function, marking as Terminated');

        await jobLifecycle.updateJob(id, {
          status: 'Terminated',
          output: `${JOB_NOT_STARTED} after server restart`,
        });
        continue;
      }
      // Not awaited (the job runs in the background), so catch here:
      // an unhandled rejection would exit the process.
      Promise.resolve(jobs[id].action(jobs[id], true)).catch((err) => {
        logger.error({ err, jobId: id, jobType: jobs[id].jobType }, 'Failed to start queued job');
        return this.failUnstartedJob(id, err);
      }).catch((err) => {
        logger.error({ err, jobId: id }, 'Could not release a queued job that failed to start');
      });
      break;
    }
  }

  /**
   * A queued job whose action failed before the job left Pending would stay
   * Pending forever and hold every later job behind it. Mark it as an error
   * and start the next one. A job the action already moved on (In Progress
   * or finished) is left to the download path that owns it.
   * @param {string} jobId
   * @param {Error} err
   * @returns {Promise<void>}
   */
  async failUnstartedJob(jobId, err) {
    const job = jobRegistry.jobs[jobId];
    if (!job || job.status !== 'Pending') return;
    const reason = `${JOB_NOT_STARTED}: ${err && err.message ? err.message : 'Unknown error'}`;
    const runId = job.data && job.data.runId ? job.data.runId : null;
    await jobLifecycle.updateJob(jobId, { status: 'Error', output: reason });
    jobLifecycle.notifyJobAbandoned({ jobId, runId, reason });
    // The scan that launched this job may still be settling; joining it would
    // start nothing, since it is past its job loop. Let it end, then scan again.
    if (this.nextJobStart) await this.nextJobStart.catch(() => {});
    await this.startNextJob();
  }

  async addOrUpdateJob(jobData, isNextJob = false, preferredJobId = null) {
    let jobId;
    const inProgressJobId = jobRegistry.getInProgressJobId();
    if (!isNextJob) {
      if (inProgressJobId) {
        logger.info({ jobType: jobData.jobType }, 'A job is already in progress. Adding job to the queue');
        jobData.status = 'Pending';
        jobId = preferredJobId
          ? await jobLifecycle.addJob(jobData, preferredJobId)
          : await jobLifecycle.addJob(jobData);
      } else {
        logger.info({ jobType: jobData.jobType }, 'Adding job to jobs list as In Progress');
        jobData.status = 'In Progress';
        jobId = preferredJobId
          ? await jobLifecycle.addJob(jobData, preferredJobId)
          : await jobLifecycle.addJob(jobData);
      }
    } else if (isNextJob && !inProgressJobId) {
      logger.info('This is a "next job", flipping from Pending to In Progress');
      await jobLifecycle.updateJob(jobData.id, {
        status: 'In Progress',
        timeInitiated: Date.now(),
      });
      jobId = jobData.id;
      jobLifecycle.emitJobsUpdated(jobId, 'In Progress');
    } else {
      logger.warn('Cannot start next job as a job is already in progress');
    }
    return jobId;
  }
}

module.exports = new JobQueue();
