const { Video } = require('../models');
const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');
const configModule = require('./configModule');
const ytDlpRunner = require('./ytDlpRunner');
const logger = require('../logger');

const NULL_METADATA = {
  description: null,
  viewCount: null,
  likeCount: null,
  commentCount: null,
  tags: null,
  categories: null,
  uploadDate: null,
  resolution: null,
  width: null,
  height: null,
  fps: null,
  aspectRatio: null,
  language: null,
  isLive: null,
  wasLive: null,
  availability: null,
  channelFollowerCount: null,
  ageLimit: null,
  webpageUrl: null,
  relatedFiles: null,
  availableResolutions: null,
  downloadedTier: null,
};

const YTDLP_FETCH_TIMEOUT_MS = 60000;

const SUPPORTED_HEIGHTS = [360, 480, 720, 1080, 1440, 2160];

const FILE_EXTENSION_CATEGORIES = {
  '.jpg': 'Thumbnail', '.jpeg': 'Thumbnail', '.png': 'Thumbnail', '.webp': 'Thumbnail',
  '.nfo': 'NFO Metadata',
  '.srt': 'Subtitles', '.vtt': 'Subtitles', '.ass': 'Subtitles',
  '.info.json': 'Info JSON',
  '.json': 'Info JSON',
};

class VideoMetadataModule {
  constructor() {}

  /**
   * Get extended video metadata from cached .info.json or by fetching via yt-dlp.
   * Returns a curated subset of fields. Silently backfills originalDate when
   * the .info.json has a more accurate upload_date than the existing DB record.
   * @param {string} youtubeId - YouTube video ID
   * @returns {Promise<Object>} Curated metadata object (all null on failure)
   */
  async getVideoMetadata(youtubeId) {
    try {
      const infoDir = path.join(configModule.getJobsPath(), 'info');
      const infoPath = path.join(infoDir, `${youtubeId}.info.json`);

      let rawData = null;

      // Try reading cached .info.json from disk
      try {
        await fs.access(infoPath);
        const content = await fs.readFile(infoPath, 'utf8');
        rawData = JSON.parse(content);
      } catch {
        // Not cached - fetch via yt-dlp
        logger.debug({ youtubeId }, 'No cached .info.json, fetching via yt-dlp');
        try {
          rawData = await ytDlpRunner.fetchMetadata(
            `https://www.youtube.com/watch?v=${youtubeId}`,
            YTDLP_FETCH_TIMEOUT_MS
          );

          // Cache the result for future requests
          try {
            await fs.mkdir(infoDir, { recursive: true });
            await fs.writeFile(infoPath, JSON.stringify(rawData, null, 2), 'utf8');
            logger.debug({ youtubeId }, 'Cached .info.json from yt-dlp fetch');
          } catch (cacheErr) {
            logger.warn({ err: cacheErr, youtubeId }, 'Failed to cache .info.json');
          }
        } catch (fetchErr) {
          logger.warn({ err: fetchErr, youtubeId }, 'Failed to fetch metadata via yt-dlp');
          return NULL_METADATA;
        }
      }

      if (!rawData) {
        return NULL_METADATA;
      }

      // Silently backfill originalDate if yt-dlp has a more accurate value
      if (rawData.upload_date) {
        try {
          const video = await Video.findOne({ where: { youtubeId } });
          if (video) {
            const dbDate = video.originalDate;
            const ytDate = rawData.upload_date; // YYYYMMDD format
            // Backfill if DB has no date, or if yt-dlp date is different (more accurate)
            if (!dbDate || dbDate !== ytDate) {
              await video.update({ originalDate: ytDate });
              logger.debug({ youtubeId, oldDate: dbDate, newDate: ytDate }, 'Backfilled originalDate from metadata');
            }
          }
        } catch (backfillErr) {
          logger.warn({ err: backfillErr, youtubeId }, 'Failed to backfill originalDate');
        }
      }

      // Use the numeric aspect_ratio from yt-dlp (e.g. 1.78 for 16:9)
      const aspectRatio = rawData.aspect_ratio ?? null;

      // Collect related files on disk (thumbnail, subtitles, nfo, etc.)
      const relatedFiles = await this._getVideoRelatedFiles(youtubeId);

      // Extract available resolutions from the formats array
      const availableResolutions = this._extractAvailableResolutions(rawData.formats);

      // Extract downloaded tier from top-level format_note (e.g. "1080p+medium" -> 1080).
      // This is the YouTube quality tier, which differs from the actual pixel height
      // for non-16:9 aspect ratios (e.g. a 2:1 video's "1080p" tier has 960 actual height).
      const downloadedTier = this._extractTierFromFormatNote(rawData.format_note);

      return {
        description: rawData.description ?? null,
        viewCount: rawData.view_count ?? null,
        likeCount: rawData.like_count ?? null,
        commentCount: rawData.comment_count ?? null,
        tags: rawData.tags ?? null,
        categories: rawData.categories ?? null,
        uploadDate: rawData.upload_date ?? null,
        resolution: rawData.resolution ?? null,
        width: rawData.width ?? null,
        height: rawData.height ?? null,
        fps: rawData.fps ?? null,
        aspectRatio,
        language: rawData.language ?? null,
        isLive: rawData.is_live ?? null,
        wasLive: rawData.was_live ?? null,
        availability: rawData.availability ?? null,
        channelFollowerCount: rawData.channel_follower_count ?? null,
        ageLimit: rawData.age_limit ?? null,
        webpageUrl: rawData.webpage_url ?? null,
        relatedFiles,
        availableResolutions,
        downloadedTier,
      };
    } catch (err) {
      logger.error({ err, youtubeId }, 'Unexpected error in getVideoMetadata');
      return NULL_METADATA;
    }
  }

