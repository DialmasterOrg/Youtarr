const fs = require('fs-extra');
const path = require('path');
const Channel = require('../models/channel');
const configModule = require('./configModule');
const { Op } = require('sequelize');

/**
 * Module for managing channel-level configuration settings
 * Handles subfolder organization and per-channel video quality overrides
 */
class ChannelSettingsModule {
  /**
   * Validate subfolder name
   * @param {string} subFolder - Subfolder name to validate
   * @returns {Object} - { valid: boolean, error?: string }
   */
  validateSubFolder(subFolder) {
    // NULL or empty string is valid (no subfolder)
    if (!subFolder || subFolder.trim() === '') {
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
    if (trimmed.startsWith('__')) {
      return { valid: false, error: 'Subfolder names cannot start with __ (reserved prefix)' };
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
   * Get the full directory path for a channel, including subfolder if set
   * @param {Object} channel - Channel database record
   * @returns {string} - Full directory path
   */
  getChannelDirectory(channel) {
    const baseDir = configModule.directoryPath;
    const subFolder = channel.sub_folder ? channel.sub_folder.trim() : null;
    const channelName = channel.uploader;

    if (subFolder) {
      // Add __ prefix for namespace safety
      const safeSubFolder = `__${subFolder}`;
      return path.join(baseDir, safeSubFolder, channelName);
    }

    return path.join(baseDir, channelName);
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
   * Get all unique subfolders currently in use
   * @returns {Promise<Array<string>>} - Array of unique subfolder names
   */
  async getAllSubFolders() {
    const channels = await Channel.findAll({
      attributes: ['sub_folder'],
      where: {
        sub_folder: {
          [Op.ne]: null
        }
      }
    });

    const uniqueSubFolders = [...new Set(
      channels
        .map(ch => ch.sub_folder ? ch.sub_folder.trim() : null)
        .filter(Boolean)
    )];

    // Add __ prefix for display (matches filesystem names)
    return uniqueSubFolders.map(folder => `__${folder}`).sort();
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
      video_quality: channel.video_quality
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

    // Update database FIRST to ensure changes are persisted before slow file operations
    // This prevents issues where HTTP requests timeout during file operations
    let updatedChannel = channel;
    if (Object.keys(updateData).length > 0) {
      try {
        updatedChannel = await channel.update(updateData);
        console.log(`Updated channel settings in database: ${JSON.stringify(updateData)}`);
      } catch (updateError) {
        console.error('Error updating channel settings in database:', updateError.message);
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
        console.error('Error moving channel folder, rolling back database change:', moveError.message);
        try {
          await updatedChannel.update({ sub_folder: oldSubFolder });
          console.log('Successfully rolled back database change');
        } catch (rollbackError) {
          console.error('Error rolling back database change after folder move failure:', rollbackError.message);
          // Database is now inconsistent - log critical error
          console.error('CRITICAL: Database sub_folder is out of sync with filesystem!');
        }
        throw moveError;
      }
    }

    return {
      settings: {
        channel_id: updatedChannel.channel_id,
        uploader: updatedChannel.uploader,
        sub_folder: updatedChannel.sub_folder,
        video_quality: updatedChannel.video_quality
      },
      folderMoved: subFolderChanged,
      moveResult
    };
  }

  /**
   * Move a channel's folder to a new subfolder location
   * @param {Object} channel - Channel database record (with updated sub_folder)
   * @param {string|null} oldSubFolder - Previous subfolder (or null)
   * @param {string|null} newSubFolder - New subfolder (or null)
   * @returns {Promise<Object>} - Result of move operation
   */
  async moveChannelFolder(channel, oldSubFolder, newSubFolder) {
    const baseDir = configModule.directoryPath;
    const channelName = channel.uploader;

    // Calculate old and new paths with __ prefix for subfolders
    const oldPath = oldSubFolder ?
      path.join(baseDir, `__${oldSubFolder}`, channelName) :
      path.join(baseDir, channelName);

    const newPath = newSubFolder ?
      path.join(baseDir, `__${newSubFolder}`, channelName) :
      path.join(baseDir, channelName);

    console.log(`Moving channel folder from ${oldPath} to ${newPath}`);

    // Check if old folder exists
    if (!fs.existsSync(oldPath)) {
      console.log(`Old channel folder does not exist: ${oldPath}`);
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
      await fs.ensureDir(newParentDir);

      // Move the folder
      await fs.move(oldPath, newPath);

      console.log(`Successfully moved channel folder to ${newPath}`);

      // Update all video file paths in the database
      await this.updateVideoFilePaths(channel.channel_id, oldPath, newPath);

      // Trigger Plex library refresh asynchronously (non-blocking)
      // Don't await this to prevent timeout issues from blocking the operation
      setImmediate(async () => {
        try {
          const plexModule = require('./plexModule');
          await plexModule.refreshLibrary();
          console.log('Plex library refresh completed after folder move');
        } catch (plexError) {
          console.log('Could not refresh Plex library:', plexError.message);
          // Don't fail the whole operation if Plex refresh fails
        }
      });
      console.log('Plex library refresh initiated asynchronously');

      return {
        success: true,
        message: 'Channel folder moved successfully',
        oldPath,
        newPath
      };
    } catch (error) {
      console.error(`Error moving channel folder: ${error.message}`);
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

    console.log(`Updating video file paths for channel ${channelId}`);
    console.log(`  Old base: ${oldBasePath}`);
    console.log(`  New base: ${newBasePath}`);

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

      console.log(`Found ${videos.length} videos to update`);

      let updateCount = 0;
      for (const video of videos) {
        const oldFilePath = video.filePath;

        // Check if the file path starts with the old base path
        if (oldFilePath && oldFilePath.startsWith(oldBasePath)) {
          // Replace the old base path with the new base path
          const relativePath = oldFilePath.substring(oldBasePath.length);
          const newFilePath = newBasePath + relativePath;

          await video.update({ filePath: newFilePath });
          console.log(`Updated: ${path.basename(oldFilePath)} -> ${newFilePath}`);
          updateCount++;
        }
      }

      console.log(`Updated ${updateCount} video file paths`);
      return updateCount;
    } catch (error) {
      console.error('Error updating video file paths:', error);
      throw error;
    }
  }
}

module.exports = new ChannelSettingsModule();
