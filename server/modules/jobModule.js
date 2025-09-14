const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const Job = require('../models/job');
const Video = require('../models/video');
const JobVideo = require('../models/jobvideo');
const ChannelVideo = require('../models/channelvideo');
const cron = require('node-cron');
const MessageEmitter = require('./messageEmitter.js'); // import the helper function

class JobModule {
  constructor() {
    this.jobsDir = path.join(__dirname, '../../jobs');
    this.jobsFilePath = path.join(__dirname, '../../jobs', 'jobs.json');
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
    setTimeout(() => {
      this.backfillFromCompleteList().catch((err) => {
        console.error('Initial backfill failed:', err.message);
      });
    }, 0);
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
    if (this.isSaving) {
      // If a save operation is already in progress, skip this one
      console.log('Save operation already in progress, skipping...');
      return;
    }
    this.isSaving = true; // Set the locking variable
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

          // Also upsert into channelvideos so Channel page reflects downloaded items
          try {
            await this.upsertChannelVideoFromInfo({
              id: video.youtubeId,
              title: video.youTubeVideoName,
              duration: video.duration,
              upload_date: video.originalDate,
              channel_id: video.channel_id,
            });
          } catch (cvErr) {
            console.error('Error upserting channel video:', cvErr.message);
          }
        }
      } catch (error) {
        console.error('Error saving job: ' + error.message);
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
    const thumbnail = `https://i.ytimg.com/vi/${youtube_id}/mqdefault.jpg`;

    const [record, created] = await ChannelVideo.findOrCreate({
      where: { youtube_id, channel_id },
      defaults: { title, thumbnail, duration, publishedAt, availability },
    });
    if (!created && !skipUpdateIfExists) {
      await record.update({ title, thumbnail, duration, publishedAt, availability });
    }
  }

  // Backfill Videos and channelvideos tables from complete.list and jobs info JSON
  async backfillFromCompleteList() {
    try {
      const archivePath = path.join(__dirname, '../../config', 'complete.list');
      if (!fs.existsSync(archivePath)) {
        console.log('No complete.list found for backfill. Skipping.');
        return;
      }

      const lines = fs
        .readFileSync(archivePath, 'utf-8')
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

      for (const id of ids) {
        const infoPath = path.join(__dirname, `../../jobs/info/${id}.info.json`);

        // Determine whether we need to backfill Videos and/or channelvideos for this id
        const needsVideo = !existingVideoIdSet.has(id);
        const needsChannelVideo = !existingChannelVideoIdSet.has(id);

        if (!needsVideo && !needsChannelVideo) {
          continue; // Already present in DB; skip to avoid stale overwrites
        }

        if (!fs.existsSync(infoPath)) {
          // Record ids missing info.json only if we needed to backfill and cannot
          missingInfoIds.push(id);
          continue; // Skip if no info.json present
        }

        let info;
        try {
          info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
        } catch (e) {
          console.error('Failed parsing info.json for', id, e.message);
          continue;
        }

        // Upsert into Videos table only if missing
        try {
          const payload = {
            youtubeId: info.id,
            youTubeChannelName: info.uploader,
            youTubeVideoName: info.title,
            duration: info.duration,
            description: info.description,
            originalDate: info.upload_date,
            channel_id: info.channel_id,
          };

          let videoInstance = await Video.findOne({ where: { youtubeId: info.id } });
          if (!videoInstance && needsVideo) {
            await Video.create(payload);
            videosUpserts += 1;
          }
        } catch (vidErr) {
          console.error('Error upserting Videos for', id, vidErr.message);
        }

        // Upsert into channelvideos table only if missing
        try {
          if (needsChannelVideo) {
            await this.upsertChannelVideoFromInfo(info, { skipUpdateIfExists: true });
            channelVideosUpserts += 1;
          }
        } catch (cvErr) {
          console.error('Error upserting channelvideos for', id, cvErr.message);
        }
      }

      console.log(
        `Backfill complete. Videos upserted: ${videosUpserts}. ChannelVideos upserted: ${channelVideosUpserts}.`
      );
      if (missingInfoIds.length > 0) {
        console.warn(
          'Backfill skipped due to missing info.json for youtube ids:',
          missingInfoIds.join(', ')
        );
      }
    } catch (err) {
      console.error('Backfill error:', err.message);
    }
  }

  // Schedule daily backfill at midnight
  scheduleDailyBackfill() {
    try {
      cron.schedule('0 0 * * *', () => {
        this.backfillFromCompleteList().catch((err) => {
          console.error('Scheduled backfill failed:', err.message);
        });
      });
      console.log('Scheduled daily backfill from complete.list');
    } catch (err) {
      console.error('Failed to schedule daily backfill:', err.message);
    }
  }

  getJob(jobId) {
    return this.jobs[jobId];
  }

  getRunningJobs() {
    // If this.jobs is undefined or null, return an empty array
    if (!this.jobs) {
      console.log('No jobs found. Returning empty array.');
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
