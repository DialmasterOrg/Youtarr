const cron = require('node-cron');
const fs = require('fs-extra');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../logger');
const configModule = require('../configModule');
const downloadModule = require('../downloadModule');
const Channel = require('../../models/channel');
const channelIdentity = require('./channelIdentity');

class AutoDownloadScheduler {
  constructor() {
    this.channelAutoDownload = this.channelAutoDownload.bind(this);
  }

  /**
   * Schedule or reschedule the automatic download task.
   * Manages cron job based on configuration settings.
   * @returns {void}
   */
  scheduleTask() {
    const frequency = configModule.getConfig().channelDownloadFrequency;
    logger.info({ frequency }, 'Scheduling channel download task');

    if (this.task) {
      logger.info('Stopping old scheduled task');
      this.task.stop();
    }

    if (configModule.getConfig().channelAutoDownload) {
      this.task = cron.schedule(
        frequency,
        this.channelAutoDownload
      );
      logger.info({ frequency }, 'Auto-downloads enabled, task scheduled');
    } else {
      logger.info('Auto-downloads disabled');
    }
  }

  /**
   * Trigger automatic channel video downloads.
   * Called by cron scheduler based on configured frequency.
   * Skips execution if a Channel Downloads job is already running to prevent queue backup.
   * @returns {Promise<void>}
   */
  async channelAutoDownload() {
    logger.info({
      currentTime: new Date(),
      interval: configModule.getConfig().channelDownloadFrequency
    }, 'Running scheduled channel downloads');

    // Check if a Channel Downloads job is already running
    const jobModule = require('../jobModule');
    const jobs = jobModule.getAllJobs();
    // Check for both In Progress and Pending channel downloads to prevent accumulation
    // Note: Pending jobs are terminated on app restart, so they won't get stuck
    const hasRunningChannelDownload = Object.values(jobs).some(
      job => job.jobType.includes('Channel Downloads') &&
             (job.status === 'In Progress' || job.status === 'Pending')
    );

    if (hasRunningChannelDownload) {
      logger.warn('Skipping scheduled channel download - previous download still in progress');
      return;
    }

    try {
      await downloadModule.doChannelAndPlaylistDownloads();
    } catch (err) {
      logger.error({ err }, 'Scheduled channel + playlist downloads failed');
    }
  }

  /**
   * Subscribe to configuration changes.
   * Reschedules tasks when configuration is updated.
   * @returns {void}
   */
  subscribe() {
    configModule.onConfigChange(this.scheduleTask.bind(this));
  }

  /**
   * Build the list of yt-dlp target URLs for all enabled channels, one per
   * enabled tab (video/short/livestream). Empty when nothing is downloadable.
   * @returns {Promise<string[]>}
   */
  async getEnabledChannelDownloadUrls() {
    const channels = await Channel.findAll({
      where: { enabled: true },
      attributes: ['channel_id', 'url', 'auto_download_enabled_tabs']
    });

    const urls = [];
    for (const channel of channels) {
      if (channel.channel_id) {
        const canonical = channelIdentity.resolveChannelUrlFromId(channel.channel_id);

        // Parse the enabled tabs for this channel (empty string means no tabs enabled)
        const enabledTabs = (channel.auto_download_enabled_tabs ?? '')
          .split(',')
          .map(t => t.trim())
          .filter(tab => tab.length > 0);

        if (enabledTabs.length === 0) {
          // All tabs disabled for this channel, skip adding URLs
          continue;
        }

        // Generate a URL for each enabled tab type
        for (const tabType of enabledTabs) {
          // auto_download_enabled_tabs stores 'video', 'short', 'livestream'
          // but we need 'videos', 'shorts', 'streams' for URLs
          let tabUrl;
          switch (tabType) {
          case 'video':
            tabUrl = 'videos';
            break;
          case 'short':
            tabUrl = 'shorts';
            break;
          case 'livestream':
            tabUrl = 'streams';
            break;
          default:
            tabUrl = 'videos'; // fallback
          }

          urls.push(`${canonical}/${tabUrl}`);
        }
      } else {
        // Fallback for channels without channel_id
        urls.push(channel.url);
      }
    }
    return urls;
  }

  /**
   * Generate a temporary file with enabled channel URLs for yt-dlp
   * Respects the auto_download_enabled_tabs column to generate URLs for each enabled tab type
   * @returns {Promise<string>} - Path to the temporary file
   */
  async generateChannelsFile() {
    const tempFilePath = path.join(os.tmpdir(), `channels-temp-${uuidv4()}.txt`);
    try {
      const urls = await this.getEnabledChannelDownloadUrls();

      if (urls.length === 0) {
        const error = new Error('No valid channel URLs to download - all enabled channels have no enabled tabs');
        logger.warn('No URLs generated for channel downloads - all enabled channels have disabled tabs');
        throw error;
      }

      await fsPromises.writeFile(tempFilePath, urls.join('\n'));

      return tempFilePath;
    } catch (err) {
      logger.error({ err }, 'Error generating channels file');
      try {
        await fsPromises.unlink(tempFilePath);
      } catch (unlinkErr) {
        // Ignore cleanup errors
      }
      throw err;
    }
  }
}

module.exports = new AutoDownloadScheduler();
