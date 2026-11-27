// Facade over modules/job/: runs the startup sequence and forwards the
// public job API, so callers never require the sub-modules directly.

const fs = require('fs');
const configModule = require('./configModule');
const logger = require('../logger');
const jobRegistry = require('./job/jobRegistry');
const jobPersistence = require('./job/jobPersistence');
const jobLifecycle = require('./job/jobLifecycle');
const jobQueue = require('./job/jobQueue');
const jobRecovery = require('./job/jobRecovery');
const jobMigration = require('./job/jobMigration');
const jobBackfill = require('./job/jobBackfill');

class JobModule {
  constructor() {
    const jobsDir = configModule.getJobsPath();
    if (!fs.existsSync(jobsDir)) {
      fs.mkdirSync(jobsDir, { recursive: true });
    }

    // Recovery and the first queue scan run side by side, as they always have.
    const loadAndStart = () => jobPersistence.loadJobsFromDB().then(() => {
      jobRecovery.terminateInProgressJobs().catch((err) => {
        logger.error({ err }, 'Failed to recover jobs after restart');
      });
      jobQueue.startNextJob().catch((err) => {
        logger.error({ err }, 'Failed to start the next job at startup');
      });
    });
    const migration = jobMigration.migrateLegacyJobsFile();
    (migration ? migration.then(loadAndStart) : loadAndStart()).catch((err) => {
      logger.error({ err }, 'Failed to load jobs at startup');
    });

    jobQueue.listenForDownloadsResumed();

    // Schedule a daily backfill from complete.list and run an initial backfill
    jobBackfill.scheduleDailyBackfill();
    configModule.onConfigChange(() => jobBackfill.scheduleDailyBackfill());

    const disableInitialBackfill = process.env.JOBMODULE_DISABLE_INITIAL_BACKFILL === 'true';
    if (!disableInitialBackfill) {
      setTimeout(() => {
        jobBackfill.runStartupBackfill().catch((err) => {
          logger.error({ err }, 'Initial backfill failed');
        });
      }, 0);
    }
  }

  get jobs() {
    return jobRegistry.jobs;
  }

  getJob(jobId) {
    return jobRegistry.getJob(jobId);
  }

  getAllJobs() {
    return jobRegistry.getAllJobs();
  }

  getInProgressJobId() {
    return jobRegistry.getInProgressJobId();
  }

  getRunningJobsWithFreshVideos() {
    return jobPersistence.getRunningJobsWithFreshVideos();
  }

  saveJobOnly(jobId, jobDataOriginal) {
    return jobPersistence.saveJobOnly(jobId, jobDataOriginal);
  }

  reloadJobVideos(jobIds) {
    return jobPersistence.reloadJobVideos(jobIds);
  }

  addJob(job, preferredJobId = null) {
    return jobLifecycle.addJob(job, preferredJobId);
  }

  updateJob(jobId, updatedFields) {
    return jobLifecycle.updateJob(jobId, updatedFields);
  }

  onJobEnded(listener) {
    return jobLifecycle.onJobEnded(listener);
  }

  onJobAbandoned(listener) {
    return jobLifecycle.onJobAbandoned(listener);
  }

  addOrUpdateJob(jobData, isNextJob = false, preferredJobId = null) {
    return jobQueue.addOrUpdateJob(jobData, isNextJob, preferredJobId);
  }

  startNextJob() {
    return jobQueue.startNextJob();
  }

  failUnstartedJob(jobId, err) {
    return jobQueue.failUnstartedJob(jobId, err);
  }
}

module.exports = new JobModule();
