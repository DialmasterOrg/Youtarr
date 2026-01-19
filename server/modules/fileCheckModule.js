const fs = require('fs').promises;

/**
 * Check file existence and update video metadata.
 * This shared module provides file existence checking for videos,
 * updating their 'removed' status and file size in real-time.
 */
class FileCheckModule {
  /**
   * Check file existence for an array of videos and prepare updates.
   * Checks both video files (filePath) and audio files (audioFilePath).
   * Only checks files that have a path stored to avoid incorrect marking.
   *
   * @param {Array} videos - Array of video objects with filePath and audioFilePath properties
   * @returns {Promise<Object>} - Object with updated videos array and database updates array
   */
  async checkVideoFiles(videos) {
    const updates = [];
    const updatedVideos = [...videos];

    for (let i = 0; i < updatedVideos.length; i++) {
      const video = updatedVideos[i];
      const update = { id: video.id };
      let hasUpdates = false;
      let videoFileExists = false;
      let audioFileExists = false;
      // Track if we could definitively determine file status (not blocked by permission errors, etc.)
      let videoFileStatusKnown = !video.filePath; // If no path, status is "known" (not applicable)
      let audioFileStatusKnown = !video.audioFilePath; // If no path, status is "known" (not applicable)

      // Check video file (filePath)
      if (video.filePath) {
        try {
          const stats = await fs.stat(video.filePath);
          videoFileExists = true;
          videoFileStatusKnown = true;

          // File exists - update if size changed
          if (video.fileSize !== stats.size.toString()) {
            update.fileSize = stats.size;
            hasUpdates = true;
          }
        } catch (err) {
          if (err.code === 'ENOENT') {
            // Video file doesn't exist - definitively known
            videoFileExists = false;
            videoFileStatusKnown = true;
          }
          // For non-ENOENT errors (permissions, etc.), we can't determine status
          // videoFileStatusKnown remains false, so we won't change removed status
        }
      }

      // Check audio file (audioFilePath)
      if (video.audioFilePath) {
        try {
          const stats = await fs.stat(video.audioFilePath);
          audioFileExists = true;
          audioFileStatusKnown = true;

          // File exists - update if size changed
          if (video.audioFileSize !== stats.size.toString()) {
            update.audioFileSize = stats.size;
            hasUpdates = true;
          }
        } catch (err) {
          if (err.code === 'ENOENT') {
            // Audio file doesn't exist - definitively known
            audioFileExists = false;
            audioFileStatusKnown = true;
          }
          // For non-ENOENT errors (permissions, etc.), we can't determine status
          // audioFileStatusKnown remains false, so we won't change removed status
        }
      }

      // Determine removed status: removed only if NO files exist (both video and audio missing)
      // Only update if we could definitively determine status for all paths
      const hasAnyPath = video.filePath || video.audioFilePath;
      const hasAnyFile = videoFileExists || audioFileExists;
      const canDetermineRemovedStatus = videoFileStatusKnown && audioFileStatusKnown;

      if (hasAnyPath && canDetermineRemovedStatus) {
        if (hasAnyFile && video.removed) {
          // At least one file exists, mark as not removed
          update.removed = false;
          hasUpdates = true;
        } else if (!hasAnyFile && !video.removed) {
          // No files exist, mark as removed
          update.removed = true;
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        updates.push(update);
        // Update the video object for immediate response
        updatedVideos[i] = {
          ...video,
          ...(update.fileSize !== undefined && { fileSize: update.fileSize.toString() }),
          ...(update.audioFileSize !== undefined && { audioFileSize: update.audioFileSize.toString() }),
          ...(update.removed !== undefined && { removed: update.removed })
        };
      }
    }
    // Intentionally NOT searching for videos without a filePath or audioFilePath
    // This prevents incorrectly marking videos as removed when we can't find them quickly
    // The backfill process will handle finding and updating these videos

    return { videos: updatedVideos, updates };
  }

  /**
   * Apply database updates for video file status changes.
   *
   * @param {Object} sequelize - Sequelize instance
   * @param {Object} Sequelize - Sequelize library
   * @param {Array} updates - Array of update objects with id, fileSize, audioFileSize, and/or removed properties
   * @returns {Promise<void>}
   */
  async applyVideoUpdates(sequelize, Sequelize, updates) {
    if (updates.length === 0) {
      return;
    }

    for (const update of updates) {
      const setClauses = [];
      const values = [];

      if (update.fileSize !== undefined) {
        setClauses.push('fileSize = ?');
        values.push(update.fileSize);
      }
      if (update.audioFileSize !== undefined) {
        setClauses.push('audioFileSize = ?');
        values.push(update.audioFileSize);
      }
      if (update.removed !== undefined) {
        setClauses.push('removed = ?');
        values.push(update.removed ? 1 : 0);
      }

      if (setClauses.length > 0) {
        values.push(update.id);
        await sequelize.query(
          `UPDATE Videos SET ${setClauses.join(', ')} WHERE id = ?`,
          {
            replacements: values,
            type: Sequelize.QueryTypes.UPDATE
          }
        );
      }
    }
  }
}

module.exports = new FileCheckModule();