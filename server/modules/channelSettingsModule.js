const fs = require('fs-extra');
const path = require('path');
const Channel = require('../models/channel');
const configModule = require('./configModule');
const { Op } = require('sequelize');
const logger = require('../logger');
const ratingMapper = require('./ratingMapper');
const {
  GLOBAL_DEFAULT_SENTINEL,
  ROOT_SENTINEL,
  SUBFOLDER_PREFIX,
  buildChannelPath,
  buildSubfolderSegment,
  resolveEffectiveSubfolder: fsResolveEffectiveSubfolder,
  resolveChannelFolderName,
  calculateRelocatedPath,
  ensureDir,
  moveWithRetries
} = require('./filesystem');

/**
 * Module for managing channel-level configuration settings
 * Handles subfolder organization and per-channel video quality overrides
 */
class ChannelSettingsModule {
  /**
   * Get the sentinel value for "use global default subfolder"
   * @returns {string} - The sentinel value
   */
  getGlobalDefaultSentinel() {
    return GLOBAL_DEFAULT_SENTINEL;
  }

  /**
   * Resolve the effective subfolder for a channel
   * @param {string|null} channelSubFolder - The channel's sub_folder DB value
   * @returns {string|null} - The actual subfolder to use (without __ prefix), or null for root
   */
  resolveEffectiveSubfolder(channelSubFolder) {
    return fsResolveEffectiveSubfolder(channelSubFolder, configModule.getDefaultSubfolder());
  }

