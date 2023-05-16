const { v4: uuidv4 } = require('uuid');

class JobModule {
  constructor() {
    this.jobs = {};
  }

  getJob(jobId) {
    return this.jobs[jobId];
  }

  getRunningJobs() {
    // Remove jobs older than 12 hours
    const now = Date.now();
    const cutoff = now - 12 * 60 * 60 * 1000;

    // Delete jobs older than the cutoff
    for (let jobId in this.jobs) {
      if (this.jobs[jobId].timeStarted < cutoff) {
        delete this.jobs[jobId];
      }
    }

    // Convert jobs into an array
    const jobsArray = Object.values(this.jobs);

    // Sort jobs by timeStarted in descending order
    jobsArray.sort((a, b) => b.timeStarted - a.timeStarted);

    // Return the last 5 jobs
    return jobsArray.slice(0, 5);
  }

  getAllJobs() {
    return this.jobs;
  }

  addJob(job) {
    const jobId = uuidv4(); // Generate a new UUID
    job.timeStarted = Date.now();
    console.log('Adding job: ' + JSON.stringify(job));
    console.log('Job ID: ' + jobId);
    this.jobs[jobId] = job;
    return jobId;
  }

  updateJob(jobId, updatedFields) {

    console.log('Updating job: ' + jobId);
    console.log('Updated fields: ' + JSON.stringify(updatedFields));
    const job = this.jobs[jobId];

    // If the job doesn't exist, do nothing
    if (!job) {
      console.log("Job to update did not exist!");
      return;
    }

    // For each updated field, update the corresponding field in the job
    for (let field in updatedFields) {
      job[field] = updatedFields[field];
    }
  }

  deleteJob(jobId) {
    delete this.jobs[jobId];
  }
}

module.exports = new JobModule();