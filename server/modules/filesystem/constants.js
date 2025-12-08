/**
 * Shared constants for file and path operations
 * Single source of truth for all path-related constants
 */

/**
 * Prefix added to subfolder names for namespace safety
 * Subfolders are stored without this prefix in the database
 * but always have it when on the filesystem
 */
const SUBFOLDER_PREFIX = '__';

/**
 * Sentinel value for explicitly specifying "use global default subfolder"
 * This distinguishes from NULL which means "download to root" (backwards compatible)
 */
const GLOBAL_DEFAULT_SENTINEL = '##USE_GLOBAL_DEFAULT##';

/**
 * Sentinel value for explicitly specifying "download to root directory"
 * Used in manual downloads to override channel subfolder settings and download directly to root
 */
const ROOT_SENTINEL = '##ROOT##';

/**
 * Default video file extensions in priority order
 * Used when searching for video files with unknown extensions
 */
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.m4v', '.avi'];

/**
 * yt-dlp output template for channel folder name
 * Uses uploader with fallback to channel, then uploader_id
 */
const CHANNEL_TEMPLATE = '%(uploader,channel,uploader_id)s';

/**
 * yt-dlp output template for video folder name
 * Format: "ChannelName - VideoTitle - VideoID"
 * Title is truncated to 76 characters to avoid path length issues
 */
const VIDEO_FOLDER_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title).76s - %(id)s`;

/**
 * yt-dlp output template for video file name
 * Format: "ChannelName - VideoTitle [VideoID].ext"
 * Title is truncated to 76 characters to avoid path length issues
 */
const VIDEO_FILE_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title).76s [%(id)s].%(ext)s`;

/**
 * Pattern to extract YouTube video ID from filename
 * Matches [VideoID] where VideoID is 11 alphanumeric characters (including - and _)
 */
const YOUTUBE_ID_BRACKET_PATTERN = /\[([a-zA-Z0-9_-]{11})\]/;

/**
 * Pattern to extract YouTube video ID from directory name
 * Matches " - VideoID" at the end of directory name
 */
const YOUTUBE_ID_DASH_PATTERN = / - ([a-zA-Z0-9_-]{10,12})$/;

/**
 * Pattern to validate a YouTube video ID string
 */
const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,12}$/;

/**
 * Pattern to identify main video files (not fragments)
 * Matches [VideoID].mp4/mkv/webm but NOT .fXXX.mp4
 */
const MAIN_VIDEO_FILE_PATTERN = /\[[a-zA-Z0-9_-]{10,12}\]\.(mp4|mkv|webm)$/;

/**
 * Pattern to identify video fragment files (to exclude)
 */
const FRAGMENT_FILE_PATTERN = /\.f\d+\.(mp4|m4a|webm)$/;

module.exports = {
  SUBFOLDER_PREFIX,
  GLOBAL_DEFAULT_SENTINEL,
  ROOT_SENTINEL,
  VIDEO_EXTENSIONS,
  CHANNEL_TEMPLATE,
  VIDEO_FOLDER_TEMPLATE,
  VIDEO_FILE_TEMPLATE,
  YOUTUBE_ID_BRACKET_PATTERN,
  YOUTUBE_ID_DASH_PATTERN,
  YOUTUBE_ID_PATTERN,
  MAIN_VIDEO_FILE_PATTERN,
  FRAGMENT_FILE_PATTERN
};
