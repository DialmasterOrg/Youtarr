// Disk cleanup for download jobs: in-progress video directories tracked in
// JobVideoDownload, and yt-dlp .part/fragment leftovers.
const path = require('path');
const fsPromises = require('fs').promises;
const logger = require('../../logger');
const filesystem = require('../filesystem');
const configModule = require('../configModule');
const tempPathManager = require('./tempPathManager');
const { JobVideoDownload } = require('../../models');

// Cleanup function for in-progress videos based on database tracking
async function cleanupInProgressVideos(jobId) {
  try {
    // Query database for in-progress videos for this job
    const inProgressVideos = await JobVideoDownload.findAll({
      where: {
        job_id: jobId,
        status: 'in_progress'
      }
    });

    if (inProgressVideos.length === 0) {
      logger.info('No in-progress videos to clean up');
      return;
    }

    logger.info({ count: inProgressVideos.length }, 'Cleaning up in-progress videos');

    for (const videoDownload of inProgressVideos) {
      const videoDir = videoDownload.file_path;

      try {
        // Check both final location and temp location for incomplete downloads
        const pathsToCheck = [videoDir];
        // Only convert to temp path if not already a temp path (avoids double-nesting)
        if (!tempPathManager.isTempPath(videoDir)) {
          const tempDir = tempPathManager.convertFinalToTemp(videoDir);
          pathsToCheck.push(tempDir);
        }

        let cleanedAny = false;
        let foundExistingPath = false;

        for (const dirPath of pathsToCheck) {
          // Verify directory exists and is a video-specific directory
          const dirExists = await fsPromises.access(dirPath).then(() => true).catch(() => false);
          if (!dirExists) {
            logger.info({ dirPath }, 'Directory does not exist');
            continue;
          }

          foundExistingPath = true;

          if (!filesystem.isVideoDirectory(dirPath)) {
            // Flat mode (no video subfolder) - only delete files matching the youtube ID
            const youtubeId = videoDownload.youtube_id;
            logger.info({ youtubeId, dirPath }, 'Flat structure detected, cleaning up individual files');

            const dirFiles = await fsPromises.readdir(dirPath);
            for (const fileName of dirFiles) {
              // Match files by YouTube ID: bracketed form [ID] is the yt-dlp default;
              // dash form " - ID" is a fallback for non-standard naming patterns
              if (fileName.includes(`[${youtubeId}]`) || fileName.includes(` - ${youtubeId}`)) {
                const fullPath = path.join(dirPath, fileName);
                try {
                  const stats = await fsPromises.stat(fullPath);
                  if (stats.isFile()) {
                    await fsPromises.unlink(fullPath);
                    logger.info({ fileName }, 'Removed file (flat mode)');
                  }
                } catch (fileError) {
                  logger.error({ err: fileError, fileName }, 'Error removing file (flat mode)');
                }
              }
            }
            cleanedAny = true;
            continue;
          }

          logger.info({ youtubeId: videoDownload.youtube_id, dirPath }, 'Cleaning up in-progress video');

          // Remove all files in the directory
          const dirFiles = await fsPromises.readdir(dirPath);
          for (const fileName of dirFiles) {
            const fullPath = path.join(dirPath, fileName);
            try {
              const stats = await fsPromises.stat(fullPath);
              if (stats.isFile()) {
                await fsPromises.unlink(fullPath);
                logger.info({ fileName }, 'Removed file');
              } else if (stats.isDirectory()) {
                await fsPromises.rm(fullPath, { recursive: true, force: true });
                logger.info({ fileName }, 'Removed subdirectory');
              }
            } catch (fileError) {
              logger.error({ err: fileError, fileName }, 'Error removing file');
            }
          }

          // Remove the now-empty video directory
          await fsPromises.rmdir(dirPath);
          logger.info({ dirPath }, 'Successfully removed video directory');
          cleanedAny = true;

          // Check if parent channel directory is now empty and should be removed
          const channelDir = path.dirname(dirPath);
          await filesystem.cleanupEmptyChannelDirectory(channelDir, configModule.directoryPath);
        }

        if (!foundExistingPath) {
          logger.info({ youtubeId: videoDownload.youtube_id }, 'All candidate directories already removed');
          await videoDownload.destroy();
          continue;
        }

        // Remove the tracking entry from database if we cleaned any paths
        if (cleanedAny) {
          await videoDownload.destroy();
        }
      } catch (error) {
        logger.error({ err: error, youtubeId: videoDownload.youtube_id }, 'Error cleaning up video');
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Error querying in-progress videos for cleanup');
  }
}

// Removes yt-dlp .part and fragment leftovers after failed runs.
async function cleanupPartialFiles(files) {
  for (const file of files) {
    try {
      const dir = path.dirname(file);

      // Check for partial files
      const partFile = file + '.part';

      // Remove .part file
      if (await fsPromises.access(partFile).then(() => true).catch(() => false)) {
        await fsPromises.unlink(partFile);
        logger.info({ partFile }, 'Cleaned up partial file');
      }

      // Remove fragment files
      try {
        const dirFiles = await fsPromises.readdir(dir);
        const basename = path.basename(file).replace(/\.[^.]+$/, '');

        for (const f of dirFiles) {
          if (f.startsWith(basename + '.f')) {
            await fsPromises.unlink(path.join(dir, f));
            logger.info({ fragment: f }, 'Cleaned up fragment');
          }
        }
      } catch (readDirError) {
        if (readDirError.code === 'ENOENT') {
          logger.debug({ err: readDirError, dir }, 'Partial file directory already removed');
        } else {
          logger.error({ err: readDirError, dir }, 'Error reading directory');
        }
      }
    } catch (error) {
      logger.error({ err: error, file }, 'Error cleaning up partial files');
    }
  }
}

module.exports = { cleanupInProgressVideos, cleanupPartialFiles };
