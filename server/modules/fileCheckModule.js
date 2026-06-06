const fs = require('fs').promises;
const path = require('path');
const { VIDEO_EXTENSIONS, AUDIO_EXTENSIONS } = require('./filesystem/constants');

/**
 * Check file existence and update video metadata.
 * Real-time per-page check: stats the stored path, falls back to same-dir
 * same-basename files with any supported extension if the original is missing.
 */
class FileCheckModule {
  /**
   * Try the original path; if missing, try same-dir variants with every
   * extension in `extensionList`.
   *
   * Returns:
   *   { exists: true, replaced: false, path, size }     - original found
   *   { exists: true, replaced: true,  path, size }     - variant found
   *   { exists: false, statusKnown: true }              - definitively missing
   *   { exists: false, statusKnown: false }             - non-ENOENT error
   */
  async _findExistingMediaFile(originalPath, extensionList) {
    try {
      const stats = await fs.stat(originalPath);
      return { exists: true, replaced: false, path: originalPath, size: stats.size };
    } catch (err) {
      if (err.code !== 'ENOENT') {
        return { exists: false, statusKnown: false };
      }
      // ENOENT on the stored path; fall through to the same-dir extension scan.
    }

    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const extLower = ext.toLowerCase();
    const base = path.basename(originalPath, ext);

    for (const candidateExt of extensionList) {
      if (candidateExt.toLowerCase() === extLower) {
        continue;
      }
      const candidatePath = path.join(dir, base + candidateExt);
      try {
        const stats = await fs.stat(candidatePath);
        return { exists: true, replaced: true, path: candidatePath, size: stats.size };
      } catch (err) {
        if (err.code !== 'ENOENT') {
          return { exists: false, statusKnown: false };
        }
      }
    }

    return { exists: false, statusKnown: true };
  }

  async checkVideoFiles(videos) {
    const updates = [];
    const updatedVideos = [...videos];

    for (let i = 0; i < updatedVideos.length; i++) {
      const video = updatedVideos[i];
      const update = { id: video.id };
      let hasUpdates = false;
      let videoFileExists = false;
      let audioFileExists = false;
      let videoFileStatusKnown = !video.filePath;
      let audioFileStatusKnown = !video.audioFilePath;

      if (video.filePath) {
        const result = await this._findExistingMediaFile(video.filePath, VIDEO_EXTENSIONS);
        if (result.exists) {
          videoFileExists = true;
          videoFileStatusKnown = true;

          if (result.replaced) {
            update.filePath = result.path;
            update.fileSize = result.size;
            hasUpdates = true;
          } else if (video.fileSize !== result.size.toString()) {
            update.fileSize = result.size;
            hasUpdates = true;
          }
        } else {
          videoFileExists = false;
          videoFileStatusKnown = result.statusKnown;
        }
      }

      if (video.audioFilePath) {
        const result = await this._findExistingMediaFile(video.audioFilePath, AUDIO_EXTENSIONS);
        if (result.exists) {
          audioFileExists = true;
          audioFileStatusKnown = true;

          if (result.replaced) {
            update.audioFilePath = result.path;
            update.audioFileSize = result.size;
            hasUpdates = true;
          } else if (video.audioFileSize !== result.size.toString()) {
            update.audioFileSize = result.size;
            hasUpdates = true;
          }
        } else {
          audioFileExists = false;
          audioFileStatusKnown = result.statusKnown;
        }
      }

      const hasAnyPath = video.filePath || video.audioFilePath;
      const hasAnyFile = videoFileExists || audioFileExists;
      const canDetermineRemovedStatus = videoFileStatusKnown && audioFileStatusKnown;

      if (hasAnyPath && canDetermineRemovedStatus) {
        if (hasAnyFile && video.removed) {
          update.removed = false;
          hasUpdates = true;
        } else if (!hasAnyFile && !video.removed) {
          update.removed = true;
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        updates.push(update);
        updatedVideos[i] = {
          ...video,
          ...(update.filePath !== undefined && { filePath: update.filePath }),
          ...(update.fileSize !== undefined && { fileSize: update.fileSize.toString() }),
          ...(update.audioFilePath !== undefined && { audioFilePath: update.audioFilePath }),
          ...(update.audioFileSize !== undefined && { audioFileSize: update.audioFileSize.toString() }),
          ...(update.removed !== undefined && { removed: update.removed })
        };
      }
    }

    return { videos: updatedVideos, updates };
  }

  async applyVideoUpdates(sequelize, Sequelize, updates) {
    if (updates.length === 0) {
      return;
    }

    for (const update of updates) {
      const setClauses = [];
      const values = [];

      if (update.filePath !== undefined) {
        setClauses.push('filePath = ?');
        values.push(update.filePath);
      }
      if (update.fileSize !== undefined) {
        setClauses.push('fileSize = ?');
        values.push(update.fileSize);
      }
      if (update.audioFilePath !== undefined) {
        setClauses.push('audioFilePath = ?');
        values.push(update.audioFilePath);
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
