const scheduledTasks = require('../scheduledTaskManager');
const { getSchedule } = require('../scheduleConfig');
const fs = require('fs-extra');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../logger');
const configModule = require('../configModule');
const downloadModule = require('../downloadModule');
const storageGuard = require('../storageGuard');
const Channel = require('../../models/channel');
const channelIdentity = require('./channelIdentity');

const ACTIVE_JOB_STATUSES = new Set(['In Progress', 'Pending']);

class AutoDownloadScheduler {
  constructor() {
    this.channelAutoDownload = this.channelAutoDownload.bind(this);
    this.runTracker = null;
    this.sweepRunIds = new Set();
  }

  /**
   * The download run tracker, injected by server.js so the tracker's
   * jobModule dependency stays out of this module's load graph and tests
   * control the instance.
   * @param {{ isActive: Function, getUnfinishedJobs: Function }} tracker
   */
  setRunTracker(tracker) {
    this.runTracker = tracker;
  }

  /**
   * Statuses of every job still working for a download sweep: the unfinished
   * jobs of tracked sweeps (channel, playlist and automatic-retry jobs share
   * the sweep's runId) plus any Channel Downloads job queued or running.
   * @returns {string[]}
   */
  getActiveSweepJobStatuses() {
    const jobModule = require('../jobModule');
    const active = new Map();
    for (const [id, job] of Object.entries(jobModule.getAllJobs())) {
      if (job.jobType.includes('Channel Downloads') && ACTIVE_JOB_STATUSES.has(job.status)) {
        active.set(id, job.status);
      }
    }
    if (this.runTracker) {
      for (const runId of [...this.sweepRunIds]) {
        if (!this.runTracker.isActive(runId)) {
          this.sweepRunIds.delete(runId);
          continue;
        }
        // A job left 'Failed' never reports to its run, so only queued or
        // running jobs count; otherwise it would hold the sweep open for weeks.
        for (const job of this.runTracker.getUnfinishedJobs(runId)) {
          if (ACTIVE_JOB_STATUSES.has(job.status)) active.set(job.id, job.status);
        }
      }
    }
    return [...active.values()];
  }

  hasActiveSweep() {
    return this.getActiveSweepJobStatuses().length > 0;
  }

  // A storage pause holds jobs Pending; those report as paused, not running.
  isChannelDownloadRunning() {
    const statuses = this.getActiveSweepJobStatuses();
    if (statuses.length === 0) return false;
    if (!storageGuard.getStatus().paused) return true;
    return statuses.includes('In Progress');
  }

  // Status polls use the cached pause state; starting a run re-measures.
  async getRunBlocker({ fresh = false } = {}) {
    let status = storageGuard.getStatus();
    if (fresh) {
      try {
        status = await storageGuard.refresh();
      } catch (err) {
        logger.warn({ err }, 'Could not check the download pause state before channel downloads');
        return null;
      }
    }
    return status.paused ? { reason: 'downloads-paused', message: storageGuard.describe(status) } : null;
  }

  /**
   * Schedule or reschedule the automatic download task.
   * Manages cron job based on configuration settings.
   * @returns {void}
   */
  scheduleTask() {
    const config = configModule.getConfig();
    scheduledTasks.updateTask({
      id: 'channelDownloadFrequency',
      expression: getSchedule(config, 'channelDownloadFrequency'),
      enabled: Boolean(config.channelAutoDownload),
      run: this.channelAutoDownload,
      isRunning: () => this.isChannelDownloadRunning(),
      getRunBlocker: (options) => this.getRunBlocker(options),
      // No manual-run cooldown: automatic downloads are refused only while a
      // sweep is running, the same as Download new always has been.
      // The automatic downloads switch only stops the timer: a manual sweep
      // works while it is off, as Download new always has.
      manualRunRequiresEnabled: false,
    });
  }

  /**
   * Trigger automatic channel video downloads.
   * Called by the scheduler on its timer, and by Run now / Download new.
   * Skips execution while a previous sweep still has jobs to prevent queue backup.
   * @param {object} [options]
   * @param {string} [options.trigger='scheduled']
   * @param {object} [options.jobData={}] - override settings payload for the sweep
   * @returns {Promise<object>} the run record
   */
  async channelAutoDownload({ trigger = 'scheduled', jobData = {} } = {}) {
    logger.info({
      trigger,
      currentTime: new Date(),
      interval: configModule.getConfig().channelDownloadFrequency
    }, 'Running channel downloads');

    // Checked first: jobs held by a storage pause stay Pending, and the
    // "still running" skip below would otherwise hide the real reason.
    const pauseStatus = await storageGuard.refresh();
    if (pauseStatus.paused) {
      const message = storageGuard.describe(pauseStatus);
      logger.warn({ reasons: pauseStatus.reasons.map((r) => r.text) }, 'Skipping scheduled channel download - downloads are paused');
      return { status: 'skipped', outcome: 'skipped', message };
    }

    // Pending counts too, so queued sweeps don't accumulate. Pending jobs are
    // terminated on app restart, so they won't get stuck.
    if (this.hasActiveSweep()) {
      logger.warn('Skipping scheduled channel download - previous download still in progress');
      return {
        status: 'skipped',
        outcome: 'skipped',
        message: 'The previous channel and playlist update is still running.',
      };
    }

    try {
      const result = await downloadModule.doChannelAndPlaylistDownloads(jobData);
      if (result && result.playlistError) {
        return {
          status: 'error',
          outcome: 'partial',
          message: `Channel downloads were queued, but the playlist sweep failed: ${result.playlistError}`,
        };
      }
      if (result && result.playlistsFailed > 0) {
        return {
          status: 'error',
          outcome: 'partial',
          message: `Channel downloads were queued, but ${result.playlistsFailed} of ${result.playlistsChecked} playlists failed to sweep.`,
        };
      }
      if (result && result.playlistsPausedReason) {
        return {
          status: 'success',
          outcome: 'completed',
          message: `Channel downloads were queued; playlist downloads were skipped. ${result.playlistsPausedReason}`,
        };
      }
      return {
        status: 'success',
        outcome: 'completed',
        message: 'Checked enabled channels and playlists for new videos.',
      };
    } catch (err) {
      logger.error({ err }, 'Channel + playlist downloads failed');
      return { status: 'error', outcome: 'error', message: err.message || 'Unknown error' };
    } finally {
      // doChannelAndPlaylistDownloads stamps its run id on jobData; tracking it
      // keeps "running" true until the sweep's last job (retries included) ends.
      const runId = downloadModule.getJobDataValue(jobData, 'runId');
      if (runId) this.sweepRunIds.add(runId);
    }
  }

  /**
   * Subscribe to configuration changes.
   * Reschedules tasks when configuration is updated.
   * @returns {void}
   */
  subscribe() {
    if (this.subscribed) return;
    configModule.onConfigChange(this.scheduleTask.bind(this));
    this.subscribed = true;
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
