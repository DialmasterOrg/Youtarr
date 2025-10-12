const path = require('path');
const configModule = require('../configModule');
const tempPathManager = require('./tempPathManager');

// Use proper yt-dlp fallback syntax with comma separator
// Will use uploader, fall back to channel, then uploader_id
// The @ prefix from uploader_id will be handled by --replace-in-metadata
const CHANNEL_TEMPLATE = '%(uploader,channel,uploader_id)s';
const VIDEO_FOLDER_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title)s - %(id)s`;
const VIDEO_FILE_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title)s  [%(id)s].%(ext)s`;

class YtdlpCommandBuilder {
  // Build format string based on resolution and codec preference
  static buildFormatString(resolution, videoCodec = 'default') {
    const res = resolution || '1080';

    // Base format components
    const audioFormat = 'bestaudio[ext=m4a]';
    const fallbackMp4 = 'best[ext=mp4]';
    const ultimateFallback = 'best';

    let videoFormat;

    switch (videoCodec) {
    case 'h264':
      // Prefer H.264/AVC codec, fallback to any codec at preferred resolution, then fallback to best
      videoFormat = `bestvideo[height<=${res}][ext=mp4][vcodec^=avc]+${audioFormat}/bestvideo[height<=${res}][ext=mp4]+${audioFormat}/${fallbackMp4}/${ultimateFallback}`;
      break;

    case 'h265':
      // Prefer H.265/HEVC codec, fallback to any codec at preferred resolution, then fallback to best
      videoFormat = `bestvideo[height<=${res}][ext=mp4][vcodec^=hev]+${audioFormat}/bestvideo[height<=${res}][ext=mp4]+${audioFormat}/${fallbackMp4}/${ultimateFallback}`;
      break;

    case 'default':
    default:
      // Default behavior: no codec preference, just resolution and container
      videoFormat = `bestvideo[height<=${res}][ext=mp4]+${audioFormat}/${fallbackMp4}/${ultimateFallback}`;
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

  // Build yt-dlp command args array for channel downloads
  static getBaseCommandArgs(resolution, allowRedownload = false) {
    const config = configModule.getConfig();
    const res = resolution || config.preferredResolution || '1080';
    const videoCodec = config.videoCodec || 'default';

    // Use temp path if temp downloads are enabled, otherwise use final path
    const baseOutputPath = tempPathManager.isEnabled()
      ? tempPathManager.getTempBasePath()
      : configModule.directoryPath;

    // Add cookies args first if enabled
    const cookiesArgs = this.buildCookiesArgs();
    const args = [
      ...cookiesArgs,
      '-4',
      '--ffmpeg-location', configModule.ffmpegPath,
      '--socket-timeout', String(config.downloadSocketTimeoutSeconds || 30),
      '--throttled-rate', config.downloadThrottledRate || '100K',
      '--retries', String(config.downloadRetryCount || 2),
      '--fragment-retries', String(config.downloadRetryCount || 2),
      '--newline',
      '--progress',
      '--progress-template',
      '{"percent":"%(progress._percent_str)s","downloaded":"%(progress.downloaded_bytes|0)s","total":"%(progress.total_bytes|0)s","speed":"%(progress.speed|0)s","eta":"%(progress.eta|0)s"}',
      '--output-na-placeholder', 'Unknown Channel',
      // Clean @ prefix from uploader_id when it's used as fallback
      '--replace-in-metadata', 'uploader_id', '^@', '',
      '-f', this.buildFormatString(res, videoCodec),
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
    ];

    // Only use download archive if NOT allowing re-downloads
    if (!allowRedownload) {
      args.push('--download-archive', './config/complete.list');
    }

    args.push(
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', 'availability!=subscriber_only & !is_live & live_status!=is_upcoming',
      '-o', `${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/${VIDEO_FILE_TEMPLATE}`,
      '--datebefore', 'now',
      '-o', `thumbnail:${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/poster`,
      '-o', 'pl_thumbnail:',
      '--exec', `node ${path.resolve(__dirname, '../videoDownloadPostProcessFiles.js')} {}`
    );

    // Add Sponsorblock args if configured
    const sponsorblockArgs = this.buildSponsorblockArgs(config);
    args.push(...sponsorblockArgs);

    return args;
  }

  // Build yt-dlp command args array for manual downloads - no duration filter
  static getBaseCommandArgsForManualDownload(resolution, allowRedownload = false) {
    const config = configModule.getConfig();
    const res = resolution || config.preferredResolution || '1080';
    const videoCodec = config.videoCodec || 'default';

    // Use temp path if temp downloads are enabled, otherwise use final path
    const baseOutputPath = tempPathManager.isEnabled()
      ? tempPathManager.getTempBasePath()
      : configModule.directoryPath;

    // Add cookies args first if enabled
    const cookiesArgs = this.buildCookiesArgs();
    const args = [
      ...cookiesArgs,
      '-4',
      '--ffmpeg-location', configModule.ffmpegPath,
      '--socket-timeout', String(config.downloadSocketTimeoutSeconds || 30),
      '--throttled-rate', config.downloadThrottledRate || '100K',
      '--retries', String(config.downloadRetryCount || 2),
      '--fragment-retries', String(config.downloadRetryCount || 2),
      '--newline',
      '--progress',
      '--progress-template',
      '{"percent":"%(progress._percent_str)s","downloaded":"%(progress.downloaded_bytes|0)s","total":"%(progress.total_bytes|0)s","speed":"%(progress.speed|0)s","eta":"%(progress.eta|0)s"}',
      '--output-na-placeholder', 'Unknown Channel',
      // Clean @ prefix from uploader_id when it's used as fallback
      '--replace-in-metadata', 'uploader_id', '^@', '',
      '-f', this.buildFormatString(res, videoCodec),
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
    ];

    // Only use download archive if NOT allowing re-downloads
    if (!allowRedownload) {
      args.push('--download-archive', './config/complete.list');
    }

    args.push(
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', 'availability!=subscriber_only & !is_live & live_status!=is_upcoming',
      '-o', `${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/${VIDEO_FILE_TEMPLATE}`,
      '--datebefore', 'now',
      '-o', `thumbnail:${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/poster`,
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