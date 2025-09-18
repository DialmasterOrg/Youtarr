const configModule = require('./configModule');
const plexModule = require('./plexModule');
const jobModule = require('./jobModule');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process'); // import spawn
const MessageEmitter = require('./messageEmitter.js'); // import the helper function

class DownloadModule {
  constructor() {
    this.config = configModule.getConfig(); // Get the initial configuration
    configModule.on('change', this.handleConfigChange.bind(this)); // Listen for configuration changes
  }

  handleConfigChange(newConfig) {
    this.config = newConfig; // Update the configuration
  }

  getCountOfDownloadedVideos() {
    const archive = require('./archiveModule');
    return archive.readCompleteListLines().length;
  }

  getNewVideoUrls(initialCount) {
    const archive = require('./archiveModule');
    return archive.getNewVideoUrlsSince(initialCount);
  }

  doDownload(args, jobId, jobType) {
    const initialCount = this.getCountOfDownloadedVideos();

    new Promise((resolve, reject) => {
      console.log('Setting timeout for ending job');
      const timer = setTimeout(() => {
        reject(new Error('Job time exceeded timeout'));
      }, 1000000); // Set your desired timeout

      console.log(`Running yt-dlp for ${jobType}`);
      console.log('Command args:', args);
      const proc = spawn('yt-dlp', args, { timeout: 1000000, shell: false });

      proc.stdout.on('data', (data) => {
        console.log(data.toString()); // log the data in real-time

        let line = data.toString();
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          { text: line }
        );
      });

      let stderrData = '';
      proc.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.log(data.toString()); // log the data in real-time
        // Here you can parse data and update the job as it runs
      });

