// One-time move of the legacy jobs.json file into the database.

const fs = require('fs');
const path = require('path');
const Job = require('../../models/job');
const Video = require('../../models/video');
const JobVideo = require('../../models/jobvideo');
const configModule = require('../configModule');
const logger = require('../../logger');
const jobRegistry = require('./jobRegistry');

class JobMigration {
  constructor() {
    const jobsDir = configModule.getJobsPath();
    this.jobsFilePath = path.join(jobsDir, 'jobs.json');
    this.jobsFilePathOld = path.join(jobsDir, 'jobs.json.old');
  }

  // If there is a jobs.json file, load it and migrate to the DB.
  // Returns null when there is none, otherwise a promise for the migration.
  migrateLegacyJobsFile() {
    if (!fs.existsSync(this.jobsFilePath)) return null;
    let legacyJobs;
    try {
      legacyJobs = JSON.parse(fs.readFileSync(this.jobsFilePath));
    } catch (err) {
      // The file stays in place, so this is logged again on every start until it is fixed or removed.
      logger.error({ err }, 'Could not read the legacy jobs.json; skipping its migration');
      return null;
    }
    jobRegistry.replaceAll(legacyJobs);

    return this.migrateJobsFromFile().then(() => {
      // Save the jobs.json file to jobs.json.old just in case we need it later
      fs.renameSync(this.jobsFilePath, this.jobsFilePathOld);
    });
  }

  async migrateJobsFromFile() {
    for (let jobId in jobRegistry.jobs) {
      const jobData = jobRegistry.jobs[jobId];
      if (!jobData.data) {
        continue;
      }
      const videos = jobData.data.videos ? jobData.data.videos : [];
      delete jobData.data;

      jobData.timeInitiated = new Date(jobData.timeInitiated);
      jobData.timeCreated = new Date(jobData.timeCreated);

      try {
        const jobInstance = await Job.create(jobData);

        for (let video of videos) {
          let videoInstance;
          try {
            videoInstance = await Video.create(video);
          } catch (error) {
            logger.error({ err: error }, 'Error migrating video');
          }

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
}

module.exports = new JobMigration();
