
const configModule = require('./configModule');
const plexModule = require('./plexModule');
const { exec } = require("child_process");
const jobModule = require('./jobModule');

class DownloadModule {
  constructor() {
    this.config = configModule.getConfig(); // Get the initial configuration
    configModule.on('change', this.handleConfigChange.bind(this)); // Listen for configuration changes
  }

  handleConfigChange(newConfig) {
    this.config = newConfig; // Update the configuration
  }

  doChannelDownloads() {
    console.log('Triggering channel downloads');
    const youtubeOutputDirectory = configModule.directoryPath;
    const baseCommand = `yt-dlp --ffmpeg-location /usr/bin/ffmpeg -f mp4 --write-thumbnail -a ./config/channels.list --playlist-end 3 --convert-thumbnails jpg --download-archive ./config/complete.list --ignore-errors --embed-metadata -o "${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s" -o "thumbnail:${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster" -o "pl_thumbnail:"`;

    const command = `${baseCommand}`;

    console.log('Running command: ' + command);

    // Check if there's a job of type "Channel Downloads" and status "In Progress"
    const jobs = jobModule.getAllJobs();
    for (let id in jobs) {
      if (jobs[id].jobType === 'Channel Downloads' && jobs[id].status === 'In Progress') {
        console.log('Channel download is already in progress. Please wait for it to finish before starting a new one.');
        return;
      }
    }

    console.log('Adding job to jobs list for Channel Downloads');
    let jobId = jobModule.addJob({
      jobType: 'Channel Downloads',
      status: 'In Progress',
      output: '',
    });

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

        console.log('Channel downloads complete (with or without errors) for Job ID: ' + jobId);
        if (error) {
          jobModule.updateJob(jobId, {
            status: 'Error',
            output: error.message
          });
        } else if (stderr) {
          jobModule.updateJob(jobId, {
            status: 'Complete with Warnings',
            output: stderr
          });
        } else {
          jobModule.updateJob(jobId, {
            status: 'Complete',
            output: stdout
          });
        }
        plexModule.refreshLibrary();
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

  doSpecificDownloads(req) {
    console.log('Triggering specific downloads');
    console.log(req.body);
    const { urls } = req.body; // URLs from the request body
    const youtubeOutputDirectory = configModule.directoryPath;
    const baseCommand = `yt-dlp --ffmpeg-location /usr/bin/ffmpeg -f mp4 --write-thumbnail --convert-thumbnails jpg --download-archive ./config/complete.list --ignore-errors --embed-metadata -o "${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s" -o "thumbnail:${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster" -o "pl_thumbnail:"`;

    const urlsString = urls.join(' '); // Join all URLs into a single space-separated string

    const command = `${baseCommand} ${urlsString}`;

    let jobId = jobModule.addJob({
      jobType: 'Manually Added Urls',
      status: 'In progress',
      output: '',
      urls: urls,
    });


    exec(command, { timeout: 1000000 }, (error, stdout, stderr) => {
      console.log('Specific downloads complete (with or without errors) for Job ID: ' + jobId);
      if (error) {
        jobModule.updateJob(jobId, {
          status: 'Error',
          output: error.message
        });
      } else if (stderr) {
        jobModule.updateJob(jobId, {
          status: 'Complete with Warnings',
          output: stderr
        });
      } else {
        jobModule.updateJob(jobId, {
          status: 'Complete',
          output: stdout
        });
      }
      plexModule.refreshLibrary();
    });

    return jobId;
  }

}

module.exports = new DownloadModule();