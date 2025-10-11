const configModule = require('./configModule');
const jobModule = require('./jobModule');
const DownloadExecutor = require('./download/downloadExecutor');
const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
const tempPathManager = require('./download/tempPathManager');

class DownloadModule {
  constructor() {
    this.config = configModule.getConfig(); // Get the initial configuration
    this.downloadExecutor = new DownloadExecutor();
    configModule.on('change', this.handleConfigChange.bind(this)); // Listen for configuration changes

    // Clean temp directory on startup if temp downloads are enabled
    this.initializeTempDirectory();
  }

  async initializeTempDirectory() {
    try {
      await tempPathManager.cleanTempDirectory();
    } catch (error) {
      console.error('[DownloadModule] Error cleaning temp directory on startup:', error.message);
      // Don't fail initialization, just log the error
    }
  }

  handleConfigChange(newConfig) {
    this.config = newConfig; // Update the configuration
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

        const args = YtdlpCommandBuilder.getBaseCommandArgs(resolution);
        args.push('-a', tempChannelsFile);
        args.push('--playlist-end', String(videoCount));

        // Store temp file path for cleanup later
        this.downloadExecutor.tempChannelsFile = tempChannelsFile;

        this.downloadExecutor.doDownload(args, jobId, jobType);
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
      const allowRedownload = overrideSettings.allowRedownload || false;

      // For manual downloads, we don't apply duration filters but still exclude members-only
      const args = YtdlpCommandBuilder.getBaseCommandArgsForManualDownload(resolution, allowRedownload);

      // Add URLs to args array
      urls.forEach((url) => {
        if (url.startsWith('-')) {
          args.push('--', url);
        } else {
          args.push(url);
        }
      });

      // Pass URL count, URLs, and allowRedownload flag as additional parameters for manual downloads
      this.downloadExecutor.doDownload(args, jobId, jobType, urls.length, urls, allowRedownload);
    }
  }

  terminateCurrentDownload() {
    const terminatedJobId = this.downloadExecutor.terminateCurrentJob('User requested termination');
    return terminatedJobId;
  }
}

module.exports = new DownloadModule();