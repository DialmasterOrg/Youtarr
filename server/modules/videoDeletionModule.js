const { Video } = require('../models');
const fs = require('fs').promises;
const path = require('path');

class VideoDeletionModule {
  constructor() {}

  /**
   * Delete a single video by ID
   * Deletes the video directory from disk and marks the video as removed in the database
   * @param {number} videoId - The database ID of the video to delete
   * @returns {Promise<{success: boolean, videoId: number, error?: string}>}
   */
  async deleteVideoById(videoId) {
    try {
      // Fetch video from database
      const video = await Video.findByPk(videoId);

      if (!video) {
        return {
          success: false,
          videoId,
          error: 'Video not found in database'
        };
      }

      // Check if video is already marked as removed
      if (video.removed) {
        return {
          success: false,
          videoId,
          error: 'Video is already marked as removed'
        };
      }

      // Check if we have a file path
      if (!video.filePath) {
        // No file path, just mark as removed in database
        await video.update({ removed: true });
        return {
          success: true,
          videoId,
          message: 'Video marked as removed (no file path)'
        };
      }

      // Get the video directory path
      // filePath format: /path/to/channel/channel - title - id/video.mp4
      // We need to delete the parent directory (channel - title - id)
      const videoDirectory = path.dirname(video.filePath);

      // Safety check: ensure the directory path contains the youtube ID
      // This prevents accidentally deleting the wrong directory
      if (!videoDirectory.includes(video.youtubeId)) {
        console.error(`Safety check failed: directory path ${videoDirectory} doesn't contain youtube ID ${video.youtubeId}`);
        return {
          success: false,
          videoId,
          error: 'Safety check failed: invalid directory path'
        };
      }

      // Delete the video directory
      try {
        await fs.rm(videoDirectory, { recursive: true, force: true });
        console.log(`Deleted video directory: ${videoDirectory}`);
      } catch (fsError) {
        if (fsError.code === 'ENOENT') {
          // Directory already gone; treat as success but still mark removed in DB
          console.info(`Directory ${videoDirectory} already removed: ${fsError.message}`);
        } else {
          console.error(`Failed to delete directory ${videoDirectory}:`, fsError);
          return {
            success: false,
            videoId,
            error: 'Failed to delete video files from disk. Please check filesystem permissions.'
          };
        }
      }

      // Mark video as removed in database
      await video.update({ removed: true });

      return {
        success: true,
        videoId,
        message: 'Video deleted successfully'
      };
    } catch (error) {
      console.error(`Error deleting video ${videoId}:`, error);
      return {
        success: false,
        videoId,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete multiple videos
   * @param {number[]} videoIds - Array of video IDs to delete
   * @returns {Promise<{success: boolean, deleted: number[], failed: Array<{videoId: number, error: string}>}>}
   */
  async deleteVideos(videoIds) {
    const deleted = [];
    const failed = [];

    // Process deletions sequentially to avoid overwhelming the file system
    for (const videoId of videoIds) {
      const result = await this.deleteVideoById(videoId);

      if (result.success) {
        deleted.push(videoId);
      } else {
        failed.push({
          videoId,
          error: result.error || 'Unknown error'
        });
      }
    }

    return {
      success: failed.length === 0,
      deleted,
      failed
    };
  }

  /**
   * Delete videos by YouTube IDs
   * @param {string[]} youtubeIds - Array of YouTube video IDs
   * @returns {Promise<{success: boolean, deleted: string[], failed: Array<{youtubeId: string, error: string}>}>}
   */
  async deleteVideosByYoutubeIds(youtubeIds) {
    const deleted = [];
    const failed = [];

    for (const youtubeId of youtubeIds) {
      try {
        // Find the video by YouTube ID
        const video = await Video.findOne({
          where: { youtubeId: youtubeId }
        });

        if (!video) {
          failed.push({
            youtubeId,
            error: 'Video not found in database'
          });
          continue;
        }

        // Delete using the database ID
        const result = await this.deleteVideoById(video.id);

        if (result.success) {
          deleted.push(youtubeId);
        } else {
          failed.push({
            youtubeId,
            error: result.error || 'Unknown error'
          });
        }
      } catch (error) {
        failed.push({
          youtubeId,
          error: error.message || 'Unknown error occurred'
        });
      }
    }

    return {
      success: failed.length === 0,
      deleted,
      failed
    };
  }
}

module.exports = new VideoDeletionModule();