  /**
   * Validate subfolder name
   * @param {string} subFolder - Subfolder name to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  validateSubFolder(subFolder) {
    // NULL or empty string is valid (download to root)
    if (!subFolder || subFolder.trim() === '') {
      return { valid: true };
    }

    // Allow the special "use global default" sentinel value
    if (subFolder === GLOBAL_DEFAULT_SENTINEL) {
      return { valid: true };
    }

    // Allow the special "explicit root" sentinel value (for manual downloads)
    if (subFolder === ROOT_SENTINEL) {
      return { valid: true };
    }

    const trimmed = subFolder.trim();

    // Check length
    if (trimmed.length > 100) {
      return { valid: false, error: 'Subfolder name must be 100 characters or less' };
    }

    // Check for invalid characters
    // Allow: alphanumeric, spaces, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validPattern.test(trimmed)) {
      return { valid: false, error: 'Subfolder name can only contain letters, numbers, spaces, hyphens, and underscores' };
    }

    // Check for path traversal attempts
    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
      return { valid: false, error: 'Invalid subfolder name' };
    }

    // Reject names starting with __ (reserved for system use)
    if (trimmed.startsWith(SUBFOLDER_PREFIX)) {
      return { valid: false, error: `Subfolder names cannot start with ${SUBFOLDER_PREFIX} (reserved prefix)` };
    }

    return { valid: true };
  }

  /**
   * Validate video quality setting
   * @param {string} quality - Quality setting to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  validateVideoQuality(quality) {
    // NULL is valid (use global setting)
    if (quality === null || quality === undefined) {
      return { valid: true };
    }

    const validQualities = ['360', '480', '720', '1080', '1440', '2160'];
    if (!validQualities.includes(quality)) {
      return { valid: false, error: 'Invalid video quality. Valid values: 360, 480, 720, 1080, 1440, 2160, or null for global setting' };
    }

    return { valid: true };
  }

  /**
   * Validate duration filter settings
   * @param {number|null} minDuration - Minimum duration in seconds
   * @param {number|null} maxDuration - Maximum duration in seconds
   * @returns {Object} - { valid: boolean, error?: string }
   */
  validateDurationSettings(minDuration, maxDuration) {
    // Both null is valid (no duration filtering)
    if (minDuration === null && maxDuration === null) {
      return { valid: true };
    }

    // Validate min_duration if set
    if (minDuration !== null && minDuration !== undefined) {
      if (!Number.isInteger(minDuration) || minDuration < 0) {
        return {
          valid: false,
          error: 'Minimum duration must be a non-negative integer (seconds)',
        };
      }
      if (minDuration > 86400) {
        // 24 hours in seconds
        return {
          valid: false,
          error: 'Minimum duration cannot exceed 24 hours (86400 seconds)',
        };
      }
    }

    // Validate max_duration if set
    if (maxDuration !== null && maxDuration !== undefined) {
      if (!Number.isInteger(maxDuration) || maxDuration < 0) {
        return {
          valid: false,
          error: 'Maximum duration must be a non-negative integer (seconds)',
        };
      }
      if (maxDuration > 86400) {
        // 24 hours in seconds
        return {
          valid: false,
          error: 'Maximum duration cannot exceed 24 hours (86400 seconds)',
        };
      }
    }

    // If both are set, min must be less than max
    if (
      minDuration !== null &&
      minDuration !== undefined &&
      maxDuration !== null &&
      maxDuration !== undefined
    ) {
      if (minDuration >= maxDuration) {
        return {
          valid: false,
          error: 'Minimum duration must be less than maximum duration',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate title filter regex pattern (Python regex syntax)
   * Uses Python directly to test regex validity - same as yt-dlp
   * @param {string|null} titleFilterRegex - Python regex pattern to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  validateTitleRegex(titleFilterRegex) {
    // NULL or empty string is valid (no title filtering)
    if (!titleFilterRegex || titleFilterRegex.trim() === '') {
      return { valid: true };
    }

    const trimmed = titleFilterRegex.trim();

    // Check length (reasonable limit for regex patterns)
    if (trimmed.length > 500) {
      return {
        valid: false,
        error: 'Title filter regex must be 500 characters or less',
      };
    }

    // Test if it's a valid Python regex by testing against a sample string
    try {
      const { execFileSync } = require('child_process');
      const path = require('path');
      const scriptPath = path.join(__dirname, '../utils/test-python-regex.py');

      // Use execFileSync with argument array to prevent shell injection
      const result = execFileSync('python3', [scriptPath, trimmed, 'test'], {
        encoding: 'utf8',
        timeout: 1000,
      });

      const parsed = JSON.parse(result);
      if (parsed.error) {
        return { valid: false, error: parsed.error };
      }
    } catch (err) {
      return {
        valid: false,
        error: `Invalid Python regex pattern: ${err.message}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate default rating override
   * @param {string|null} defaultRating - Default rating value
   * @returns {Object} - { valid: boolean, error?: string }
   */
  validateDefaultRating(defaultRating) {
    if (defaultRating === null || defaultRating === undefined || defaultRating === '') {
      return { valid: true };
    }

    const trimmed = String(defaultRating).trim();
    if (!trimmed) {
      return { valid: true };
    }

    if (trimmed.toUpperCase() === 'NR') {
      return { valid: true };
    }

    const allowedRatings = Object.keys(ratingMapper.RATING_AGE_LIMITS);
    if (!allowedRatings.includes(trimmed.toUpperCase())) {
      return { valid: false, error: 'Invalid default rating value' };
    }

    return { valid: true };
  }

  /**
   * Get the full directory path for a channel, including subfolder if set
   * @param {Object} channel - Channel database record
   * @returns {string} - Full directory path
   */
  getChannelDirectory(channel) {
    const baseDir = configModule.directoryPath;
    const effectiveSubfolder = this.resolveEffectiveSubfolder(channel.sub_folder);
    const channelName = resolveChannelFolderName(channel);
    return buildChannelPath(baseDir, effectiveSubfolder, channelName);
  }

  /**
   * Check if a channel has any active downloads
   * @param {string} channelId - Channel ID to check
   * @returns {Promise<boolean>} - True if downloads are active
   */
  async hasActiveDownloads(channelId) {
    const jobModule = require('./jobModule');
    const jobs = jobModule.getAllJobs();

    // Check if any job is downloading videos for this channel
    for (const job of Object.values(jobs)) {
      if (job.status === 'In Progress' || job.status === 'Pending') {
        // Check JobVideoDownload table for this channel
        const { JobVideoDownload } = require('../models');
        const activeDownloads = await JobVideoDownload.count({
          where: {
            job_id: job.id,
            status: {
              [Op.in]: ['pending', 'in_progress']
            }
          }
        });

        if (activeDownloads > 0) {
          // Need to verify these downloads are for this channel
          // Get channel info from the video IDs
          const Video = require('../models/video');
          const activeVideos = await JobVideoDownload.findAll({
            where: {
              job_id: job.id,
              status: {
                [Op.in]: ['pending', 'in_progress']
              }
            },
            attributes: ['youtube_id']
          });

          for (const videoDownload of activeVideos) {
            const video = await Video.findOne({
              where: { youtubeId: videoDownload.youtube_id },
              attributes: ['channel_id']
            });

            if (video && video.channel_id === channelId) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Get count of channels using the default subfolder (sub_folder = ##USE_GLOBAL_DEFAULT##)
   * Used to warn users when changing the global default subfolder
   * @returns {Promise<Object>} - { count: number, channelNames: string[] }
   */
  async getChannelsUsingDefaultSubfolder() {
    const channels = await Channel.findAll({
      attributes: ['uploader'],
      where: {
        sub_folder: GLOBAL_DEFAULT_SENTINEL
      }
    });

    return {
      count: channels.length,
      channelNames: channels.map(ch => ch.uploader).slice(0, 10) // First 10 for display
    };
  }

  /**
   * Get all unique subfolders currently in use
   * @returns {Promise<Array<string>>} - Array of unique subfolder names
   */
  async getAllSubFolders() {
    const channels = await Channel.findAll({
      attributes: ['sub_folder'],
      where: {
        sub_folder: {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: GLOBAL_DEFAULT_SENTINEL }
          ]
        }
      }
    });

    const uniqueSubFolders = [...new Set(
      channels
        .map(ch => ch.sub_folder ? ch.sub_folder.trim() : null)
        .filter(folder => folder && folder !== GLOBAL_DEFAULT_SENTINEL)
    )];

    // Add __ prefix for display (matches filesystem names)
    return uniqueSubFolders.map(folder => buildSubfolderSegment(folder)).sort();
  }

  /**
   * Preview how a title filter regex would apply to recent channel videos
   * Uses Python directly to test regex - EXACTLY the same as yt-dlp
   * @param {string} channelId - Channel ID
   * @param {string} regexPattern - Python regex pattern to test
   * @returns {Promise<Object>} - { videos: [...], totalCount, matchCount }
   */
  async previewTitleFilter(channelId, regexPattern) {
    const ChannelVideo = require('../models/channelvideo');
    const path = require('path');

    // Validate the regex pattern first
    const validation = this.validateTitleRegex(regexPattern);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Get recent 20 videos for this channel from channelvideos table
    // This table is populated when browsing channel page, before any downloads
    const channelVideos = await ChannelVideo.findAll({
      where: { channel_id: channelId },
      attributes: ['youtube_id', 'title', 'publishedAt'],
      order: [['publishedAt', 'DESC']],
      limit: 20,
    });

    // If no regex pattern provided or empty, all videos match
    if (!regexPattern || regexPattern.trim() === '') {
      const videos = channelVideos.map((cv) => ({
        video_id: cv.youtube_id,
        title: cv.title,
        upload_date: cv.publishedAt,
        matches: true,
      }));
      return {
        videos,
        totalCount: videos.length,
        matchCount: videos.length,
      };
    }

    // Use Python to test each video title - same regex engine as yt-dlp
    const { execFileSync } = require('child_process');
    const scriptPath = path.join(__dirname, '../utils/test-python-regex.py');
    const trimmedPattern = regexPattern.trim();

    const videos = channelVideos.map((cv) => {
      const title = cv.title || '';
      let matches = false;

      try {
        // Use execFileSync with argument array to prevent shell injection
        const result = execFileSync(
          'python3',
          [scriptPath, trimmedPattern, title],
          { encoding: 'utf8', timeout: 1000 }
        );

        const parsed = JSON.parse(result);
        if (parsed.error) {
          logger.error({ err: parsed.error, title }, 'Regex test error in previewTitleFilter');
          matches = false;
        } else {
          matches = parsed.matches;
        }
      } catch (testError) {
        // If Python execution fails for a specific title, consider it non-matching
        logger.error({ err: testError.message, title }, 'Failed to test title in previewTitleFilter');
        matches = false;
      }

      return {
        video_id: cv.youtube_id,
        title,
        upload_date: cv.publishedAt,
        matches,
      };
    });

    const matchCount = videos.filter((v) => v.matches).length;

    return {
      videos,
      totalCount: videos.length,
      matchCount,
    };
  }

  /**
   * Get channel settings
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} - Channel settings
   */
  async getChannelSettings(channelId) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId }
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    return {
      channel_id: channel.channel_id,
      uploader: channel.uploader,
      sub_folder: channel.sub_folder,
      video_quality: channel.video_quality,
      min_duration: channel.min_duration,
      max_duration: channel.max_duration,
      title_filter_regex: channel.title_filter_regex,
      default_rating: channel.default_rating || null,
    };
  }

  /**
   * Update channel settings
   * @param {string} channelId - Channel ID
   * @param {Object} settings - Settings to update { sub_folder?, video_quality? }
   * @returns {Promise<Object>} - Updated settings and move result
   */
  async updateChannelSettings(channelId, settings) {
    const channel = await Channel.findOne({
      where: { channel_id: channelId }
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check for active downloads
    if (settings.sub_folder !== undefined) {
      const hasActive = await this.hasActiveDownloads(channelId);
      if (hasActive) {
        throw new Error('Cannot change subfolder while downloads are in progress for this channel');
      }
    }

    // Validate subfolder if provided
    if (settings.sub_folder !== undefined) {
      const validation = this.validateSubFolder(settings.sub_folder);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    // Validate video quality if provided
    if (settings.video_quality !== undefined) {
      const validation = this.validateVideoQuality(settings.video_quality);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    // Validate duration settings if provided
    if (
      settings.min_duration !== undefined ||
      settings.max_duration !== undefined
    ) {
      const minDuration =
        settings.min_duration !== undefined
          ? settings.min_duration
          : channel.min_duration;
      const maxDuration =
        settings.max_duration !== undefined
          ? settings.max_duration
          : channel.max_duration;
      const validation = this.validateDurationSettings(
        minDuration,
        maxDuration
      );
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    // Validate title filter regex if provided
    if (settings.title_filter_regex !== undefined) {
      const validation = this.validateTitleRegex(settings.title_filter_regex);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    if (settings.default_rating !== undefined) {
      const validation = this.validateDefaultRating(settings.default_rating);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
    }

    // Store old subfolder for potential move
    const oldSubFolder = channel.sub_folder;
    const newSubFolder = settings.sub_folder !== undefined ?
      (settings.sub_folder ? settings.sub_folder.trim() : null) :
      oldSubFolder;

    // Check if subfolder changed
    const subFolderChanged = settings.sub_folder !== undefined && oldSubFolder !== newSubFolder;

    // Prepare update payload
    const updateData = {};
    if (settings.sub_folder !== undefined) {
      updateData.sub_folder = newSubFolder;
    }
    if (settings.video_quality !== undefined) {
      updateData.video_quality = settings.video_quality;
    }
    if (settings.min_duration !== undefined) {
      updateData.min_duration = settings.min_duration;
    }
    if (settings.max_duration !== undefined) {
      updateData.max_duration = settings.max_duration;
    }
    if (settings.title_filter_regex !== undefined) {
      updateData.title_filter_regex = settings.title_filter_regex
        ? settings.title_filter_regex.trim()
        : null;
    }
    if (settings.default_rating !== undefined) {
      updateData.default_rating = settings.default_rating
        ? String(settings.default_rating).trim()
        : null;
    }
    if (settings.auto_download_enabled_tabs !== undefined) {
      updateData.auto_download_enabled_tabs = settings.auto_download_enabled_tabs;
    }

    // Update database FIRST to ensure changes are persisted before slow file operations
    // This prevents issues where HTTP requests timeout during file operations
    let updatedChannel = channel;
    if (Object.keys(updateData).length > 0) {
      try {
        updatedChannel = await channel.update(updateData);
        logger.info({ updateData }, 'Updated channel settings in database');
      } catch (updateError) {
        logger.error({ err: updateError.message }, 'Error updating channel settings in database');
        throw updateError;
      }
    }

    // Move the channel folder if subfolder changed
    // If this fails, we'll roll back the database change
    let moveResult = null;
    if (subFolderChanged) {
      try {
        moveResult = await this.moveChannelFolder(updatedChannel, oldSubFolder, newSubFolder);
      } catch (moveError) {
        // Roll back database change if folder move fails
        logger.error({ err: moveError.message }, 'Error moving channel folder, rolling back database change');
        try {
          await updatedChannel.update({ sub_folder: oldSubFolder });
          logger.info('Successfully rolled back database change');
        } catch (rollbackError) {
          logger.error({ err: rollbackError.message }, 'Error rolling back database change after folder move failure');
          // Database is now inconsistent - log critical error
          logger.error('CRITICAL: Database sub_folder is out of sync with filesystem!');
        }
        throw moveError;
      }
    }

    return {
      settings: {
        channel_id: updatedChannel.channel_id,
        uploader: updatedChannel.uploader,
        sub_folder: updatedChannel.sub_folder,
        video_quality: updatedChannel.video_quality,
        min_duration: updatedChannel.min_duration,
        max_duration: updatedChannel.max_duration,
        title_filter_regex: updatedChannel.title_filter_regex,
        default_rating: updatedChannel.default_rating || null,
        auto_download_enabled_tabs: updatedChannel.auto_download_enabled_tabs,
      },
      folderMoved: subFolderChanged,
      moveResult
    };
  }

  /**
   * Move a channel's folder to a new subfolder location
   * @param {Object} channel - Channel database record (with updated sub_folder)
   * @param {string|null} oldSubFolder - Previous subfolder (raw database value, may include ##USE_GLOBAL_DEFAULT## sentinel)
   * @param {string|null} newSubFolder - New subfolder (raw database value, may include ##USE_GLOBAL_DEFAULT## sentinel)
   * @returns {Promise<Object>} - Result of move operation
   */
  async moveChannelFolder(channel, oldSubFolder, newSubFolder) {
    const baseDir = configModule.directoryPath;
    const channelName = resolveChannelFolderName(channel);

    // Resolve effective subfolders (handles ##USE_GLOBAL_DEFAULT## sentinel -> global default, null -> root)
    const effectiveOldSubFolder = this.resolveEffectiveSubfolder(oldSubFolder);
    const effectiveNewSubFolder = this.resolveEffectiveSubfolder(newSubFolder);

    // Calculate old and new paths using centralized path builder
    const oldPath = buildChannelPath(baseDir, effectiveOldSubFolder, channelName);
    const newPath = buildChannelPath(baseDir, effectiveNewSubFolder, channelName);

    logger.info(`Moving channel folder from ${oldPath} to ${newPath}`);

    // If paths are the same, no move needed
    if (oldPath === newPath) {
      logger.info({ oldPath, newPath }, 'Source and destination paths are the same, no move needed');
      return {
        success: true,
        message: 'No move needed - source and destination are the same',
        oldPath,
        newPath
      };
    }

    // Check if old folder exists
    if (!fs.existsSync(oldPath)) {
      logger.warn({ oldPath }, 'Old channel folder does not exist');
      return {
        success: true,
        message: 'No existing folder to move',
        oldPath,
        newPath
      };
    }

    // Check if new path already exists
    if (fs.existsSync(newPath)) {
      throw new Error(`Destination folder already exists: ${newPath}`);
    }

    try {
      // Ensure parent directory exists
      const newParentDir = path.dirname(newPath);
      await ensureDir(newParentDir);

      // Move the folder with retries for resilience
      await moveWithRetries(oldPath, newPath);

      logger.info({ newPath }, 'Successfully moved channel folder');

      // Update all video file paths in the database
      await this.updateVideoFilePaths(channel.channel_id, oldPath, newPath);

      // Trigger Plex library refresh asynchronously (non-blocking)
      // Don't await this to prevent timeout issues from blocking the operation
      setImmediate(async () => {
        try {
          const plexModule = require('./plexModule');
          await plexModule.refreshLibrary();
          logger.info('Plex library refresh completed after folder move');
        } catch (plexError) {
          logger.error({ err: plexError.message }, 'Could not refresh Plex library');
          // Don't fail the whole operation if Plex refresh fails
        }
      });
      logger.info('Plex library refresh initiated asynchronously');

      return {
        success: true,
        message: 'Channel folder moved successfully',
        oldPath,
        newPath
      };
    } catch (error) {
      logger.error({ err: error.message }, 'Error moving channel folder');
      throw new Error(`Failed to move channel folder: ${error.message}`);
    }
  }

  /**
   * Update file paths in Videos table after moving a channel folder
   * @param {string} channelId - Channel ID
   * @param {string} oldBasePath - Old base path
   * @param {string} newBasePath - New base path
   * @returns {Promise<number>} - Number of videos updated
   */
  async updateVideoFilePaths(channelId, oldBasePath, newBasePath) {
    const Video = require('../models/video');

    logger.info({ channelId, oldBasePath, newBasePath }, 'Updating video file paths for channel');

    try {
      // Get all videos for this channel that have file paths
      const videos = await Video.findAll({
        where: {
          channel_id: channelId,
          filePath: {
            [Op.ne]: null
          }
        }
      });

      logger.info({ count: videos.length }, 'Found videos to update');

      let updateCount = 0;
      for (const video of videos) {
        const oldFilePath = video.filePath;
        const newFilePath = calculateRelocatedPath(oldBasePath, newBasePath, oldFilePath);

        if (newFilePath) {
          await video.update({ filePath: newFilePath });
          logger.info({ oldFilePath, newFilePath }, 'Updated video file path');
          updateCount++;
        }
      }

      logger.info({ count: updateCount }, 'Updated video file paths');
      return updateCount;
    } catch (error) {
      logger.error({ err: error.message }, 'Error updating video file paths');
      throw error;
    }
  }
}

module.exports = new ChannelSettingsModule();
