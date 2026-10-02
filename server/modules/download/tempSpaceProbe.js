// Decides which failed videos failed because the temporary download folder
// ran out of space. yt-dlp reports a merge that could not be written as a bare
// "Conversion failed!", so that case is recognized by measuring: a merge needs
// a second copy of the video's downloaded files, and they are still in temp
// when the finalizer runs this (before any cleanup). Never throws; anything it
// cannot measure is left unflagged.
const fsPromises = require('fs').promises;
const logger = require('../../logger');
const filesystem = require('../filesystem');
const tempPathManager = require('./tempPathManager');

const NO_SPACE_PATTERN = /no space left on device/i;
const CONVERSION_FAILED_PATTERN = /conversion failed/i;

// Free bytes available to the process, or null when the filesystem does not
// report a usable figure.
async function measureFreeBytes(dirPath) {
  try {
    const stats = await fsPromises.statfs(dirPath);
    if (!(stats.blocks > 0)) return null;
    const freeBytes = stats.bavail * stats.bsize;
    return Number.isFinite(freeBytes) ? freeBytes : null;
  } catch (err) {
    logger.debug({ err, dirPath }, 'Could not measure free space in the temporary download folder');
    return null;
  }
}

async function measureLeftoverBytes(youtubeId, destinations) {
  let total = 0;
  for (const destination of destinations) {
    if (filesystem.extractYoutubeIdFromPath(destination) !== youtubeId) continue;
    try {
      total += (await fsPromises.stat(destination)).size;
    } catch (err) {
      // Already gone; it holds no space.
    }
  }
  return total;
}

async function findOutOfSpaceFailures(failedVideos, partialDestinations) {
  const flagged = new Set();
  try {
    const candidates = (Array.isArray(failedVideos) ? failedVideos : []).filter((video) => {
      const error = String((video && video.error) || '');
      return video && video.youtubeId && (NO_SPACE_PATTERN.test(error) || CONVERSION_FAILED_PATTERN.test(error));
    });
    if (candidates.length === 0) return flagged;

    const tempPath = tempPathManager.getTempBasePath();
    const freeBytes = await measureFreeBytes(tempPath);
    const destinations = Array.from(partialDestinations || []);

    for (const video of candidates) {
      const leftoverBytes = await measureLeftoverBytes(video.youtubeId, destinations);
      const outOfSpace = NO_SPACE_PATTERN.test(String(video.error))
        || (freeBytes !== null && leftoverBytes > 0 && freeBytes < leftoverBytes);
      if (!outOfSpace) continue;

      flagged.add(video.youtubeId);
      logger.error(
        { youtubeId: video.youtubeId, tempPath, freeBytes, leftoverBytes },
        'Download failed because the temporary download folder is out of space'
      );
    }
  } catch (err) {
    logger.warn({ err }, 'Could not check whether failed downloads ran out of temporary space');
  }
  return flagged;
}

module.exports = { findOutOfSpaceFailures };
