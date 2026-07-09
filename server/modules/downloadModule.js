const configModule = require('./configModule');
const jobModule = require('./jobModule');
const plexModule = require('./plexModule');
const DownloadExecutor = require('./download/downloadExecutor');
const YtdlpCommandBuilder = require('./download/ytdlpCommandBuilder');
const tempPathManager = require('./download/tempPathManager');
const { MANUAL_DOWNLOAD_LABEL, playlistJobLabel, autoRetryJobLabel } = require('./download/jobTypes');
const ChannelVideo = require('../models/channelvideo');
const logger = require('../logger');

const DEFAULT_FILES_TO_DOWNLOAD = 5;

class DownloadModule {
  constructor() {
    this.config = configModule.getConfig(); // Get the initial configuration
    this.downloadExecutor = new DownloadExecutor({
      enqueueAutoRetry: (payload) => this.enqueueAutoRetryJob(payload),
    });
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

  /**
   * Associate a freshly-created job with its download run (if any) so the run
   * can aggregate a single summary across all its jobs. No-op when the job is
   * not part of a run (e.g. a standalone manual download).
   * @param {Object} jobData - job payload that may carry a runId
   * @param {string} jobId - id returned from jobModule.addOrUpdateJob
   */
  registerJobWithRun(jobData, jobId) {
    const runId = this.getJobDataValue(jobData, 'runId');
    if (!runId || !jobId) return;
    const downloadRunTracker = require('./download/downloadRunTracker');
    downloadRunTracker.registerJob(runId, jobId);
  }

  /**
   * Enqueue a follow-up URL-list job for videos that failed with a transient
   * HTTP 403. Owning channels are resolved so channel-tier settings (quality,
   * audio format, subfolder routing) apply on the retry; the source job's
   * overrideSettings carry dialog-picked options through for manual and
   * playlist downloads.
   * @param {Object} params
   * @param {Array<{youtubeId: string, url: string}>} params.retryVideos
   * @param {number} params.autoRetryAttempt - attempt number stamped on the retry job
   * @param {string|null} params.runId - active run to fold the retry outcome into
   * @param {Object} params.sourceJobData - the failing job's data payload
   */
  async enqueueAutoRetryJob({ retryVideos, autoRetryAttempt, runId, sourceJobData = {} }) {
    if (!Array.isArray(retryVideos) || retryVideos.length === 0) return;

    const ownerChannelMap = { ...(this.getJobDataValue(sourceJobData, 'ownerChannelMap') || {}) };
    const unmappedIds = retryVideos
      .map((video) => video.youtubeId)
      .filter((id) => id && !ownerChannelMap[id]);
    if (unmappedIds.length > 0) {
      try {
        const rows = await ChannelVideo.findAll({
          where: { youtube_id: unmappedIds },
          attributes: ['youtube_id', 'channel_id'],
        });
        for (const row of rows) {
          if (row.channel_id) ownerChannelMap[row.youtube_id] = row.channel_id;
        }
      } catch (err) {
        logger.warn({ err }, 'Could not resolve owning channels for auto-retry; falling back to global settings');
      }
    }

    // A single owning channel lets doSpecificDownloads resolve channel-tier
    // quality/audio/skip-video-folder; with mixed channels those fall back to
    // the copied override or global settings (subfolder routing still resolves
    // per video via ownerChannelMap in post-processing).
    const mappedChannelIds = new Set(
      retryVideos.map((video) => ownerChannelMap[video.youtubeId]).filter(Boolean)
    );
    const channelId = this.getJobDataValue(sourceJobData, 'channelId')
      || (mappedChannelIds.size === 1 ? [...mappedChannelIds][0] : null);
    const effectiveQuality = this.getJobDataValue(sourceJobData, 'effectiveQuality') || null;

    const body = {
      urls: retryVideos.map((video) => video.url),
      overrideSettings: { ...this.getOverrideSettings(sourceJobData) },
      jobLabel: autoRetryJobLabel(retryVideos.length),
      autoRetryAttempt,
    };
    if (Object.keys(ownerChannelMap).length > 0) body.ownerChannelMap = ownerChannelMap;
    if (channelId) body.channelId = channelId;
    if (effectiveQuality) body.effectiveQuality = effectiveQuality;
    if (runId) body.runId = runId;

    logger.info(
      { videoCount: retryVideos.length, autoRetryAttempt, channelId, runId },
      'Enqueueing auto-retry job for transient 403 failures'
    );
    await this.doSpecificDownloads({ body });
  }

  async doChannelDownloads(jobData = {}, isNextJob = false) {
    const overrideSettings = this.getOverrideSettings(jobData);
    const overrideResolution = overrideSettings.resolution || null;
    const channelDownloadGrouper = require('./channelDownloadGrouper');

    // Fresh invocations (cron tick / manual "run now") skip gracefully when no
    // enabled channel has any auto-download tab: creating a job that can only
    // fail pollutes Download History and logs a misleading ERROR every cycle
    // on playlist-only setups. Queued jobs (isNextJob / jobData.id set)
    // keep the existing create-then-fail path so startNextJob never loops on a
    // Pending job whose action returned without touching it.
    if (!isNextJob && !jobData?.id) {
      try {
        const channelModule = require('./channelModule');
        const channelUrls = await channelModule.getEnabledChannelDownloadUrls();
        if (channelUrls.length === 0) {
          logger.info('No enabled channels with enabled tabs; skipping channel downloads');
          return;
        }
      } catch (err) {
        logger.warn({ err }, 'Channel URL pre-check failed; continuing with normal job creation');
      }
    }

    try {
      const groups = await channelDownloadGrouper.generateDownloadGroups(overrideResolution);

      if (!groups || groups.length === 0) {
        // No enabled channels or failed to resolve groups - fall back to single job behavior
        return await this.doSingleChannelDownloadJob(jobData, isNextJob);
      }

      const effectiveGlobalQuality =
        overrideResolution || configModule.config.preferredResolution || '1080';

      // We need grouping when:
      // - Multiple distinct groups exist (different quality or subfolders or filters)
      // - Any group has a custom subfolder
      // - Any group has a quality that differs from the effective global quality
      // - Any group has download filters (duration or title regex)
      const needsGrouping =
        groups.length > 1 ||
        groups.some((g) => g.subFolder !== null) ||
        groups.some((g) => g.quality !== effectiveGlobalQuality) ||
        groups.some((g) => g.filterConfig && g.filterConfig.hasGroupingCriteria && g.filterConfig.hasGroupingCriteria());

      if (needsGrouping) {
        logger.info({ groupCount: groups.length }, 'Using grouped downloads with resolved settings');
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

  /**
   * Trigger channel downloads, then enqueue auto-download for every enabled
   * playlist so playlist downloads always queue behind channel downloads.
   * Ungrouped channel downloads return after spawning yt-dlp (not on completion),
   * so the playlist YouTube refresh can overlap an active channel download; the
   * job queue still serializes the actual downloads. Manual override settings
   * (resolution, videoCount, allowRedownload) carry through to playlists too.
   * @param {Object} jobData - optional override settings payload
   * @returns {Promise<void>}
   */
  async doChannelAndPlaylistDownloads(jobData = {}) {
    const downloadRunTracker = require('./download/downloadRunTracker');
    const runId = downloadRunTracker.startRun();
    this.setJobDataValue(jobData, 'runId', runId);

    try {
      await this.doChannelDownloads(jobData);
      try {
        const playlistModule = require('./playlistModule');
        const overrideSettings = this.getOverrideSettings(jobData);
        await playlistModule.playlistAutoDownload(overrideSettings, runId);
      } catch (err) {
        logger.error({ err }, 'playlistAutoDownload failed after channel downloads');
      }
    } finally {
      // Seal once every job is enqueued so the run can emit one aggregated
      // summary as soon as its last job finishes.
      downloadRunTracker.seal(runId);
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

    this.registerJobWithRun(jobData, jobId);

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
    logger.info({ groupCount: groups.length }, 'Processing channel download groups in a single job');

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

    this.registerJobWithRun(jobData, jobId);

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

      logger.info({ groupJobType, channelCount: group.channels.length }, 'Processing download group');

      // Update job type to show current group
      await jobModule.updateJob(jobId, {
        jobType: groupJobType,
      });

      try {
        // Execute this group's download (without starting next job)
        await this.executeGroupDownload(group, jobId, groupJobType, jobData, true);
        logger.info({ groupJobType }, 'Completed download group');
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

    // Check terminations and termination-persistence failures before stamping
    // the status; both feed into the DB record and the WebSocket payload.
    const inFlightJob = jobModule.getJob(jobId);
    const terminatedChannelsForJob = (inFlightJob && inFlightJob.data && inFlightJob.data.terminatedChannels) || [];
    const terminationFailuresForJob = (inFlightJob && inFlightJob.data && inFlightJob.data.terminationFailures) || [];
    const hasTerminationActivity = terminatedChannelsForJob.length > 0 || terminationFailuresForJob.length > 0;
    const completedStatus = hasTerminationActivity ? 'Complete with Warnings' : 'Complete';
    const progressState = hasTerminationActivity ? 'warning' : 'complete';

    // Mark the job as complete - this will trigger video reload from DB
    await jobModule.updateJob(jobId, {
      status: completedStatus,
    });

    // Get the updated job with all videos reloaded from database
    const completedJob = jobModule.getJob(jobId);

    if (completedJob && completedJob.data) {
      // Emit final summary WebSocket message with cumulative totals
      const MessageEmitter = require('./messageEmitter');
      const totalVideos = completedJob.data.videos?.length || 0;
      // Failures handed off to a queued auto-retry job report their final
      // outcome via that job; exclude them here so the summary isn't stale.
      const allFailedVideos = completedJob.data.failedVideos || [];
      const failedVideos = allFailedVideos.filter((video) => !(video && video.autoRetryQueued));
      const autoRetriedCount = allFailedVideos.length - failedVideos.length;
      const totalSkipped = completedJob.data.cumulativeSkipped || 0;
      const terminatedChannels = completedJob.data.terminatedChannels || [];
      const terminationFailures = completedJob.data.terminationFailures || [];
      const diagnoses = completedJob.data.diagnoses || [];

      const finalSummary = {
        totalDownloaded: totalVideos,
        totalSkipped: totalSkipped,
        totalFailed: failedVideos.length,
        totalAutoRetried: autoRetriedCount,
        totalTerminatedChannels: terminatedChannels.length,
        totalTerminationFailures: terminationFailures.length,
        failedVideos: failedVideos,
        diagnoses: diagnoses,
        terminatedChannels: terminatedChannels,
        terminationFailures: terminationFailures,
        jobType: 'Channel Downloads - All Groups',
        completedAt: new Date().toISOString()
      };

      // Build completion message with counts
      const messageParts = [`${totalVideos} downloaded`];
      if (totalSkipped > 0) messageParts.push(`${totalSkipped} skipped`);
      if (failedVideos.length > 0) messageParts.push(`${failedVideos.length} failed`);
      if (autoRetriedCount > 0) messageParts.push(`${autoRetriedCount} queued for auto-retry`);
      if (terminatedChannels.length > 0) {
        messageParts.push(`${terminatedChannels.length} channel${terminatedChannels.length !== 1 ? 's' : ''} marked terminated`);
      }
      if (terminationFailures.length > 0) {
        messageParts.push(`${terminationFailures.length} termination${terminationFailures.length !== 1 ? 's' : ''} could not be auto-disabled`);
      }
      const completionText = `Download completed: ${messageParts.join(', ')} across ${groups.length} groups`;

      const finalPayload = {
        text: completionText,
        progress: {
          jobId: jobId,
          state: progressState,
          videoCount: {
            completed: totalVideos,
            total: totalVideos,
            skipped: totalSkipped
          }
        },
        finalSummary: finalSummary
      };

      if (hasTerminationActivity) {
        finalPayload.warning = true;
      }

      // When this grouped job is part of a run, hand its totals to the run
      // tracker, which emits one aggregated summary and notification once the
      // run's last job finishes. Otherwise emit/notify per-job.
      const downloadRunTracker = require('./download/downloadRunTracker');
      const runId = this.getJobDataValue(jobData, 'runId');
      if (downloadRunTracker.isActive(runId)) {
        downloadRunTracker.recordJobResult(runId, jobId, {
          totalDownloaded: totalVideos,
          totalSkipped: totalSkipped,
          totalFailed: failedVideos.length,
          failedVideos: failedVideos,
          diagnoses: diagnoses,
          terminatedChannels: terminatedChannels,
          terminationFailures: terminationFailures,
          videoData: completedJob.data.videos || [],
          jobType: 'Channel Downloads',
        });
      } else {
        MessageEmitter.emitMessage(
          'broadcast',
          null,
          'download',
          'downloadProgress',
          finalPayload
        );

        logger.info({ jobId, totalVideos, totalFailed: failedVideos.length, totalTerminated: terminatedChannels.length, totalTerminationFailures: terminationFailures.length, groupCount: groups.length },
          'Emitted final summary for multi-group download');

        // Include termination-only runs (zero downloads, one or more terminated
        // or one or more termination-persistence failures) and diagnosed
        // failure-only runs (the advice is the whole point of notifying).
        if (totalVideos > 0 || terminatedChannels.length > 0 || terminationFailures.length > 0 || diagnoses.length > 0) {
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
    }

    // Refresh each distinct Plex library mapped to the downloaded subfolders.
    // Pre-condition: g.subFolder must already be a resolved effective subfolder
    // (clean name, no __ prefix, no ##USE_GLOBAL_DEFAULT## sentinel) as produced
    // by channelDownloadGrouper. null means root (no subfolder).
    // Defensive: refreshLibrary currently swallows errors internally
    plexModule.refreshLibrariesForSubfolders(groups.map(g => g.subFolder ?? null)).catch(err => {
      logger.error({ err }, 'Failed to refresh Plex libraries after grouped download');
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
        logger.info({ jobType }, 'Skipping group - no enabled tabs for any channels');
        return; // Skip this group, continue with next group in sequence
      }

      await fs.writeFile(tempChannelsFile, urls.join('\n'));

      const overrideSettings = this.getOverrideSettings(jobData);
      const videoCount = overrideSettings.videoCount || configModule.config.channelFilesToDownload;
      const allowRedownload = !!overrideSettings.allowRedownload;

      // Do NOT pass subfolder to download - post-processing handles subfolder routing with __ prefix
      // Pass filter config for channel-specific duration and title filtering
      // Pass audioFormat from filterConfig for MP3 downloads
      const audioFormat = group.filterConfig?.audioFormat || null;
      const skipVideoFolder = group.filterConfig?.skipVideoFolder || false;
      const args = YtdlpCommandBuilder.getBaseCommandArgs(group.quality, allowRedownload, null, group.filterConfig, audioFormat, skipVideoFolder);
      args.push('-a', tempChannelsFile);
      args.push('--playlist-end', String(videoCount));

      // Store temp file path for cleanup later
      this.downloadExecutor.tempChannelsFile = tempChannelsFile;

      // Execute download with skipJobTransition flag
      await this.downloadExecutor.doDownload(args, jobId, jobType, 0, null, allowRedownload, skipJobTransition, { skipVideoFolder });
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
    const jobData = reqOrJobData.body ? reqOrJobData.body : reqOrJobData;

    // Build job type with optional source indicator
    let jobType = MANUAL_DOWNLOAD_LABEL;
    const initiatedBy = this.getJobDataValue(jobData, 'initiatedBy');
    if (initiatedBy && initiatedBy.type === 'api_key' && initiatedBy.name) {
      jobType = `${MANUAL_DOWNLOAD_LABEL} (via API: ${initiatedBy.name})`;
    }
    const jobLabel = this.getJobDataValue(jobData, 'jobLabel');
    if (jobLabel && typeof jobLabel === 'string') {
      jobType = jobLabel;
    }

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

    this.registerJobWithRun(jobData, jobId);

    if (jobModule.getJob(jobId).status === 'In Progress') {
      // Use override settings if provided, otherwise use defaults
      const overrideSettings = this.getOverrideSettings(jobData);
      let effectiveQuality = overrideSettings.resolution ||
        this.getJobDataValue(jobData, 'effectiveQuality') ||
        null;

      const channelId = this.getJobDataValue(jobData, 'channelId');

      let channelRecord = null;
      if (channelId) {
        try {
          const Channel = require('../models/channel');
          channelRecord = await Channel.findOne({
            where: { channel_id: channelId },
            attributes: ['video_quality', 'audio_format', 'skip_video_folder'],
          });

          if (!effectiveQuality && channelRecord && channelRecord.video_quality) {
            effectiveQuality = channelRecord.video_quality;
          }
        } catch (channelErr) {
          console.error('[DownloadModule] Error determining channel quality override:', channelErr.message);
        }
      }

      const resolution = effectiveQuality || configModule.config.preferredResolution || '1080';
      const allowRedownload = overrideSettings.allowRedownload || false;
      const subfolderOverride = overrideSettings.subfolder !== undefined ? overrideSettings.subfolder : null;
      const subfolderFallback = overrideSettings.subfolderFallback !== undefined ? overrideSettings.subfolderFallback : null;
      const ratingFallback = overrideSettings.ratingFallback !== undefined ? overrideSettings.ratingFallback : null;
      // Use override audioFormat if explicitly provided (even if null), otherwise fall back to channel's audio_format setting
      const audioFormat = overrideSettings.audioFormat !== undefined
        ? overrideSettings.audioFormat
        : (channelRecord && channelRecord.audio_format) || null;

      // Persist resolved quality for any subsequent retries of this job
      this.setJobDataValue(jobData, 'effectiveQuality', resolution);

      // Determine skipVideoFolder from override settings or channel setting
      let skipVideoFolder = false;
      if (overrideSettings.skipVideoFolder !== undefined) {
        skipVideoFolder = !!overrideSettings.skipVideoFolder;
      } else if (channelRecord && channelRecord.skip_video_folder) {
        skipVideoFolder = true;
      }

      // For manual downloads, we don't apply duration filters but still exclude members-only
      // Subfolder override is passed to post-processor via environment variable
      // Pass audioFormat for MP3 downloads
      const args = YtdlpCommandBuilder.getBaseCommandArgsForManualDownload(resolution, allowRedownload, audioFormat, skipVideoFolder);

      // Check if any URLs are for videos marked as ignored, and remove them from archive
      // This allows users to manually download videos they've marked to ignore for channel downloads
      if (!allowRedownload) {
        try {
          const archiveModule = require('./archiveModule');
          const ChannelVideo = require('../models/channelvideo');

          // Extract YouTube IDs from URLs
          const youtubeIds = urls.map(url => {
            // Match various YouTube URL formats
            const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            return match ? match[1] : null;
          }).filter(Boolean);

          if (youtubeIds.length > 0) {
            // Find which of these videos are marked as ignored
            const ignoredVideos = await ChannelVideo.findAll({
              where: {
                youtube_id: youtubeIds,
                ignored: true
              },
              attributes: ['youtube_id']
            });

            // Remove ignored videos from archive so they can be downloaded
            for (const video of ignoredVideos) {
              await archiveModule.removeVideoFromArchive(video.youtube_id);
              logger.info({ youtubeId: video.youtube_id }, 'Removed ignored video from archive for manual download');
            }
          }
        } catch (err) {
          logger.error({ err }, 'Error removing ignored videos from archive');
          // Continue with download even if this fails
        }
      }

      // Add URLs to args array
      urls.forEach((url) => {
        if (url.startsWith('-')) {
          args.push('--', url);
        } else {
          args.push(url);
        }
      });

      // Pass URL count, URLs, allowRedownload flag, and subfolder override as additional parameters for manual downloads
      this.downloadExecutor.doDownload(
        args,
        jobId,
        jobType,
        urls.length,
        urls,
        allowRedownload,
        false,
        {
          subfolderOverride,
          subfolderFallback,
          ratingOverride: overrideSettings.rating !== undefined ? overrideSettings.rating : undefined,
          ratingFallback,
          skipVideoFolder,
          // Owning channel / per-video owner map for routing at finalize; see
          // the resolution priority in videoDownloadPostProcessFiles.js.
          ownerChannelId: channelId || null,
          ownerChannelMap: this.getJobDataValue(jobData, 'ownerChannelMap') || null,
        }
      );
    }
  }

  /**
   * Seed-then-track selection for playlist auto-downloads.
   * First run (null baseline): "latest N by position" seed, then stamp
   * auto_download_baseline_at. Later runs: newest N rows first-seen after the
   * baseline. Ordering-proof: does not assume where the owner inserts videos.
   * @returns {Promise<Array<{youtube_id, channel_id, channel_name, title, position, added_at}>>}
   */
  async selectAutoDownloadEntries(playlist, overrideSettings = {}) {
    const PlaylistVideo = require('../models/playlistvideo');
    const Video = require('../models/video');
    const playlistModule = require('./playlistModule');
    const playlistAutoSelection = require('./download/playlistAutoSelection');

    const limit =
      overrideSettings.videoCount || configModule.config.channelFilesToDownload || DEFAULT_FILES_TO_DOWNLOAD;
    const allowRedownload = !!overrideSettings.allowRedownload;

    const rows = await PlaylistVideo.findAll({
      where: { playlist_id: playlist.playlist_id, ignored: false },
      order: [['position', 'ASC']],
      attributes: ['youtube_id', 'channel_id', 'channel_name', 'title', 'position', 'added_at'],
    });
    if (!rows.length) return [];

    // The exclusion is "a Videos row exists" (even if the file was later
    // deleted): auto-download is not a re-download mechanism.
    let downloadedIds = new Set();
    if (!allowRedownload) {
      const ids = rows.map((r) => r.youtube_id).filter(Boolean);
      const existing = ids.length
        ? await Video.findAll({ where: { youtubeId: ids }, attributes: ['youtubeId'] })
        : [];
      downloadedIds = new Set(existing.map((v) => v.youtubeId));
    }

    const candidates = rows.map((r) => ({
      youtube_id: r.youtube_id,
      channel_id: r.channel_id,
      channel_name: r.channel_name,
      title: r.title,
      position: r.position,
      added_at: r.added_at,
      downloaded: downloadedIds.has(r.youtube_id),
      unavailable: playlistModule.isUnavailableTitle(r.title),
    }));

    const baselineAt = playlist.auto_download_baseline_at || null;
    let selected;
    if (!baselineAt) {
      selected = playlistAutoSelection.selectSeedEntries({
        candidates,
        playlistId: playlist.playlist_id,
        limit,
      });
      await playlist.update({ auto_download_baseline_at: new Date() });
      logger.info(
        { playlist_id: playlist.playlist_id, candidateCount: candidates.length, selectedCount: selected.length },
        'First auto-download run for playlist: seeded latest-N selection and stamped baseline'
      );
    } else {
      selected = playlistAutoSelection.selectNewSinceBaseline({ candidates, baselineAt, limit });
      logger.info(
        {
          playlist_id: playlist.playlist_id,
          candidateCount: candidates.length,
          alreadyDownloaded: candidates.filter((c) => c.downloaded).length,
          unavailable: candidates.filter((c) => c.unavailable).length,
          selectedCount: selected.length,
        },
        'Playlist auto-download selection'
      );
    }
    return selected;
  }

  async doPlaylistDownloads(playlist, options = {}) {
    const PlaylistVideo = require('../models/playlistvideo');
    const Video = require('../models/video');
    const Channel = require('../models/channel');
    const playlistModule = require('./playlistModule');
    const playlistDownloadGrouper = require('./playlistDownloadGrouper');
    const downloadSettingsResolver = require('./download/downloadSettingsResolver');

    const overrideSettings =
      options.overrideSettings && typeof options.overrideSettings === 'object'
        ? options.overrideSettings
        : {};
    const allowRedownload = !!overrideSettings.allowRedownload;

    const youtubeIds = Array.isArray(options.youtubeIds) ? options.youtubeIds : [];
    const isBulk = youtubeIds.length === 0;

    // Bulk "download new" runs refresh from YouTube first so newly-added videos
    // are discovered; explicit-id downloads never refresh.
    if (isBulk && options.refreshFirst) {
      try {
        await playlistModule.fetchAllPlaylistVideos(playlist.playlist_id);
      } catch (err) {
        logger.error({ err, playlist_id: playlist.playlist_id }, 'Playlist refresh before download failed');
      }
    }

    let entries;
    if (isBulk && options.limitToRecent) {
      // Scheduled auto-download: seed-then-track selection (see
      // selectAutoDownloadEntries). Entries are already filtered; the shared
      // loop below re-checks harmlessly on the <= limit selected rows.
      entries = await this.selectAutoDownloadEntries(playlist, overrideSettings);
    } else if (isBulk) {
      // Manual "download all new": every non-ignored candidate, playlist order.
      entries = await PlaylistVideo.findAll({
        where: { playlist_id: playlist.playlist_id, ignored: false },
        order: [['position', 'ASC']],
        attributes: ['youtube_id', 'channel_id', 'channel_name', 'title'],
      });
    } else {
      // Explicit ids: download exactly those, overriding `ignored`.
      entries = await PlaylistVideo.findAll({
        where: { playlist_id: playlist.playlist_id, youtube_id: youtubeIds },
        order: [['position', 'ASC']],
        attributes: ['youtube_id', 'channel_id', 'channel_name', 'title'],
      });
    }

    if (!entries.length) return 0;

    const toDownload = [];
    for (const entry of entries) {
      // A row that went private since the last refresh would fail in yt-dlp and
      // show up as a confusing failed download. Skip it; the next refresh prunes it.
      if (playlistModule.isUnavailableTitle(entry.title)) continue;

      if (!allowRedownload) {
        const already = await Video.findOne({ where: { youtubeId: entry.youtube_id } });
        if (already) continue;
      }

      if (entry.channel_id) {
        const channelExists = await Channel.findOne({ where: { channel_id: entry.channel_id } });
        if (!channelExists) {
          await playlistModule.ensureSourceChannel(
            { channel_id: entry.channel_id, uploader: entry.channel_name || null },
            playlist
          );
        }
      }

      toDownload.push({ youtube_id: entry.youtube_id, channel_id: entry.channel_id });
    }

    if (!toDownload.length) return 0;

    const groups = await playlistDownloadGrouper.buildGroups(playlist, toDownload, overrideSettings);
    const jobLabel = playlistJobLabel(playlist);

    // Per-video owner channel captured at playlist sync, so the post-processor
    // can route VEVO/Topic videos by the real owning channel instead of the
    // auto-generated upload channel in their .info.json.
    const ownerChannelMap = {};
    for (const entry of toDownload) {
      if (entry.channel_id) ownerChannelMap[entry.youtube_id] = entry.channel_id;
    }

    // Routing directives (dialog override + playlist default) are uniform across the
    // whole download, so resolve them once; channel and global tiers resolve per-video
    // at finalize. See downloadSettingsResolver.
    const routing = downloadSettingsResolver.buildRoutingDirectives({ override: overrideSettings, playlist });

    for (const group of groups) {
      const urls = group.youtubeIds.map((id) => `https://www.youtube.com/watch?v=${id}`);
      const groupOverride = {
        resolution: group.resolution,
        audioFormat: group.audioFormat,
        skipVideoFolder: group.skipVideoFolder,
        allowRedownload,
      };
      if (routing.subfolderOverride !== undefined) groupOverride.subfolder = routing.subfolderOverride;
      if (routing.subfolderFallback !== undefined) groupOverride.subfolderFallback = routing.subfolderFallback;
      if (routing.ratingOverride !== undefined) groupOverride.rating = routing.ratingOverride;
      if (routing.ratingFallback !== undefined) groupOverride.ratingFallback = routing.ratingFallback;
      // doSpecificDownloads accepts an Express-request shape (.body). runId ties
      // these jobs into the parent run so its summary aggregates them.
      await this.doSpecificDownloads({ body: { urls, overrideSettings: groupOverride, jobLabel, runId: options.runId, ownerChannelMap } });
    }

    return toDownload.length;
  }

  async afterDownloadHook(downloadedYoutubeIds) {
    if (!downloadedYoutubeIds?.length) return;

    const PlaylistVideo = require('../models/playlistvideo');
    const Playlist = require('../models/playlist');
    const m3uGenerator = require('./m3uGenerator');
    const { mediaServerSync } = require('./mediaServers');

    const rows = await PlaylistVideo.findAll({
      where: { youtube_id: downloadedYoutubeIds },
      attributes: ['playlist_id'],
    });

    const playlistIds = [...new Set(rows.map((r) => r.playlist_id))];
    if (playlistIds.length === 0) return;

    const playlists = await Playlist.findAll({
      where: { playlist_id: playlistIds, enabled: true },
    });

    for (const p of playlists) {
      try {
        await m3uGenerator.generatePlaylistM3U(p.id);
        await mediaServerSync.syncPlaylist(p.id);
      } catch (err) {
        logger.error({ err, playlist_id: p.playlist_id }, 'afterDownloadHook failed for playlist');
      }
    }
  }

  terminateCurrentDownload() {
    const terminatedJobId = this.downloadExecutor.terminateCurrentJob('User requested termination');
    return terminatedJobId;
  }
}

module.exports = new DownloadModule();
