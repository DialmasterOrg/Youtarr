/**
 * Path building utilities for constructing file and directory paths
 * Pure functions with no I/O - all path construction logic centralized here
 */

const path = require('path');
const {
  SUBFOLDER_PREFIX,
  GLOBAL_DEFAULT_SENTINEL,
  CHANNEL_TEMPLATE,
  VIDEO_FOLDER_TEMPLATE,
  VIDEO_FILE_TEMPLATE,
  YOUTUBE_ID_BRACKET_PATTERN,
  YOUTUBE_ID_DASH_PATTERN,
  YOUTUBE_ID_PATTERN
} = require('./constants');

/**
 * Build the filesystem segment for a subfolder (adds __ prefix)
 * @param {string|null} subfolderName - The subfolder name (without prefix)
 * @returns {string|null} - The prefixed subfolder segment or null
 */
function buildSubfolderSegment(subfolderName) {
  if (!subfolderName || subfolderName.trim() === '') {
    return null;
  }
  return `${SUBFOLDER_PREFIX}${subfolderName.trim()}`;
}

/**
 * Check if a directory name is a subfolder (starts with __ prefix)
 * @param {string} dirName - The directory name to check
 * @returns {boolean} - True if it's a subfolder directory
 */
function isSubfolderDirectory(dirName) {
  if (!dirName) {
    return false;
  }
  return dirName.startsWith(SUBFOLDER_PREFIX);
}

/**
 * Extract the subfolder name from a prefixed directory name
 * @param {string} dirName - The prefixed directory name (e.g., "__MySubfolder")
 * @returns {string|null} - The subfolder name without prefix, or null
 */
function extractSubfolderName(dirName) {
  if (!isSubfolderDirectory(dirName)) {
    return null;
  }
  return dirName.substring(SUBFOLDER_PREFIX.length);
}

/**
 * Resolve the effective subfolder for a channel
 * Handles the three-state logic:
 * - GLOBAL_DEFAULT_SENTINEL -> use global default
 * - non-empty string -> use that subfolder
 * - null/empty -> null (download to root, backwards compatible)
 *
 * @param {string|null} channelSubFolder - The channel's sub_folder DB value
 * @param {string|null} globalDefault - The global default subfolder from config
 * @returns {string|null} - The actual subfolder to use (without __ prefix), or null for root
 */
function resolveEffectiveSubfolder(channelSubFolder, globalDefault = null) {
  // Explicit "use global default" setting
  if (channelSubFolder === GLOBAL_DEFAULT_SENTINEL) {
    return globalDefault || null;
  }

  // Explicit subfolder set - use it
  if (channelSubFolder && channelSubFolder.trim() !== '') {
    return channelSubFolder.trim();
  }

  // NULL or empty - use root (backwards compatible)
  return null;
}

/**
 * Get the folder name to use for a channel
 * Prefers folder_name (sanitized by yt-dlp) over uploader
 * @param {Object} channel - Channel object with folder_name and uploader properties
 * @returns {string} - The folder name to use
 */
function resolveChannelFolderName(channel) {
  return channel.folder_name || channel.uploader;
}

/**
 * Build the full path to a channel directory
 * @param {string} baseDir - The base output directory
 * @param {string|null} subfolder - The subfolder name (without prefix) or null
 * @param {string} channelFolderName - The channel folder name
 * @returns {string} - Full path to the channel directory
 */
function buildChannelPath(baseDir, subfolder, channelFolderName) {
  if (subfolder) {
    const subfolderSegment = buildSubfolderSegment(subfolder);
    return path.join(baseDir, subfolderSegment, channelFolderName);
  }
  return path.join(baseDir, channelFolderName);
}

/**
 * Build the full path to a video directory
 * @param {string} baseDir - The base output directory
 * @param {string|null} subfolder - The subfolder name (without prefix) or null
 * @param {string} channelFolderName - The channel folder name
 * @param {string} videoFolderName - The video folder name
 * @returns {string} - Full path to the video directory
 */
function buildVideoPath(baseDir, subfolder, channelFolderName, videoFolderName) {
  const channelPath = buildChannelPath(baseDir, subfolder, channelFolderName);
  return path.join(channelPath, videoFolderName);
}

/**
 * Build yt-dlp output template for video files
 * @param {string} baseDir - The base output directory
 * @param {string|null} subfolder - The subfolder name (without prefix) or null
 * @returns {string} - Path template for yt-dlp -o argument
 */
function buildOutputTemplate(baseDir, subfolder) {
  if (subfolder) {
    const subfolderSegment = buildSubfolderSegment(subfolder);
    return path.join(baseDir, subfolderSegment, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, VIDEO_FILE_TEMPLATE);
  }
  return path.join(baseDir, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, VIDEO_FILE_TEMPLATE);
}

/**
 * Build yt-dlp thumbnail output template
 * @param {string} baseDir - The base output directory
 * @param {string|null} subfolder - The subfolder name (without prefix) or null
 * @returns {string} - Thumbnail path template for yt-dlp
 */
function buildThumbnailTemplate(baseDir, subfolder) {
  if (subfolder) {
    const subfolderSegment = buildSubfolderSegment(subfolder);
    return path.join(baseDir, subfolderSegment, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, 'poster');
  }
  return path.join(baseDir, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, 'poster');
}

/**
 * Extract YouTube video ID from a file path
 * Tries [VideoID] pattern in filename first, then " - VideoID" in directory name
 * @param {string} filePath - The file path to extract from
 * @returns {string|null} - The video ID or null if not found
 */
function extractYoutubeIdFromPath(filePath) {
  try {
    const filename = path.basename(filePath);

    // Try to extract from [VideoID].ext pattern in filename
    const bracketMatch = filename.match(YOUTUBE_ID_BRACKET_PATTERN);
    if (bracketMatch) {
      return bracketMatch[1];
    }

    // Try to extract from directory name ending with " - VideoID"
    const dirname = path.basename(path.dirname(filePath));
    const dashMatch = dirname.match(YOUTUBE_ID_DASH_PATTERN);
    if (dashMatch) {
      return dashMatch[1];
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if a string is a valid YouTube video ID
 * @param {string} str - The string to check
 * @returns {boolean} - True if valid YouTube ID format
 */
function isValidYoutubeId(str) {
  return YOUTUBE_ID_PATTERN.test(str);
}

/**
 * Calculate the new path after moving from oldBase to newBase
 * Used when relocating files after a subfolder change
 * @param {string} oldBasePath - The old base path
 * @param {string} newBasePath - The new base path
 * @param {string} originalPath - The original full path
 * @returns {string|null} - The new path, or null if originalPath doesn't start with oldBasePath
 */
function calculateRelocatedPath(oldBasePath, newBasePath, originalPath) {
  if (!originalPath || !originalPath.startsWith(oldBasePath)) {
    return null;
  }
  const relativePath = originalPath.substring(oldBasePath.length);
  return newBasePath + relativePath;
}

module.exports = {
  buildSubfolderSegment,
  isSubfolderDirectory,
  extractSubfolderName,
  resolveEffectiveSubfolder,
  resolveChannelFolderName,
  buildChannelPath,
  buildVideoPath,
  buildOutputTemplate,
  buildThumbnailTemplate,
  extractYoutubeIdFromPath,
  isValidYoutubeId,
  calculateRelocatedPath
};
