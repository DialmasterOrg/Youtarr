
const configModule = require('./configModule');
const plexModule = require('./plexModule');
const { exec } = require("child_process");
const jobModule = require('./jobModule');
const fs = require('fs');
const path = require('path');


class DownloadModule {
  constructor() {
    this.config = configModule.getConfig(); // Get the initial configuration
    configModule.on('change', this.handleConfigChange.bind(this)); // Listen for configuration changes
  }

  handleConfigChange(newConfig) {
    this.config = newConfig; // Update the configuration
  }

  startNextJob() {
    console.log("Looking for next job to start");
    const jobs = jobModule.getAllJobs();
    for (let id in jobs) {
      if (jobs[id].status === 'Pending') {
        if (jobs[id].jobType === 'Channel Downloads') {
          jobs[id].id = id;
          this.doChannelDownloads(jobs[id], true);
        } else if (jobs[id].jobType === 'Manually Added Urls') {
          jobs[id].id = id;
          this.doSpecificDownloads(jobs[id], true);
        }
        break;
      }
    }
  }

  doChannelDownloads(jobData = {}, isNextJob = false) {
    console.log('Running channel downloads');
    let jobId;
    if (!isNextJob) {
      console.log("This is NOT a 'next job', it's a primary trigger");
      // Check if there's a job with status "In Progress"
      const jobs = jobModule.getAllJobs();
      console.log('Existing jobs: ' + JSON.stringify(jobs));
      for (let id in jobs) {
        if (jobs[id].status === 'In Progress') {
          console.log('A job is already in progress. Adding this Channel Downloads job to the queue.');
          jobModule.addJob({
            jobType: 'Channel Downloads',
            status: 'Pending',
            output: '',
          });
          return;
        }
      }

      console.log('Adding job to jobs list as In Progress for Channel Downloads');
      jobId = jobModule.addJob({
        jobType: 'Channel Downloads',
        status: 'In Progress',
        output: '',
      });

    } else {
      console.log("This is a 'next job', flipping from Pending to In Progress");
      jobModule.updateJob(jobData.id, {
        status: 'In Progress',
        timeInitiated: Date.now(),
      });
      jobId = jobData.id;
    }

    const youtubeOutputDirectory = configModule.directoryPath;
    const baseCommand = `yt-dlp --ffmpeg-location /usr/bin/ffmpeg -f mp4 --write-thumbnail -a ./config/channels.list --playlist-end 3 --convert-thumbnails jpg --download-archive ./config/complete.list --ignore-errors --embed-metadata -o "${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s" -o "thumbnail:${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster" -o "pl_thumbnail:"`;

    const command = `${baseCommand}`;

    console.log('Running command: ' + command);

    const initialCount = fs.readFileSync(path.join(__dirname, '../../config', 'complete.list'), 'utf-8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .length;

    console.log('Job ID: ' + jobId);

    // Wrap the exec command in a Promise to handle timeout
    new Promise((resolve, reject) => {
      console.log('Setting timeout for ending job');
      const timer = setTimeout(() => {
        reject(new Error('Job time exceeded timeout'));
      }, 1000000); // Set your desired timeout

      console.log('Running exec to download channels');
      exec(command, { timeout: 1000000 }, (error, stdout, stderr) => {
        clearTimeout(timer);
        const finalCount = fs.readFileSync(path.join(__dirname, '../../config', 'complete.list'), 'utf-8')
        .split('\n')
        .filter(line => line.trim() !== '')
        .length;
         // Calculate the number of videos downloaded
        const videoCount = finalCount - initialCount;

        console.log('Channel downloads complete (with or without errors) for Job ID: ' + jobId);
        if (error) {
          jobModule.updateJob(jobId, {
            status: 'Error',
            output: `${videoCount} videos downloaded. Error: ${error.message}`
          });
        } else if (stderr) {
          jobModule.updateJob(jobId, {
            status: 'Complete with Warnings',
            output: `${videoCount} videos downloaded.`
          });
        } else {
          jobModule.updateJob(jobId, {
            status: 'Complete',
            output: `${videoCount} videos downloaded.`
          });
        }
        plexModule.refreshLibrary();
        // When the job is complete, start the next job in the queue
        this.startNextJob();
        resolve();
      });
    }).catch(error => {
      console.log(error.message);
      jobModule.updateJob(jobId, {
        status: 'Killed',
        output: 'Job time exceeded timeout'
      });
    });

    return jobId;
  }

  doSpecificDownloads(reqOrJobData, isNextJob = false) {
    let urls;
    let jobId;
    console.log("Running manually added url downloads");

    if (reqOrJobData.body) { // this is a req object
      urls = reqOrJobData.body.urls;

      // Check if there's a job with status "In Progress"
      const jobs = jobModule.getAllJobs();
      let inProgressJobExists = false;
      for (let id in jobs) {
        if (jobs[id].status === 'In Progress') {
          inProgressJobExists = true;
          break;
        }
      }

      if (inProgressJobExists && !isNextJob) {
        console.log('A job is already in progress. Adding this Manually Added Downloads job to the queue.');
        jobId = jobModule.addJob({
          jobType: 'Manually Added Urls',
          status: 'Pending',
          output: '',
          data: reqOrJobData.body, // Save the request body to the job
        });
        return jobId;
      } else {
        console.log('Adding job to jobs list as In Progress for Manually Added Urls');
        jobId = jobModule.addJob({
          jobType: 'Manually Added Urls',
          status: 'In Progress',
          output: '',
          data: reqOrJobData.body,
        });
      }

    } else { // this is jobData
      console.log('Flipping from Pending to In Progress for Manually Added Urls');
      urls = reqOrJobData.data.urls; // Retrieve URLs from the jobData
      jobId = reqOrJobData.id; // Retrieve jobId from the jobData
      jobModule.updateJob(jobId, {
        status: 'In Progress',
        timeInitiated: Date.now(),
      });
    }

    const youtubeOutputDirectory = configModule.directoryPath;
    const baseCommand = `yt-dlp --ffmpeg-location /usr/bin/ffmpeg -f mp4 --write-thumbnail --convert-thumbnails jpg --download-archive ./config/complete.list --ignore-errors --embed-metadata -o "${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s" -o "thumbnail:${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster" -o "pl_thumbnail:"`;

    const urlsString = urls.join(' '); // Join all URLs into a single space-separated string

    const command = `${baseCommand} ${urlsString}`;

    const initialCount = fs.readFileSync(path.join(__dirname, '../../config', 'complete.list'), 'utf-8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .length;

    exec(command, { timeout: 1000000 }, (error, stdout, stderr) => {
      console.log('Specific downloads complete (with or without errors) for Job ID: ' + jobId);
      const finalCount = fs.readFileSync(path.join(__dirname, '../../config', 'complete.list'), 'utf-8')
      .split('\n')
      .filter(line => line.trim() !== '')
      .length;
       // Calculate the number of videos downloaded
      const videoCount = finalCount - initialCount;

      if (error) {
        jobModule.updateJob(jobId, {
          status: 'Error',
          output: `${videoCount} videos downloaded. Error: ${error.message}`
        });
      } else if (stderr) {
        jobModule.updateJob(jobId, {
          status: 'Complete with Warnings',
          output: `${videoCount} videos downloaded.`
        });
      } else {
        jobModule.updateJob(jobId, {
          status: 'Complete',
          output: `${videoCount} videos downloaded.`
        });
      }
      plexModule.refreshLibrary();
      this.startNextJob();
    });

    return jobId;
  }

}

module.exports = new DownloadModule();