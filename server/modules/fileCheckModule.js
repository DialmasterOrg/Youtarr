const fs = require('fs').promises;
const path = require('path');
const { Video } = require('../models');
const { VIDEO_EXTENSIONS, AUDIO_EXTENSIONS } = require('./filesystem/constants');
const createLimiter = require('./subscriptionImport/concurrencyLimiter');

// Per-video checks run concurrently up to this bound: each stat costs a full
// round trip on network-backed mounts (NAS, WSL drvfs), so checking a
// 128-row page sequentially takes ~1s of wall time there.
const MAX_CONCURRENT_FILE_CHECKS = 16;

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
    const updatedVideos = [...videos];
    const limit = createLimiter(MAX_CONCURRENT_FILE_CHECKS);
    // One slot per video keeps `updates` in input order no matter which
    // check finishes first.
    const updateSlots = new Array(updatedVideos.length).fill(null);

    await Promise.all(updatedVideos.map((video, i) => limit(async () => {
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
        updateSlots[i] = update;
        updatedVideos[i] = {
          ...video,
          ...(update.filePath !== undefined && { filePath: update.filePath }),
          ...(update.fileSize !== undefined && { fileSize: update.fileSize.toString() }),
          ...(update.audioFilePath !== undefined && { audioFilePath: update.audioFilePath }),
          ...(update.audioFileSize !== undefined && { audioFileSize: update.audioFileSize.toString() }),
          ...(update.removed !== undefined && { removed: update.removed })
        };
      }
    })));

    return { videos: updatedVideos, updates: updateSlots.filter(Boolean) };
  }

  async applyVideoUpdates(updates) {
    for (const update of updates) {
      const attributes = {
        filePath: update.filePath,
        fileSize: update.fileSize,
        audioFilePath: update.audioFilePath,
        audioFileSize: update.audioFileSize,
        removed: update.removed,
      };

      if (Object.values(attributes).some((v) => v !== undefined)) {
        await Video.update(attributes, { where: { id: update.id } });
      }
    }
  }
}

module.exports = new FileCheckModule();
