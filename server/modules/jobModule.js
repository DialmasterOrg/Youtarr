const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const Job = require('../models/job');
const Video = require('../models/video');
const JobVideo = require('../models/jobvideo');
const MessageEmitter = require('./messageEmitter.js'); // import the helper function

class JobModule {
  constructor() {
    this.jobsDir = path.join(__dirname, '../../jobs');
    this.jobsFilePath = path.join(__dirname, '../../jobs', 'jobs.json');
    this.jobsFilePathOld = path.join(this.jobsDir, 'jobs.json.old');

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
  }

  terminateInProgressJobs() {
    // Change the status of "In Progress" jobs to "Terminated".
    for (let jobId in this.jobs) {
      if (this.jobs[jobId].status === 'In Progress') {
        this.jobs[jobId].status = 'Terminated';
      }
    }
  }

  saveJobsAndStartNext() {
    // Save the jobs to the DB
    this.saveJobs().then(() => {
      this.startNextJob();
    });
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
        };
      }

      for (let jobVideo of jobVideos) {
        const video = await Video.findOne({ where: { id: jobVideo.video_id } });
        if (video && this.jobs[jobVideo.job_id]) {
          this.jobs[jobVideo.job_id].data.videos.push(video.dataValues);
        }
      }
    } catch (error) {
      console.error('Error loading jobs from DB:', error);
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
            console.error('Error migrating video: ' + error.message);
          }

          // Create jobVideo relationship
          try {
            await JobVideo.create({
              job_id: jobInstance.id,
              video_id: videoInstance.id,
            });
          } catch (error) {
            console.error('Error migrating jobVideo: ' + error.message);
          }
        }
      } catch (error) {
        console.error('Error migrating job: ' + error.message);
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

  async addOrUpdateJob(jobData, isNextJob = false) {
    let jobId;
    const inProgressJobId = this.getInProgressJobId();
    if (!isNextJob) {
      if (inProgressJobId) {
        // If there is a job in progress, create a new job with status Pending
        console.log(
          `A job is already in progress. Adding this ${jobData.jobType} job to the queue.`
        );
        jobData.status = 'Pending';
        jobId = await this.addJob(jobData);
      } else {
        // Otherwise, add a job with status In Progress
        console.log(
          `Adding job to jobs list as In Progress for ${jobData.jobType} job.`
        );
        jobData.status = 'In Progress';
        jobId = await this.addJob(jobData);
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

  async saveJobs() {
    for (let jobId in this.jobs) {
      let jobDataOriginal = this.jobs[jobId];
      const jobData = { ...jobDataOriginal };

      if (!jobData.data) {
        continue;
      }
      let videos = jobData.data.videos ? jobData.data.videos : [];
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

        // For each video, find it in the database. If it exists, update it. Otherwise, create it.
        for (let video of videos) {
          let videoInstance = await Video.findOne({
            where: { youtubeId: video.youtubeId },
          });

          if (videoInstance) {
            await videoInstance.update(video);
          } else {
            videoInstance = await Video.create(video);

            // Create jobVideo relationship
            await JobVideo.create({
              job_id: jobInstance.id,
              video_id: videoInstance.id,
            });
          }
        }
      } catch (error) {
        console.error('Error saving job: ' + error.message);
      }
    }
  }

  getJob(jobId) {
    return this.jobs[jobId];
  }

  getRunningJobs() {
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

    // Return the last 120 jobs (we may want to adjust this)
    return jobsArray.slice(0, 120);
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
      await this.saveJobs();
      return jobId;
    } catch (error) {
      console.error('Error saving job: ' + error.message);
      throw error;
    }
  }

  updateJob(jobId, updatedFields) {
    if (
      updatedFields.status === 'Complete' ||
      updatedFields.status === 'Error' ||
      updatedFields.status === 'Complete with Warnings'
    ) {
      let numVideos = updatedFields.data.videos.length;
      if (numVideos == 0) {
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          { text: 'Completed: No new videos downloaded.' }
        );
      } else {
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          { text: 'Completed: ' + numVideos + ' new videos downloaded.' }
        );
      }
      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadComplete',
        { text: 'Download job completed.', videos: updatedFields.data.videos }
      );

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

    this.saveJobs().then(() => {
      return;
    });
  }

  deleteJob(jobId) {
    delete this.jobs[jobId];

    this.saveJobs().then(() => {
      return;
    });
  }
}

module.exports = new JobModule();
