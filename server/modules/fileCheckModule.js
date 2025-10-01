const fs = require('fs').promises;

/**
 * Check file existence and update video metadata.
 * This shared module provides file existence checking for videos,
 * updating their 'removed' status and file size in real-time.
 */
class FileCheckModule {
  /**
   * Check file existence for an array of videos and prepare updates.
   * Only checks videos that have a filePath to avoid incorrect marking.
   *
   * @param {Array} videos - Array of video objects with filePath property
   * @returns {Promise<Object>} - Object with updated videos array and database updates array
   */
  async checkVideoFiles(videos) {
    const updates = [];
    const updatedVideos = [...videos];

    for (let i = 0; i < updatedVideos.length; i++) {
      const video = updatedVideos[i];

      // Only check if we have a filePath stored - don't try to search for missing paths
      if (video.filePath) {
        try {
          const stats = await fs.stat(video.filePath);

          // File exists - update if marked as removed or size changed
          if (video.removed || video.fileSize !== stats.size.toString()) {
            updates.push({
              id: video.id,
              fileSize: stats.size,
              removed: false
            });
            // Update the video object for immediate response
            updatedVideos[i] = {
              ...video,
              fileSize: stats.size.toString(),
              removed: false
            };
          }
        } catch (err) {
          // File doesn't exist - mark as removed if not already
          if (err.code === 'ENOENT' && !video.removed) {
            updates.push({
              id: video.id,
              removed: true
            });
            // Update the video object for immediate response
            updatedVideos[i] = {
              ...video,
              removed: true
            };
          }
        }
      }
      // Intentionally NOT searching for videos without a filePath
      // This prevents incorrectly marking videos as removed when we can't find them quickly
      // The backfill process will handle finding and updating these videos
    }

    return { videos: updatedVideos, updates };
  }

  /**
   * Apply database updates for video file status changes.
   *
   * @param {Object} sequelize - Sequelize instance
   * @param {Object} Sequelize - Sequelize library
   * @param {Array} updates - Array of update objects with id, fileSize, and/or removed properties
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