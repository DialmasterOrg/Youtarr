const configModule = require("./configModule");
const plexModule = require("./plexModule");
const { exec } = require("child_process");
const jobModule = require("./jobModule");
const fs = require("fs");
const path = require("path");

class DownloadModule {
  constructor() {
    this.config = configModule.getConfig(); // Get the initial configuration
    configModule.on("change", this.handleConfigChange.bind(this)); // Listen for configuration changes
    // Start processing the next job in the queue, if any, this may happen if the app was shut down
    jobModule.startNextJob();
  }

  handleConfigChange(newConfig) {
    this.config = newConfig; // Update the configuration
  }

  getCountOfDownloadedVideos() {
    const lines = fs
      .readFileSync(
        path.join(__dirname, "../../config", "complete.list"),
        "utf-8"
      )
      .split("\n")
      .filter((line) => line.trim() !== "");
    return lines.length;
  }

  getNewVideoUrls(initialCount) {
    const lines = fs
      .readFileSync(
        path.join(__dirname, "../../config", "complete.list"),
        "utf-8"
      )
      .split("\n")
      .filter((line) => line.trim() !== "");
    const newVideoIds = lines
      .slice(initialCount)
      .map((line) => line.split(" ")[1]);

    return newVideoIds.map((id) => `https://youtu.be/${id}`);
  }

  doDownload(command, jobId, jobType) {
    const initialCount = this.getCountOfDownloadedVideos();

    // Wrap the exec command in a Promise to handle timeout
    new Promise((resolve, reject) => {
      console.log("Setting timeout for ending job");
      const timer = setTimeout(() => {
        reject(new Error("Job time exceeded timeout"));
      }, 1000000); // Set your desired timeout

      console.log(`Running exec for ${jobType}`);
      exec(command, { timeout: 1000000 }, (error, stdout, stderr) => {
        clearTimeout(timer);
        const newVideoUrls = this.getNewVideoUrls(initialCount);
        const videoCount = newVideoUrls.length;

        console.log(
          `${jobType} complete (with or without errors) for Job ID: ${jobId}`
        );
        if (error) {
          jobModule.updateJob(jobId, {
            status: "Error",
            output: `${videoCount} videos downloaded. Error: ${error.message}`,
            data: { urls: newVideoUrls },
          });
        } else if (stderr) {
          jobModule.updateJob(jobId, {
            status: "Complete with Warnings",
            output: `${videoCount} videos downloaded.`,
            data: { urls: newVideoUrls },
          });
        } else {
          jobModule.updateJob(jobId, {
            status: "Complete",
            output: `${videoCount} videos downloaded.`,
            data: { urls: newVideoUrls },
          });
        }
        plexModule.refreshLibrary();
        // When the job is complete, start the next job in the queue
        jobModule.startNextJob();
        resolve();
      });
    }).catch((error) => {
      console.log(error.message);
      jobModule.updateJob(jobId, {
        status: "Killed",
        output: "Job time exceeded timeout",
      });
    });
  }

  doChannelDownloads(jobData = {}, isNextJob = false) {
    const jobType = "Channel Downloads";
    console.log(`Running ${jobType}`);

    const jobId = jobModule.addOrUpdateJob({
      jobType: jobType,
      status: "",
      output: "",
      id: jobData.id ? jobData.id : "",
      action: this.doChannelDownloads.bind(this),
    }, isNextJob);


    if (jobModule.getJob(jobId).status === "In Progress") {
      const baseCommand = `yt-dlp --ffmpeg-location ${configModule.ffmpegPath} -f mp4 --write-thumbnail -a ./config/channels.list ` +
        `--playlist-end 3 --convert-thumbnails jpg --download-archive ./config/complete.list --ignore-errors --embed-metadata ` +
        `-o "${configModule.directoryPath}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s" ` +
        `-o "thumbnail:${configModule.directoryPath}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster" -o "pl_thumbnail:"`;
      const command = `${baseCommand}`;
      this.doDownload(command, jobId, jobType);
    }
    return jobId;
  }

  doSpecificDownloads(reqOrJobData, isNextJob = false) {
    const jobType = "Manually Added Urls";
    const jobData = reqOrJobData.body ? reqOrJobData.body : reqOrJobData;

    console.log('Running doSpecificDownloads and jobData: ', JSON.stringify(jobData));

    const urls = reqOrJobData.body ? reqOrJobData.body.urls : reqOrJobData.data.urls;
    const jobId = jobModule.addOrUpdateJob({
      jobType: jobType,
      status: "",
      output: "",
      id: jobData.id ? jobData.id : "",
      data: jobData,
      action: this.doSpecificDownloads.bind(this)
    }, isNextJob);

    if (jobModule.getJob(jobId).status === "In Progress") {
      const baseCommand = `yt-dlp --ffmpeg-location ${configModule.ffmpegPath} -f mp4 --write-thumbnail --convert-thumbnails jpg ` +
      `--download-archive ./config/complete.list --ignore-errors --embed-metadata ` +
      `-o "${configModule.directoryPath}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s" ` +
      `-o "thumbnail:${configModule.directoryPath}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster" -o "pl_thumbnail:"`;

      const urlsString = urls.join(" "); // Join all URLs into a single space-separated string

      const command = `${baseCommand} ${urlsString}`;
      this.doDownload(command, jobId, jobType);
    }
    return jobId;
  }
}

module.exports = new DownloadModule();
