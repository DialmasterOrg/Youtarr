
const configModule = require('./configModule');
const plexModule = require('./plexModule');
const { exec } = require("child_process");
const { v4: uuidv4 } = require('uuid');


class DownloadModule {
  constructor() {
    this.config = configModule.getConfig(); // Get the initial configuration
    configModule.on('change', this.handleConfigChange.bind(this)); // Listen for configuration changes
  }

  handleConfigChange(newConfig) {
    this.config = newConfig; // Update the configuration
  }

  doChannelDownloads(jobs, req) {
    console.log('Triggering channel downloads');
    console.log(req.body);
    const youtubeOutputDirectory = configModule.directoryPath;
    const baseCommand = `yt-dlp --ffmpeg-location /usr/bin/ffmpeg -f mp4 --write-thumbnail -a ./config/channels.list --playlist-end 3 --convert-thumbnails jpg --download-archive ./config/complete.list --ignore-errors --embed-metadata -o "${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s" -o "thumbnail:${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster" -o "pl_thumbnail:"`;

    const command = `${baseCommand}`;

    const jobId = uuidv4(); // Generate a new UUID

    jobs[jobId] = {
      status: 'Channel Downloads In Progress',
      output: '',
      timeStarted: Date.now(),
     }; // Initialize the job


    exec(command, (error, stdout, stderr) => {
      if (error) {
        jobs[jobId].status = 'Error';
        jobs[jobId].output = error.message;
        return;
      }
      if (stderr) {
        jobs[jobId].output = stderr;
      }
      jobs[jobId].status = 'Complete';
      jobs[jobId].output = stdout;
      plexModule.refreshLibrary();
    });

    return jobId;

  }

  doSpecificDownloads(jobs, req) {
    console.log('Triggering specific downloads');
    console.log(req.body);
    const { urls } = req.body; // URLs from the request body
    const youtubeOutputDirectory = configModule.directoryPath;
    const baseCommand = `yt-dlp --ffmpeg-location /usr/bin/ffmpeg -f mp4 --write-thumbnail --convert-thumbnails jpg --download-archive ./config/complete.list --ignore-errors --embed-metadata -o "${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s" -o "thumbnail:${youtubeOutputDirectory}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster" -o "pl_thumbnail:"`;

    const urlsString = urls.join(' '); // Join all URLs into a single space-separated string

    const command = `${baseCommand} ${urlsString}`;

    const jobId = uuidv4(); // Generate a new UUID

    jobs[jobId] = {
      status: 'Specific Downloads In progress',
      output: '',
      urls: urls,
      timeStarted: Date.now(),
     }; // Initialize the job


    exec(command, (error, stdout, stderr) => {
      if (error) {
        jobs[jobId].status = 'Error';
        jobs[jobId].output = error.message;
        return;
      }
      if (stderr) {
        jobs[jobId].output = stderr;
      }
      jobs[jobId].status = 'Complete';
      jobs[jobId].output = stdout;
      plexModule.refreshLibrary();
    });

    return jobId;
  }

}

module.exports = new DownloadModule();