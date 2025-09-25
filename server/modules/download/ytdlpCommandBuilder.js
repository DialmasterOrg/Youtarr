const path = require('path');
const configModule = require('../configModule');

// Use proper yt-dlp fallback syntax with comma separator
// Will use uploader, fall back to channel, then uploader_id
// The @ prefix from uploader_id will be handled by --replace-in-metadata
const CHANNEL_TEMPLATE = '%(uploader,channel,uploader_id)s';
const VIDEO_FOLDER_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title)s - %(id)s`;
const VIDEO_FILE_TEMPLATE = `${CHANNEL_TEMPLATE} - %(title)s  [%(id)s].%(ext)s`;

class YtdlpCommandBuilder {
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
  static getBaseCommandArgs(resolution) {
    const config = configModule.getConfig();
    const res = resolution || config.preferredResolution || '1080';
    const baseOutputPath = configModule.directoryPath;

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
      '-f', `bestvideo[height<=${res}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`,
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--download-archive', './config/complete.list',
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', 'duration>70 & availability!=subscriber_only',
      '-o', `${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/${VIDEO_FILE_TEMPLATE}`,
      '--datebefore', 'now',
      '-o', `thumbnail:${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/poster`,
      '-o', 'pl_thumbnail:',
      '--exec', `node ${path.resolve(__dirname, '../videoDownloadPostProcessFiles.js')} {}`
    ];

    // Add Sponsorblock args if configured
    const sponsorblockArgs = this.buildSponsorblockArgs(config);
    args.push(...sponsorblockArgs);

    return args;
  }

  // Build yt-dlp command args array for manual downloads - no duration filter
  static getBaseCommandArgsForManualDownload(resolution) {
    const config = configModule.getConfig();
    const res = resolution || config.preferredResolution || '1080';
    const baseOutputPath = configModule.directoryPath;

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
      '-f', `bestvideo[height<=${res}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`,
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '--download-archive', './config/complete.list',
      '--ignore-errors',
      '--embed-metadata',
      '--write-info-json',
      '--no-write-playlist-metafiles',
      '--extractor-args', 'youtubetab:tab=videos;sort=dd',
      '--match-filter', 'availability!=subscriber_only',
      '-o', `${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/${VIDEO_FILE_TEMPLATE}`,
      '--datebefore', 'now',
      '-o', `thumbnail:${baseOutputPath}/${CHANNEL_TEMPLATE}/${VIDEO_FOLDER_TEMPLATE}/poster`,
      '-o', 'pl_thumbnail:',
      '--exec', `node ${path.resolve(__dirname, '../videoDownloadPostProcessFiles.js')} {}`
    ];

    // Add Sponsorblock args if configured
    const sponsorblockArgs = this.buildSponsorblockArgs(config);
    args.push(...sponsorblockArgs);

    return args;
  }
}

module.exports = YtdlpCommandBuilder;