  /**
   * Find all related files for a video on disk (thumbnail, subtitles, nfo, etc.).
   * Uses the same YouTube ID matching pattern as videoDeletionModule:
   * files containing [youtubeId] or " - youtubeId" in the name.
   * Excludes the main video and audio files (those are shown separately).
   * Returns only fileName, fileSize, and type - internal paths are stripped.
   */
  async _getVideoRelatedFiles(youtubeId) {
    try {
      const video = await Video.findOne({ where: { youtubeId } });
      if (!video || !video.filePath) return null;

      const videoDir = path.dirname(video.filePath);

      let files;
      try {
        files = await fs.readdir(videoDir);
      } catch {
        return null;
      }

      // Filter to files belonging to this video
      const matchingFiles = files.filter(
        file => file.includes(`[${youtubeId}]`) || file.includes(` - ${youtubeId}`)
      );

      // Get file stats and categorize
      const result = [];
      const mainVideoBase = video.filePath ? path.basename(video.filePath) : null;
      const mainAudioBase = video.audioFilePath ? path.basename(video.audioFilePath) : null;

      for (const fileName of matchingFiles) {
        // Skip the main video and audio files (shown separately in the Files section)
        if (fileName === mainVideoBase || fileName === mainAudioBase) continue;

        const fullPath = path.join(videoDir, fileName);
        try {
          const stat = await fs.stat(fullPath);
          const ext = path.extname(fileName).toLowerCase();
          result.push({
            fileName,
            fileSize: stat.size,
            type: this._categorizeFileExtension(ext),
          });
        } catch {
          // File may have been removed between readdir and stat
        }
      }

      return result.length > 0 ? result : null;
    } catch (err) {
      logger.warn({ err, youtubeId }, 'Failed to list related video files');
      return null;
    }
  }

  /**
   * Extract available download resolutions from the yt-dlp formats array.
   * Only returns resolutions we support downloading (360p-2160p).
   *
   * Prefers format_note (e.g. "1080p") over raw height because for non-16:9
   * aspect ratios the actual pixel height differs from the quality tier label
   * (e.g. a 2:1 video's "1080p" format has 960 actual height, not 1080).
   * Falls back to height when format_note isn't present or parseable.
   */
  _extractAvailableResolutions(formats) {
    if (!Array.isArray(formats) || formats.length === 0) return null;

    const availableTiers = new Set();

    for (const fmt of formats) {
      if (!fmt.vcodec || fmt.vcodec === 'none') continue;

      let tier = this._extractTierFromFormatNote(fmt.format_note);
      if (tier === null && fmt.height) {
        tier = fmt.height;
      }

      if (tier !== null && SUPPORTED_HEIGHTS.includes(tier)) {
        availableTiers.add(tier);
      }
    }

    if (availableTiers.size === 0) return null;

    return [...availableTiers].sort((a, b) => a - b);
  }

  /**
   * Parse a YouTube quality tier from a yt-dlp format_note string.
   * Examples: "1080p" -> 1080, "1080p60" -> 1080, "1080p+medium" -> 1080.
   * Returns null if the string isn't present or doesn't start with a tier.
   */
  _extractTierFromFormatNote(formatNote) {
    if (!formatNote || typeof formatNote !== 'string') return null;
    const match = formatNote.match(/^(\d+)p/);
    return match ? parseInt(match[1], 10) : null;
  }

  _categorizeFileExtension(ext) {
    return FILE_EXTENSION_CATEGORIES[ext] || 'Other';
  }

  /**
   * Resolve stream info for a video file (video or audio).
   * Looks up the video in the database, checks the file exists on disk,
   * and returns the path, content type, and file size.
   * @param {string} youtubeId - YouTube video ID
   * @param {string} type - 'video' or 'audio'
   * @returns {Promise<{filePath: string, contentType: string, fileSize: number}|null>}
   *   Returns null if video not found; throws with a message property for specific error cases.
   */
  async getVideoStreamInfo(youtubeId, type) {
    const MIME_TYPES = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mkv': 'video/x-matroska',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.ogg': 'audio/ogg',
    };
    const DEFAULT_MIME_TYPE = 'application/octet-stream';

    const video = await Video.findOne({ where: { youtubeId } });

    if (!video) {
      return { error: 'not_found', message: 'Video not found' };
    }

    const filePath = type === 'audio' ? video.audioFilePath : video.filePath;

    if (!filePath) {
      return { error: 'no_file', message: `No ${type} file available for this video` };
    }

    // Verify file exists on disk
    try {
      fsSync.accessSync(filePath, fsSync.constants.R_OK);
    } catch {
      return { error: 'file_missing', message: 'File not found on disk' };
    }

    const stat = fsSync.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || DEFAULT_MIME_TYPE;

    return {
      filePath,
      contentType,
      fileSize: stat.size,
    };
  }
}

module.exports = new VideoMetadataModule();
