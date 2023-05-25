const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const myEmitter = require('./events');


class JobModule {
  constructor() {
    this.jobsDir = path.join(__dirname, '../../jobs');
    this.jobsFilePath = path.join(__dirname, '../../jobs', 'jobs.json');

    if (!fs.existsSync(this.jobsDir)) {
      fs.mkdirSync(this.jobsDir, { recursive: true });
    }

    // Load jobs from file, if it exists.
    if (fs.existsSync(this.jobsFilePath)) {
      const fileContent = fs.readFileSync(this.jobsFilePath);
      this.jobs = JSON.parse(fileContent);
      // Change the status of "In Progress" jobs to "Terminated".
      for (let jobId in this.jobs) {
        if (this.jobs[jobId].status === 'In Progress') {
          this.jobs[jobId].status = 'Terminated';
        }
      }

      this.saveJobs(); // Save jobs after updating their status
    } else {
      this.jobs = {};
    }
    this.startNextJob();
  }

  getInProgressJobId() {
    for (let id in this.jobs) {
      if (this.jobs[id].status === 'In Progress') {
        return id;
      }
    }
    return null;
  }

  startNextJob() {
    console.log('Looking for next job to start');
    const jobs = this.getAllJobs();
    for (let id in jobs) {
      if (jobs[id].status === 'Pending') {
        jobs[id].id = id;
        if (jobs[id].action) {
          jobs[id].action(jobs[id], true); // Invoke the function
        }
        break;
      }
    }
  }

  addOrUpdateJob(jobData, isNextJob = false) {
    let jobId;
    const inProgressJobId = this.getInProgressJobId();
    if (!isNextJob) {
      if (inProgressJobId) {
        // If there is a job in progress, create a new job with status Pending
        console.log(`A job is already in progress. Adding this ${jobData.jobType} job to the queue.`);
        jobData.status = 'Pending';
        jobId = this.addJob(jobData);
      } else {
        // Otherwise, add a job with status In Progress
        console.log(`Adding job to jobs list as In Progress for ${jobData.jobType} job.`);
        jobData.status = 'In Progress';
        jobId = this.addJob(jobData);
      }
    } else if (isNextJob && !inProgressJobId) {
      // If this is a next job and there's no job in progress, update its status to In Progress
      console.log('This is a "next job", flipping from Pending to In Progress');
      this.updateJob(jobData.id, {
        status: 'In Progress',
        timeInitiated: Date.now(),
      });
      jobId = jobData.id;
    } else {
      console.log('Cannot start next job as a job is already in progress');
    }
    return jobId;
  }

  saveJobs() {
    // Write jobs to file.
    const fileContent = JSON.stringify(this.jobs, null, 2);
    fs.writeFileSync(this.jobsFilePath, fileContent);
  }

  getJob(jobId) {
    return this.jobs[jobId];
  }

  getRunningJobs() {
    // Remove jobs older than 1 week
    const now = Date.now();
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;

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

    // Return the last 20 jobs (we may want to adjust this)
    return jobsArray.slice(0, 20);
  }

  getAllJobs() {
    return this.jobs;
  }

  addJob(job) {
    const jobId = uuidv4(); // Generate a new UUID
    job.timeInitiated = Date.now();
    job.timeCreated = Date.now();
    job.id = jobId;
    console.log('Adding job: ' + JSON.stringify(job));
    console.log('Job ID: ' + jobId);
    this.jobs[jobId] = job;

    this.saveJobs(); // Save jobs after adding new one

    return jobId;
  }

  updateJob(jobId, updatedFields) {
    console.log('Updating job: ' + jobId);
    console.log('Updated fields: ' + JSON.stringify(updatedFields));
    if (updatedFields.status === 'Complete' || updatedFields.status === 'Error' || updatedFields.status === 'Complete with Warnings') {
      let numVideos = updatedFields.data.videos.length;
      if (numVideos == 0) {
        myEmitter.emit('newData', 'Completed: No new videos downloaded.');
      } else {
        myEmitter.emit('newData', 'Completed: ' + numVideos + ' new videos downloaded.');
      }
      updatedFields.output = numVideos + ' videos.';
      updatedFields.status = 'Complete';
    }
    const job = this.jobs[jobId];
    if (!job) {
      console.log('Job to update did not exist!');
      return;
    }
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
