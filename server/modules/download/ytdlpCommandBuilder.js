const path = require('path');
const configModule = require('../configModule');
const tempPathManager = require('./tempPathManager');
const ratingMapper = require('../ratingMapper');
const {
  CHANNEL_TEMPLATE,
  VIDEO_FOLDER_TEMPLATE,
  VIDEO_FILE_TEMPLATE
} = require('../filesystem/constants');

class YtdlpCommandBuilder {
  /**
   * Build output path with optional subfolder support
   * Downloads always go to temp path first, then get moved to final location
   * @param {string|null} subFolder - Optional subfolder name
   * @returns {string} - Full output path template
   */
  static buildOutputPath(subFolder = null) {
    // Always use temp path - downloads are staged before moving to final location
    const baseOutputPath = tempPathManager.getTempBasePath();

    if (subFolder) {
      return path.join(baseOutputPath, subFolder, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, VIDEO_FILE_TEMPLATE);
    } else {
      return path.join(baseOutputPath, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, VIDEO_FILE_TEMPLATE);
    }
  }

  /**
   * Build thumbnail output path with optional subfolder support
   * Thumbnails are staged in temp path alongside videos
   * @param {string|null} subFolder - Optional subfolder name
   * @returns {string} - Thumbnail path template
   */
  static buildThumbnailPath(subFolder = null) {
    // Always use temp path - thumbnails are staged with videos
    const baseOutputPath = tempPathManager.getTempBasePath();

    // Use same filename as video file (without extension - yt-dlp adds .jpg)
    const thumbnailFilename = `${CHANNEL_TEMPLATE} - %(title).76B [%(id)s]`;

    if (subFolder) {
      return path.join(baseOutputPath, subFolder, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, thumbnailFilename);
    } else {
      return path.join(baseOutputPath, CHANNEL_TEMPLATE, VIDEO_FOLDER_TEMPLATE, thumbnailFilename);
    }
  }
  /**
   * Build format string based on resolution, codec preference, and audio format
   * @param {string} resolution - Video resolution (e.g., '1080', '720')
   * @param {string} videoCodec - Video codec preference ('h264', 'h265', 'default')
   * @param {string|null} audioFormat - Audio format ('mp3_only' for audio-only, null for video)
   * @returns {string} - Format string for yt-dlp -f argument
   */
  static buildFormatString(resolution, videoCodec = 'default', audioFormat = null) {
    // For MP3-only mode, we just need best audio
    if (audioFormat === 'mp3_only') {
      return 'bestaudio[ext=m4a]/bestaudio/best';
    }

    const res = resolution || '1080';

    // Base format components
    const audioFmt = 'bestaudio[ext=m4a]';
    const fallbackMp4 = 'best[ext=mp4]';
    const ultimateFallback = 'best';

    let videoFormat;

    switch (videoCodec) {
    case 'h264':
      // Prefer H.264/AVC codec, fallback to any codec at preferred resolution, then fallback to best
      videoFormat = `bestvideo[height<=${res}][ext=mp4][vcodec^=avc]+${audioFmt}/bestvideo[height<=${res}][ext=mp4]+${audioFmt}/${fallbackMp4}/${ultimateFallback}`;
      break;

    case 'h265':
      // Prefer H.265/HEVC codec, fallback to any codec at preferred resolution, then fallback to best
      videoFormat = `bestvideo[height<=${res}][ext=mp4][vcodec^=hev]+${audioFmt}/bestvideo[height<=${res}][ext=mp4]+${audioFmt}/${fallbackMp4}/${ultimateFallback}`;
      break;

    case 'default':
    default:
      // Default behavior: no codec preference, just resolution and container
      videoFormat = `bestvideo[height<=${res}][ext=mp4]+${audioFmt}/${fallbackMp4}/${ultimateFallback}`;
      break;
    }

    return videoFormat;
  }

  // Build Sponsorblock args based on configuration
  static buildSponsorblockArgs(config) {
    const args = [];

    if (!config.sponsorblockEnabled) return args;

    // Build categories list from enabled categories
    const enabledCategories = Object.entries(config.sponsorblockCategories || {})
      .filter(([, enabled]) => enabled)
      .map(([category]) => category);

    if (enabledCategories.length > 0) {
      const categoriesStr = enabledCategories.join(',');

      if (config.sponsorblockAction === 'remove') {
        args.push('--sponsorblock-remove', categoriesStr);
      } else if (config.sponsorblockAction === 'mark') {
        args.push('--sponsorblock-mark', categoriesStr);
      }
    }

    // Add custom API URL if specified
    if (config.sponsorblockApiUrl && config.sponsorblockApiUrl.trim()) {
      args.push('--sponsorblock-api', config.sponsorblockApiUrl.trim());
    }

    return args;
  }

