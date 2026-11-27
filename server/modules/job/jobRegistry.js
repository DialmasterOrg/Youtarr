// The in-memory job map and its only owner: every other job module reads
// jobRegistry.jobs at each use, and changes entries through setJob, removeJob
// and replaceAll.

const logger = require('../../logger');

// Download History window: jobs older than this are purged from memory,
// and at most MAX_HISTORY_JOBS are returned to the client. DB rows are
// never deleted, so raising these resurfaces older persisted jobs.
const JOB_RETENTION_DAYS = 42;
const MAX_HISTORY_JOBS = 720;

class JobRegistry {
  constructor() {
    this.jobs = {};
  }

  getJob(jobId) {
    return this.jobs[jobId];
  }

  getAllJobs() {
    return this.jobs;
  }

  getInProgressJobId() {
    for (let id in this.jobs) {
      if (this.jobs[id].status === 'In Progress') {
        return id;
      }
    }
    return null;
  }

  getRunningJobs() {
    if (!this.jobs) {
      logger.debug('No jobs found. Returning empty array.');
      return [];
    }

    const now = Date.now();
    const cutoff = now - JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (let jobId in this.jobs) {
      if (this.jobs[jobId].timeCreated < cutoff) {
        delete this.jobs[jobId];
      }
    }

    let jobsArray = Object.entries(this.jobs).map(([id, job]) => {
      return { id, ...job };
    });

    jobsArray.sort((a, b) => b.timeCreated - a.timeCreated);

    return jobsArray.slice(0, MAX_HISTORY_JOBS);
  }

  setJob(jobId, job) {
    this.jobs[jobId] = job;
  }

  removeJob(jobId) {
    delete this.jobs[jobId];
  }

  replaceAll(jobs) {
    this.jobs = jobs;
  }
}

module.exports = new JobRegistry();