      proc.on('exit', (code) => {
        clearTimeout(timer);
        const newVideoUrls = this.getNewVideoUrls(initialCount);
        const videoCount = newVideoUrls.length;

        let videoData = newVideoUrls
          .map((url) => {
            let id = url.split('youtu.be/')[1].trim();
            let dataPath = path.join(
              __dirname,
              `../../jobs/info/${id}.info.json`
            );
            console.log('Looking for info.json file at', dataPath);

            if (fs.existsSync(dataPath)) {
              console.log('Found info.json file at', dataPath);
              let data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
              return {
                youtubeId: data.id,
                youTubeChannelName: data.uploader,
                youTubeVideoName: data.title,
                duration: data.duration,
                description: data.description,
                originalDate: data.upload_date,
                channel_id: data.channel_id,
              };
            } else {
              console.log('No info.json file at', dataPath);
            }
            return null; // If for some reason .info.json file is not found, return null
          })
          .filter((data) => data !== null); // Filter out any null values

        console.log(
          `${jobType} complete (with or without errors) for Job ID: ${jobId}`
        );

        let status = '';
        let output = '';

        if (code !== 0) {
          status = 'Error';
          output = `${videoCount} videos. Error: Command exited with code ${code}`;
        } else if (stderrData) {
          status = 'Complete with Warnings';
          output = `${videoCount} videos.`;
        } else {
          status = 'Complete';
          output = `${videoCount} videos.`;
        }

        jobModule.updateJob(jobId, {
          status: status,
          output: output,
          data: { videos: videoData },
        });

        // Clean up temporary channels file if it exists
        if (this.tempChannelsFile) {
          const fs = require('fs').promises;
          fs.unlink(this.tempChannelsFile)
            .then(() => {
              console.log('Cleaned up temporary channels file');
              this.tempChannelsFile = null;
            })
            .catch((err) => {
              console.log('Failed to clean up temp channels file:', err.message);
            });
        }

        plexModule.refreshLibrary().catch(err => {
          console.log('Failed to refresh Plex library:', err.message);
        });
        jobModule.startNextJob();
      });
    }).catch((error) => {
      console.log(error.message);

      // Clean up temporary channels file on error
      if (this.tempChannelsFile) {
        const fs = require('fs').promises;
        fs.unlink(this.tempChannelsFile)
          .catch((err) => {
            console.log('Failed to clean up temp channels file:', err.message);
          });
        this.tempChannelsFile = null;
      }

      jobModule.updateJob(jobId, {
        status: 'Killed',
        output: 'Job time exceeded timeout',
      });
    });
  }

  async doChannelDownloads(jobData = {}, isNextJob = false) {
    const jobType = 'Channel Downloads';
    console.log(`Running ${jobType}`);

    const jobId = await jobModule.addOrUpdateJob(
      {
        jobType: jobType,
        status: '',
        output: '',
        id: jobData.id ? jobData.id : '',
        data: jobData,
        action: this.doChannelDownloads.bind(this),
      },
      isNextJob
    );

    if (jobModule.getJob(jobId).status === 'In Progress') {
      let tempChannelsFile = null;
      try {
        // Generate temporary channels file from database
        const channelModule = require('./channelModule');
        tempChannelsFile = await channelModule.generateChannelsFile();

        // Use override settings if provided, otherwise use defaults
        const overrideSettings = jobData.overrideSettings || {};
        const resolution = overrideSettings.resolution || configModule.config.preferredResolution || '1080';
        const videoCount = overrideSettings.videoCount || configModule.config.channelFilesToDownload;

        const args = this.getBaseCommandArgs(resolution);
        args.push('-a', tempChannelsFile);
        args.push('--playlist-end', String(videoCount));

        // Store temp file path for cleanup later
        this.tempChannelsFile = tempChannelsFile;

        this.doDownload(args, jobId, jobType);
      } catch (err) {
        console.error('Error in doChannelDownloads:', err);
        if (tempChannelsFile) {
          // Clean up temp file on error
          const fs = require('fs').promises;
          try {
            await fs.unlink(tempChannelsFile);
          } catch (unlinkErr) {
            // Ignore cleanup errors
          }
        }
        await jobModule.updateJob(jobId, {
          status: 'Failed',
          output: `Error: ${err.message}`,
        });
      }
    }
  }

  async doSpecificDownloads(reqOrJobData, isNextJob = false) {
    const jobType = 'Manually Added Urls';
    const jobData = reqOrJobData.body ? reqOrJobData.body : reqOrJobData;

    console.log(
      'Running doSpecificDownloads and jobData: ',
      JSON.stringify(jobData)
    );

    const urls = reqOrJobData.body
      ? reqOrJobData.body.urls
      : reqOrJobData.data.urls;
    const jobId = await jobModule.addOrUpdateJob(
      {
        jobType: jobType,
        status: '',
        output: '',
        id: jobData.id ? jobData.id : '',
        data: jobData,
        action: this.doSpecificDownloads.bind(this),
      },
      isNextJob
    );

    if (jobModule.getJob(jobId).status === 'In Progress') {
      // Use override settings if provided, otherwise use defaults
      const overrideSettings = jobData.overrideSettings || {};
      const resolution = overrideSettings.resolution || configModule.config.preferredResolution || '1080';

      // For manual downloads, we don't apply duration filters but still exclude members-only
      const args = this.getBaseCommandArgsForManualDownload(resolution);

      // Add URLs to args array
      urls.forEach((url) => {
        if (url.startsWith('-')) {
          args.push('--', url);
        } else {
          args.push(url);
        }
      });

      this.doDownload(args, jobId, jobType);
    }
  }

  // Build Sponsorblock args based on configuration
  buildSponsorblockArgs(config) {
    const args = [];

    if (!config.sponsorblockEnabled) return args;

    // Build categories list from enabled categories
    const enabledCategories = Object.entries(config.sponsorblockCategories || {})
      .filter(([, enabled]) => enabled)
      .map(([category]) => category);

    if (enabledCategories.length > 0) {
      const categoriesStr = enabledCategories.join(',');

      if (config.sponsorblockAction === 'remove') {
        args.push('--sponsorblock-remove', categoriesStr);
      } else if (config.sponsorblockAction === 'mark') {
        args.push('--sponsorblock-mark', categoriesStr);
      }
    }

    // Add custom API URL if specified
    if (config.sponsorblockApiUrl && config.sponsorblockApiUrl.trim()) {
      args.push('--sponsorblock-api', config.sponsorblockApiUrl.trim());
    }

    return args;
  }

  // Build yt-dlp command args array for channel downloads
  getBaseCommandArgs(resolution) {
    const res = resolution || configModule.config.preferredResolution || '1080';
    const args = [
      '-4',
      '--ffmpeg-location', configModule.ffmpegPath,
      '-f', `bestvideo[height<=${res}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`,
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--download-archive', './config/complete.list',
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', 'duration>70 & availability!=subscriber_only',
      '-o', `${configModule.directoryPath}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s`,
      '--datebefore', 'now',
      '-o', `thumbnail:${configModule.directoryPath}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster`,
      '-o', 'pl_thumbnail:',
      '--exec', `node ${path.resolve(__dirname, './videoDownloadPostProcessFiles.js')} {}`
    ];

    // Add Sponsorblock args if configured
    const sponsorblockArgs = this.buildSponsorblockArgs(configModule.config);
    args.push(...sponsorblockArgs);

    return args;
  }

  // Build yt-dlp command args array for manual downloads - no duration filter
  getBaseCommandArgsForManualDownload(resolution) {
    const res = resolution || configModule.config.preferredResolution || '1080';
    const args = [
      '-4',
      '--ffmpeg-location', configModule.ffmpegPath,
      '-f', `bestvideo[height<=${res}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`,
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--download-archive', './config/complete.list',
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', 'availability!=subscriber_only',
      '-o', `${configModule.directoryPath}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/%(uploader)s - %(title)s  [%(id)s].%(ext)s`,
      '--datebefore', 'now',
      '-o', `thumbnail:${configModule.directoryPath}/%(uploader)s/%(uploader)s - %(title)s - %(id)s/poster`,
      '-o', 'pl_thumbnail:',
      '--exec', `node ${path.resolve(__dirname, './videoDownloadPostProcessFiles.js')} {}`
    ];

    // Add Sponsorblock args if configured
    const sponsorblockArgs = this.buildSponsorblockArgs(configModule.config);
    args.push(...sponsorblockArgs);

    return args;
  }
}

module.exports = new DownloadModule();