  // Build cookies args for yt-dlp commands
  static buildCookiesArgs() {
    const cookiesPath = configModule.getCookiesPath();
    if (cookiesPath) {
      return ['--cookies', cookiesPath];
    }
    return [];
  }

  /**
   * Build audio extraction args for MP3 downloads
   * @param {string|null} audioFormat - 'video_mp3' or 'mp3_only', null for video only
   * @returns {string[]} - Array of yt-dlp arguments for audio extraction
   */
  static buildAudioArgs(audioFormat) {
    if (!audioFormat) {
      return [];
    }

    const args = [];

    if (audioFormat === 'mp3_only') {
      // Extract audio only, convert to MP3 at 192kbps
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', '192K');
    } else if (audioFormat === 'video_mp3') {
      // Keep video AND extract audio as MP3 at 192kbps
      args.push('--extract-audio', '--keep-video', '--audio-format', 'mp3', '--audio-quality', '192K');
    }

    return args;
  }

  /**
   * Build arguments that ALWAYS apply to any yt-dlp invocation
   * Includes: IPv4 enforcement, proxy, sleep-requests, and cookies
   * @param {Object} config - Configuration object
   * @param {Object} options - Options for building args
   * @param {boolean} options.skipSleepRequests - Skip adding --sleep-requests (for single metadata fetches)
   * @returns {string[]} - Array of common arguments
   */
  static buildCommonArgs(config, options = {}) {
    const { skipSleepRequests = false } = options;
    const args = [];

    // Always use IPv4
    // Note, I have found that this greatly improves reliability downloading from YouTube
    args.push('-4');

    // Add proxy if configured
    if (config.proxy && config.proxy.trim()) {
      args.push('--proxy', config.proxy.trim());
    }

    // Add sleep between requests (configurable)
    // Skip for single metadata fetches where rate limiting isn't needed
    if (!skipSleepRequests) {
      const sleepRequests = config.sleepRequests ?? 1;
      if (sleepRequests > 0) {
        args.push('--sleep-requests', String(sleepRequests));
      }
    }

    // Add cookies if configured
    const cookiesPath = configModule.getCookiesPath();
    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }

