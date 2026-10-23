/**
 * The info.json yt-dlp wrote for each downloaded video, kept at
 * jobs/info/<id>.info.json. The post-processor stores the video's final paths
 * in it (_actual_filepath and friends), which job recovery and the metadata
 * processor read back, so anything that moves a video's files rewrites them.
 */

const fs = require('fs');
const path = require('path');
const configModule = require('./configModule');
const logger = require('../logger');

const ACTUAL_PATH_FIELDS = ['_actual_filepath', '_actual_video_filepath', '_actual_audio_filepath'];

function infoJsonPath(youtubeId) {
  return path.join(configModule.getJobsPath(), 'info', `${youtubeId}.info.json`);
}

/**
 * @param {string} youtubeId
 * @returns {Promise<Object|null>} null when the file is missing or unreadable
 */
async function readInfo(youtubeId) {
  try {
    return JSON.parse(await fs.promises.readFile(infoJsonPath(youtubeId), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn({ err, youtubeId }, 'Could not read the stored info.json');
    }
    return null;
  }
}

/**
 * A video's info dict: the stored info.json, or what its videos row knows
 * when that file is gone. A missing upload date is filled from the row.
 *
 * @param {Object} video - videos row (youtubeId, youTubeVideoName, youTubeChannelName, originalDate)
 * @returns {Promise<Object>}
 */
async function readInfoOrFallback(video) {
  const stored = await readInfo(video.youtubeId);
  const info = stored || {
    id: video.youtubeId,
    title: video.youTubeVideoName,
    uploader: video.youTubeChannelName,
    channel: video.youTubeChannelName,
  };
  if (!Number.isFinite(info.timestamp) && !info.upload_date && video.originalDate) {
    return { ...info, upload_date: video.originalDate };
  }
  return info;
}

/**
 * Replace stored final paths that point at moved files.
 * @param {string} youtubeId
 * @param {Map<string, string>} moves - old path -> new path
 * @returns {Promise<boolean>} true when the file was rewritten
 */
async function rewriteActualPaths(youtubeId, moves) {
  const info = await readInfo(youtubeId);
  if (!info) return false;
  let changed = false;
  for (const field of ACTUAL_PATH_FIELDS) {
    const current = info[field];
    if (typeof current === 'string' && moves.has(current)) {
      info[field] = moves.get(current);
      changed = true;
    }
  }
  if (!changed) return false;
  await fs.promises.writeFile(infoJsonPath(youtubeId), JSON.stringify(info, null, 2));
  return true;
}

module.exports = {
  ACTUAL_PATH_FIELDS,
  infoJsonPath,
  readInfo,
  readInfoOrFallback,
  rewriteActualPaths
};
