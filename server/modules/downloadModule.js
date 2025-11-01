const configModule = require('./configModule');
const jobModule = require('./jobModule');
const DownloadExecutor = require('./download/downloadExecutor');
const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
const tempPathManager = require('./download/tempPathManager');
const logger = require('../logger');

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
      logger.error({ err: error }, 'Error cleaning temp directory on startup');
      // Don't fail initialization, just log the error
    }
  }

  handleConfigChange(newConfig) {
    this.config = newConfig; // Update the configuration
  }

  /**
   * Safely read a property from job payloads (handles queued jobs where data is nested)
   * @param {Object} jobData - job payload (direct invocation or queued job)
   * @param {string} key - property name to resolve
   * @returns {*|undefined} resolved value if found
   */
  getJobDataValue(jobData, key) {
    if (!jobData) {
      return undefined;
    }

    if (Object.prototype.hasOwnProperty.call(jobData, key)) {
      return jobData[key];
    }

    if (jobData.data && Object.prototype.hasOwnProperty.call(jobData.data, key)) {
      return jobData.data[key];
    }

    return undefined;
  }

  /**
   * Set a property on both the job wrapper and nested data (if present)
   * @param {Object} jobData - job payload (direct invocation or queued job)
   * @param {string} key - property name to set
   * @param {*} value - value to assign
   */
  setJobDataValue(jobData, key, value) {
    if (!jobData) {
      return;
    }

    jobData[key] = value;

    if (jobData.data) {
      jobData.data[key] = value;
    }
  }

  /**
   * Resolve override settings from job payloads
   * @param {Object} jobData - job payload (direct invocation or queued job)
   * @returns {Object} override settings or empty object
   */
  getOverrideSettings(jobData) {
    const direct = this.getJobDataValue(jobData, 'overrideSettings');
    return direct && typeof direct === 'object' ? direct : {};
  }

  async doChannelDownloads(jobData = {}, isNextJob = false) {
    const overrideSettings = this.getOverrideSettings(jobData);
    const overrideResolution = overrideSettings.resolution || null;
    const channelDownloadGrouper = require('./channelDownloadGrouper');

    try {
      const groups = await channelDownloadGrouper.generateDownloadGroups(overrideResolution);

      if (!groups || groups.length === 0) {
        // No enabled channels or failed to resolve groups - fall back to single job behavior
        return await this.doSingleChannelDownloadJob(jobData, isNextJob);
      }

      const effectiveGlobalQuality =
        overrideResolution || configModule.config.preferredResolution || '1080';

      // We need grouping when:
      // - Multiple distinct groups exist (different quality or subfolders)
      // - Any group has a custom subfolder
      // - Any group has a quality that differs from the effective global quality
      const needsGrouping =
        groups.length > 1 ||
        groups.some((g) => g.subFolder !== null) ||
        groups.some((g) => g.quality !== effectiveGlobalQuality);

      if (needsGrouping) {
        console.log(`Using grouped downloads: ${groups.length} group(s) with resolved settings`);
        return await this.doGroupedChannelDownloads(jobData, groups, isNextJob);
      }

      // Single group with uniform settings – reuse the existing single-job flow but
      // ensure we pass along the resolved quality so overrides are respected.
      const singleGroup = groups[0];
      const jobDataWithQuality = {
        ...jobData,
        effectiveQuality: singleGroup?.quality || effectiveGlobalQuality,
      };
      this.setJobDataValue(jobDataWithQuality, 'effectiveQuality', jobDataWithQuality.effectiveQuality);

      return await this.doSingleChannelDownloadJob(jobDataWithQuality, isNextJob);
    } catch (err) {
      console.error('Error generating channel download groups, falling back to single job:', err);
      return await this.doSingleChannelDownloadJob(jobData, isNextJob);
    }
  }

  async doSingleChannelDownloadJob(jobData = {}, isNextJob = false) {
    const jobType = 'Channel Downloads';
    logger.info('Running channel downloads job');

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
        const overrideSettings = this.getOverrideSettings(jobData);
        const resolution =
          this.getJobDataValue(jobData, 'effectiveQuality') ||
          overrideSettings.resolution ||
          configModule.config.preferredResolution ||
          '1080';
        const videoCount = overrideSettings.videoCount || configModule.config.channelFilesToDownload;
        const allowRedownload = !!overrideSettings.allowRedownload;

        const args = YtdlpCommandBuilder.getBaseCommandArgs(resolution, allowRedownload);
        args.push('-a', tempChannelsFile);
        args.push('--playlist-end', String(videoCount));

        // Store temp file path for cleanup later
        this.downloadExecutor.tempChannelsFile = tempChannelsFile;

        this.downloadExecutor.doDownload(args, jobId, jobType);
      } catch (err) {
        logger.error({ err }, 'Error in channel downloads');
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

  async doGroupedChannelDownloads(jobData, groups, isNextJob = false) {
    console.log(`Processing ${groups.length} channel download groups in a single job`);

    // Create ONE job for all groups
    const jobType = `Channel Downloads - ${groups.length} group(s)`;
    const jobId = await jobModule.addOrUpdateJob(
      {
        jobType: jobType,
        status: '',
        output: '',
        id: jobData.id || '',
        data: { ...jobData, groups, totalGroups: groups.length },
        action: this.doChannelDownloads.bind(this),
      },
      isNextJob
    );

    if (!jobId) {
      logger.warn({ jobType }, 'Failed to create grouped channel download job');
      return;
    }

    const job = jobModule.getJob(jobId);
    if (!job || job.status !== 'In Progress') {
      logger.warn({ jobId, status: job?.status }, 'Job not in progress, skipping group downloads');
      return;
    }

    // Process each group sequentially
    for (let i = 0; i < groups.length; i++) {
      // Check if job was terminated before starting next group
      const currentJob = jobModule.getJob(jobId);
      if (!currentJob || currentJob.status === 'Terminated' || currentJob.status === 'Killed') {
        logger.info({ jobId, status: currentJob?.status }, 'Job was terminated, stopping group processing');
        return; // Exit without calling startNextJob or refreshing Plex
      }

      const group = groups[i];
      const groupDesc = `Group ${i + 1}/${groups.length} (${group.quality}p${group.subFolder ? `, ${group.subFolder}` : ''})`;
      const groupJobType = `Channel Downloads - ${groupDesc}`;

      console.log(`Processing ${groupJobType} with ${group.channels.length} channels`);

      // Update job type to show current group
      await jobModule.updateJob(jobId, {
        jobType: groupJobType,
      });

      try {
        // Execute this group's download (without starting next job)
        await this.executeGroupDownload(group, jobId, groupJobType, jobData, true);
        console.log(`Completed ${groupJobType}`);
      } catch (err) {
        logger.error({ err, group: groupDesc }, 'Error processing download group');
        await jobModule.updateJob(jobId, {
          status: 'Error',
          output: `Error in ${groupDesc}: ${err.message}`,
        });
        return; // Stop processing remaining groups on error
      }
    }

    // All groups completed successfully
    logger.info('All download groups completed, marking job as complete');

    // Mark the job as complete - this will trigger video reload from DB
    await jobModule.updateJob(jobId, {
      status: 'Complete',
    });

    // Get the updated job with all videos reloaded from database
    const completedJob = jobModule.getJob(jobId);

    if (completedJob && completedJob.data) {
      // Emit final summary WebSocket message with cumulative totals
      const MessageEmitter = require('./messageEmitter');
      const totalVideos = completedJob.data.videos?.length || 0;
      const failedVideos = completedJob.data.failedVideos || [];
      const totalSkipped = completedJob.data.cumulativeSkipped || 0;

      const finalSummary = {
        totalDownloaded: totalVideos,
        totalSkipped: totalSkipped,
        totalFailed: failedVideos.length,
        failedVideos: failedVideos,
        jobType: 'Channel Downloads - All Groups',
        completedAt: new Date().toISOString()
      };

      // Build completion message with counts
      const messageParts = [`${totalVideos} downloaded`];
      if (totalSkipped > 0) messageParts.push(`${totalSkipped} skipped`);
      if (failedVideos.length > 0) messageParts.push(`${failedVideos.length} failed`);
      const completionText = `Download completed: ${messageParts.join(', ')} across ${groups.length} groups`;

      const finalPayload = {
        text: completionText,
        progress: {
          jobId: jobId,
          state: 'complete',
          videoCount: {
            completed: totalVideos,
            total: totalVideos,
            skipped: totalSkipped
          }
        },
        finalSummary: finalSummary
      };

      MessageEmitter.emitMessage(
        'broadcast',
        null,
        'download',
        'downloadProgress',
        finalPayload
      );

      logger.info({ jobId, totalVideos, totalFailed: failedVideos.length, groupCount: groups.length },
        'Emitted final summary for multi-group download');

      // Send notification for successful multi-group download
      if (totalVideos > 0) {
        const notificationModule = require('./notificationModule');
        notificationModule.sendDownloadNotification({
          finalSummary: finalSummary,
          videoData: completedJob.data.videos || [],
          channelName: `${groups.length} groups`
        }).catch(err => {
          logger.error({ err }, 'Failed to send notification for multi-group download');
        });
      }
    }

    // Refresh Plex library once after all groups
    const plexModule = require('./plexModule');
    plexModule.refreshLibrary().catch(err => {
      logger.error({ err }, 'Failed to refresh Plex library');
    });

    // Now start the next job in the queue
    await jobModule.startNextJob();
  }

  /**
   * Execute download for a single group within a multi-group job
   * This is a helper method that doesn't create its own job
   * @param {Object} group - Group configuration (quality, subFolder, channels)
   * @param {string} jobId - The job ID to use
   * @param {string} jobType - The job type string for logging
   * @param {Object} jobData - Original job data with settings
   * @param {boolean} skipJobTransition - If true, don't refresh Plex or start next job
   * @returns {Promise} Resolves when group download completes
   */
  async executeGroupDownload(group, jobId, jobType, jobData, skipJobTransition = false) {
    let tempChannelsFile = null;
    try {
      // Generate channels file for this specific group
      const channelModule = require('./channelModule');
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      const { v4: uuidv4 } = require('uuid');

      tempChannelsFile = path.join(os.tmpdir(), `channels-group-${uuidv4()}.txt`);
      const urls = [];

      for (const channel of group.channels) {
        if (channel.channel_id) {
          const canonical = channelModule.resolveChannelUrlFromId(channel.channel_id);
          const enabledTabs = (channel.auto_download_enabled_tabs ?? '')
            .split(',')
            .map(t => t.trim())
            .filter(Boolean);

          for (const tabType of enabledTabs) {
            let tabUrl;
            switch (tabType) {
            case 'video': tabUrl = 'videos'; break;
            case 'short': tabUrl = 'shorts'; break;
            case 'livestream': tabUrl = 'streams'; break;
            default: tabUrl = 'videos';
            }
            urls.push(`${canonical}/${tabUrl}`);
          }
        }
      }

      // Check if we have any URLs to download
      if (urls.length === 0) {
        logger.warn({ jobType }, 'Skipping group - no enabled tabs for any channels in this group');
        console.log(`Skipping ${jobType} - no enabled tabs for any channels`);
        return; // Skip this group, continue with next group in sequence
      }

      await fs.writeFile(tempChannelsFile, urls.join('\n'));

      const overrideSettings = this.getOverrideSettings(jobData);
      const videoCount = overrideSettings.videoCount || configModule.config.channelFilesToDownload;
      const allowRedownload = !!overrideSettings.allowRedownload;

      // Do NOT pass subfolder to download - post-processing handles subfolder routing with __ prefix
      const args = YtdlpCommandBuilder.getBaseCommandArgs(group.quality, allowRedownload);
      args.push('-a', tempChannelsFile);
      args.push('--playlist-end', String(videoCount));

      // Store temp file path for cleanup later
      this.downloadExecutor.tempChannelsFile = tempChannelsFile;

      // Execute download with skipJobTransition flag
      await this.downloadExecutor.doDownload(args, jobId, jobType, 0, null, allowRedownload, skipJobTransition);
    } catch (err) {
      logger.error({ err, jobType }, 'Error executing group download');
      if (tempChannelsFile) {
        const fs = require('fs').promises;
        try {
          await fs.unlink(tempChannelsFile);
        } catch (unlinkErr) {
          logger.error({ err: unlinkErr }, 'Failed to cleanup temp channels file');
        }
      }
      throw err; // Re-throw to let caller handle the error
    }
  }

  async doSpecificDownloads(reqOrJobData, isNextJob = false) {
    const jobType = 'Manually Added Urls';
    const jobData = reqOrJobData.body ? reqOrJobData.body : reqOrJobData;

    logger.info({ jobData }, 'Running specific downloads job');

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
      const overrideSettings = this.getOverrideSettings(jobData);
      let effectiveQuality = overrideSettings.resolution ||
        this.getJobDataValue(jobData, 'effectiveQuality') ||
        null;

      const channelId = this.getJobDataValue(jobData, 'channelId');

      if (!effectiveQuality && channelId) {
        try {
          const Channel = require('../models/channel');
          const channelRecord = await Channel.findOne({
            where: { channel_id: channelId },
            attributes: ['video_quality'],
          });

          if (channelRecord && channelRecord.video_quality) {
            effectiveQuality = channelRecord.video_quality;
          }
        } catch (channelErr) {
          console.error('[DownloadModule] Error determining channel quality override:', channelErr.message);
        }
      }

      const resolution = effectiveQuality || configModule.config.preferredResolution || '1080';
      const allowRedownload = overrideSettings.allowRedownload || false;

      // Persist resolved quality for any subsequent retries of this job
      this.setJobDataValue(jobData, 'effectiveQuality', resolution);

      // For manual downloads, we don't apply duration filters but still exclude members-only
      // Note: Subfolder routing is now handled post-download in videoDownloadPostProcessFiles.js
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