    return args;
  }

  /**
   * Build arguments for fetching metadata (channel info, video info, etc.)
   * @param {string} url - URL to fetch
   * @param {Object} options - Options object
   * @param {boolean} options.flatPlaylist - Fetch flat playlist info
   * @param {number} options.playlistEnd - Limit playlist items
   * @param {string} options.playlistItems - Specific playlist items
   * @param {string} options.extractorArgs - Extractor arguments
   * @param {boolean} options.skipSleepRequests - Skip sleep between requests (for single fetches)
   * @returns {string[]} - Complete args array
   */
  static buildMetadataFetchArgs(url, options = {}) {
    const config = configModule.getConfig();
    const args = [...this.buildCommonArgs(config, { skipSleepRequests: options.skipSleepRequests })];

    args.push('--skip-download', '--dump-single-json');

    if (options.flatPlaylist) {
      args.push('--flat-playlist');
    }

    if (options.playlistEnd !== undefined && options.playlistEnd !== null) {
      args.push('--playlist-end', String(options.playlistEnd));
    }

    if (options.playlistItems !== undefined && options.playlistItems !== null) {
      args.push('--playlist-items', String(options.playlistItems));
    }

    if (options.extractorArgs) {
      args.push('--extractor-args', options.extractorArgs);
    }

    args.push(url);
    return args;
  }

  /**
   * Build arguments for fetching metadata AND sanitized folder name in one call.
   * Combines --dump-single-json with --get-filename to output:
   *   <sanitized folder name>\n<JSON metadata>
   * For channels with no videos, only JSON is output (no folder name line).
   * @param {string} url - URL to fetch
   * @param {Object} options - Options object
   * @param {number} options.playlistEnd - Limit playlist items
   * @param {boolean} options.skipSleepRequests - Skip sleep between requests
   * @returns {string[]} - Complete args array
   */
  static buildMetadataWithFolderNameArgs(url, options = {}) {
    const config = configModule.getConfig();
    const args = [];
    args.push('--skip-download', '--dump-single-json', '--flat-playlist');
    if (options.playlistEnd !== undefined && options.playlistEnd !== null) {
      args.push('--playlist-end', String(options.playlistEnd));
    }

    args.push(...this.buildCommonArgs(config, { skipSleepRequests: options.skipSleepRequests }));

    args.push(url);
    return args;
  }

  /**
   * Build arguments for downloading thumbnails
   * @param {string} url - URL to fetch
   * @param {string} outputPath - Output path for thumbnail
   * @returns {string[]} - Complete args array
   */
  static buildThumbnailDownloadArgs(url, outputPath) {
    const config = configModule.getConfig();
    const args = [...this.buildCommonArgs(config)];

    args.push(
      '--skip-download',
      '--write-thumbnail',
      '--playlist-end', '1',
      '--playlist-items', '0',
      '--convert-thumbnails', 'jpg',
      '-o', outputPath,
      url
    );

    return args;
  }

  // Build subtitle args based on configuration
  static buildSubtitleArgs(config) {
    const args = [];

    if (!config.subtitlesEnabled) return args;

    const language = config.subtitleLanguage || 'en';

    args.push(
      '--write-sub',           // Download manual subtitles (preferred)
      '--write-auto-sub',      // Fallback to auto-generated if manual not available
      '--sub-langs', language,
      '--convert-subs', 'srt',
      '--sleep-subtitles', '2' // Add 2 second delay between subtitle requests to avoid rate limiting
    );

    return args;
  }

  /**
   * Build match filter string for yt-dlp based on channel filter configuration
   * @param {Object} filterConfig - ChannelFilterConfig instance with min_duration, max_duration, title_filter_regex
   * @returns {string} - Complete match filter string for yt-dlp
   */
  static buildMatchFilters(filterConfig = null) {
    const config = configModule.getConfig();
    // Base filters - always applied for channel downloads
    const baseFilters = [
      'availability!=subscriber_only',
      '!is_live',
      'live_status!=is_upcoming',
    ];

    // If no filter config provided or no filters set, return base filters only
    if (
      !filterConfig ||
      !filterConfig.hasFilters ||
      (typeof filterConfig.hasFilters === 'function' &&
        !filterConfig.hasFilters())
    ) {
      return baseFilters.join(' & ');
    }

    const additionalFilters = [];

    const maxRatingLimit = ratingMapper.getRatingAgeLimit(config.maxContentRating);
    if (maxRatingLimit !== null && maxRatingLimit !== undefined) {
      additionalFilters.push(`(age_limit is None or age_limit <= ${maxRatingLimit})`);
    }

    // Add duration filters if specified
    if (
      filterConfig.minDuration !== null &&
      filterConfig.minDuration !== undefined
    ) {
      additionalFilters.push(`duration >= ${filterConfig.minDuration}`);
    }
    if (
      filterConfig.maxDuration !== null &&
      filterConfig.maxDuration !== undefined
    ) {
      additionalFilters.push(`duration <= ${filterConfig.maxDuration + 59}`); // This way it captures the full minute (e.g. max 10 mins includes up to 10:59)
    }

    // Add title regex filter if specified
    if (filterConfig.titleFilterRegex) {
      // Escape backslashes and single quotes for Python string literal
      const escapedRegex = filterConfig.titleFilterRegex
        .replace(/\\/g, '\\\\') // Escape backslashes first
        // eslint-disable-next-line quotes
        .replace(/'/g, "\\'"); // Escape single quotes
      additionalFilters.push(`title ~= '${escapedRegex}'`);
    }

    // Combine all filters
    const allFilters = [...baseFilters, ...additionalFilters];
    return allFilters.join(' & ');
  }

  /**
   * Build yt-dlp command args array for channel downloads
   * @param {string} resolution - Video resolution
   * @param {boolean} allowRedownload - Allow re-downloading previously fetched videos
   * @param {string|null} subFolder - Subfolder for output
   * @param {Object|null} filterConfig - Channel filter configuration
   * @param {string|null} audioFormat - Audio format ('video_mp3', 'mp3_only', or null for video only)
   * @returns {string[]} - Array of yt-dlp command arguments
   */
  static getBaseCommandArgs(
    resolution,
    allowRedownload = false,
    subFolder = null,
    filterConfig = null,
    audioFormat = null
  ) {
    const config = configModule.getConfig();
    const res = resolution || config.preferredResolution || '1080';
    const videoCodec = config.videoCodec || 'default';

    const outputPath = this.buildOutputPath(subFolder);
    const thumbnailPath = this.buildThumbnailPath(subFolder);

    // Start with common args (includes -4, proxy, sleep-requests, cookies)
    const args = [
      ...this.buildCommonArgs(config),
      '--windows-filenames',  // Sanitize filenames for Windows/Plex compatibility
      '--ffmpeg-location', configModule.ffmpegPath,
      '--socket-timeout', String(config.downloadSocketTimeoutSeconds || 30),
      '--throttled-rate', config.downloadThrottledRate || '100K',
      '--retries', String(config.downloadRetryCount || 2),
      '--fragment-retries', String(config.downloadRetryCount || 2),
      '--extractor-retries', '3',  // Retry subtitle/metadata extraction (helps with 429 errors)
      '--retry-sleep', 'http:5',   // Sleep 5s on HTTP errors like 429 before retrying
      '--newline',
      '--progress',
      '--progress-template',
      '{"percent":"%(progress._percent_str)s","downloaded":"%(progress.downloaded_bytes|0)s","total":"%(progress.total_bytes|0)s","speed":"%(progress.speed|0)s","eta":"%(progress.eta|0)s"}',
      '--output-na-placeholder', 'Unknown Channel',
      // Clean @ prefix from uploader_id when it's used as fallback
      '--replace-in-metadata', 'uploader_id', '^@', '',
      '-f', this.buildFormatString(res, videoCodec, audioFormat),
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
    ];

    // Add audio extraction args if configured
    const audioArgs = this.buildAudioArgs(audioFormat);
    args.push(...audioArgs);

    // Add subtitle args if configured
    const subtitleArgs = this.buildSubtitleArgs(config);
    args.push(...subtitleArgs);

    // Only use download archive if NOT allowing re-downloads
    if (!allowRedownload) {
      args.push('--download-archive', './config/complete.list');
    }

    // Build match filter with any channel-specific filtering
    const matchFilter = this.buildMatchFilters(filterConfig);

    args.push(
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', matchFilter,
      '-o', outputPath,
      '--datebefore', 'now',
      '-o', `thumbnail:${thumbnailPath}`,
      '-o', 'pl_thumbnail:',
      '--exec', `node ${path.resolve(__dirname, '../videoDownloadPostProcessFiles.js')} {}`
    );

    // Add Sponsorblock args if configured
    const sponsorblockArgs = this.buildSponsorblockArgs(config);
    args.push(...sponsorblockArgs);

    return args;
  }

  /**
   * Build yt-dlp command args array for manual downloads - no duration filter
   * Note: Subfolder routing is handled post-download in videoDownloadPostProcessFiles.js
   * @param {string} resolution - Video resolution
   * @param {boolean} allowRedownload - Allow re-downloading previously fetched videos
   * @param {string|null} audioFormat - Audio format ('video_mp3', 'mp3_only', or null for video only)
   * @returns {string[]} - Array of yt-dlp command arguments
   */
  static getBaseCommandArgsForManualDownload(resolution, allowRedownload = false, audioFormat = null) {
    const config = configModule.getConfig();
    const res = resolution || config.preferredResolution || '1080';
    const videoCodec = config.videoCodec || 'default';

    const outputPath = this.buildOutputPath(null);
    const thumbnailPath = this.buildThumbnailPath(null);

    // Start with common args (includes -4, proxy, sleep-requests, cookies)
    const args = [
      ...this.buildCommonArgs(config),
      '--windows-filenames',  // Sanitize filenames for Windows/Plex compatibility
      '--ffmpeg-location', configModule.ffmpegPath,
      '--socket-timeout', String(config.downloadSocketTimeoutSeconds || 30),
      '--throttled-rate', config.downloadThrottledRate || '100K',
      '--retries', String(config.downloadRetryCount || 2),
      '--fragment-retries', String(config.downloadRetryCount || 2),
      '--extractor-retries', '3',  // Retry subtitle/metadata extraction (helps with 429 errors)
      '--retry-sleep', 'http:5',   // Sleep 5s on HTTP errors like 429 before retrying
      '--newline',
      '--progress',
      '--progress-template',
      '{"percent":"%(progress._percent_str)s","downloaded":"%(progress.downloaded_bytes|0)s","total":"%(progress.total_bytes|0)s","speed":"%(progress.speed|0)s","eta":"%(progress.eta|0)s"}',
      '--output-na-placeholder', 'Unknown Channel',
      // Clean @ prefix from uploader_id when it's used as fallback
      '--replace-in-metadata', 'uploader_id', '^@', '',
      '-f', this.buildFormatString(res, videoCodec, audioFormat),
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
    ];

    // Add audio extraction args if configured
    const audioArgs = this.buildAudioArgs(audioFormat);
    args.push(...audioArgs);

    // Add subtitle args if configured
    const subtitleArgs = this.buildSubtitleArgs(config);
    args.push(...subtitleArgs);

    // Only use download archive if NOT allowing re-downloads
    if (!allowRedownload) {
      args.push('--download-archive', './config/complete.list');
    }

    const matchFilter = this.buildMatchFilters();

    args.push(
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', matchFilter,
      '-o', outputPath,
      '--datebefore', 'now',
      '-o', `thumbnail:${thumbnailPath}`,
      '-o', 'pl_thumbnail:',
      '--exec', `node ${path.resolve(__dirname, '../videoDownloadPostProcessFiles.js')} {}`
    );

    // Add Sponsorblock args if configured
    const sponsorblockArgs = this.buildSponsorblockArgs(config);
    args.push(...sponsorblockArgs);

    return args;
  }
}

module.exports = YtdlpCommandBuilder;
