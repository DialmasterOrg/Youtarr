const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class JobModule {
  constructor() {
    this.jobsFilePath = path.join(__dirname, '../../config', 'jobs.json');

    // Load jobs from file, if it exists.
    if (fs.existsSync(this.jobsFilePath)) {
      const fileContent = fs.readFileSync(this.jobsFilePath);
      this.jobs = JSON.parse(fileContent);
      // Change the status of "In Progress" jobs to "Terminated".
      for (let jobId in this.jobs) {
        if (this.jobs[jobId].status === "In Progress") {
          this.jobs[jobId].status = "Terminated";
        }
      }

      this.saveJobs(); // Save jobs after updating their status
    } else {
      this.jobs = {};
    }
  }

  saveJobs() {
    // Write jobs to file.
    const fileContent = JSON.stringify(this.jobs);
    fs.writeFileSync(this.jobsFilePath, fileContent);
  }

  getJob(jobId) {
    return this.jobs[jobId];
  }

  getRunningJobs() {
    // Remove jobs older than 24 hours
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;

    // Delete jobs older than the cutoff
    for (let jobId in this.jobs) {
      if (this.jobs[jobId].timeCreated < cutoff) {
        delete this.jobs[jobId];
      }
    }

    // Convert jobs into an array
    const jobsArray = Object.values(this.jobs);

    // Sort jobs by timeCreated in descending order
    jobsArray.sort((a, b) => b.timeCreated - a.timeCreated);

    // Return the last 20 jobs (we may want to adjust this)
    return jobsArray.slice(0, 10);
  }

  getAllJobs() {
    return this.jobs;
  }

  addJob(job) {
    const jobId = uuidv4(); // Generate a new UUID
    job.timeInitiated = Date.now();
    job.timeCreated = Date.now();
    console.log('Adding job: ' + JSON.stringify(job));
    console.log('Job ID: ' + jobId);
    this.jobs[jobId] = job;

    this.saveJobs(); // Save jobs after adding new one

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

    this.saveJobs(); // Save jobs after updating
  }

  deleteJob(jobId) {
    delete this.jobs[jobId];

    this.saveJobs(); // Save jobs after deleting
  }
}

module.exports = new JobModule();
