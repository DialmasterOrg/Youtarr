const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const configModule = require('../configModule');
const logger = require('../../logger');

class VideoMetadataProcessor {
  static normalizeChannelName(value) {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    const upper = trimmed.toUpperCase();
    if (upper === 'NA' || upper === 'N/A') {
      return '';
    }
    return trimmed;
  }

  // Replicate yt-dlp's filename sanitization
  static sanitizeFilename(filename) {
    // yt-dlp replaces these characters with Unicode equivalents
    const replacements = {
      '|': '｜',  // U+FF5C (full-width vertical bar)
      '<': '＜',  // U+FF1C (full-width less-than)
      '>': '＞',  // U+FF1E (full-width greater-than)
      ':': '：',  // U+FF1A (full-width colon) - except for drive letters on Windows
      '"': '＂',  // U+FF02 (full-width quotation mark)
      '/': '／',  // U+FF0F (full-width slash)
      '\\': '＼', // U+FF3C (full-width backslash)
      '?': '？',  // U+FF1F (full-width question mark)
      '*': '＊',  // U+FF0A (full-width asterisk)
    };

    let result = filename;
    for (const [char, replacement] of Object.entries(replacements)) {
      result = result.split(char).join(replacement);
    }
    return result;
  }

  static async waitForFile(filePath, maxRetries = 4, initialDelayMs = 100) {
    let delayMs = initialDelayMs;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const stats = await fsPromises.stat(filePath);
        // Also check that the file has a non-zero size
        if (stats.size > 0) {
          return stats;
        }
        logger.debug({ filePath, delayMs, attempt: i + 1, maxRetries }, 'File found but size is 0, waiting for file to be written');
      } catch (err) {
        if (i < maxRetries - 1) {
          logger.debug({ filePath, delayMs, attempt: i + 1, maxRetries }, 'Waiting for file to be available');
        }
      }

      // Wait with exponential backoff if not the last attempt
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
      }
    }
    return null;
  }

  static async processVideoMetadata(newVideoUrls) {
    const processedVideos = [];

    for (const url of newVideoUrls) {
      const id = url.split('youtu.be/')[1].trim();
      const dataPath = path.join(
        configModule.getJobsPath(),
        `info/${id}.info.json`
      );
      logger.debug({ dataPath, videoId: id }, 'Looking for info.json file');

      if (fs.existsSync(dataPath)) {
        logger.debug({ dataPath, videoId: id }, 'Found info.json file');
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

        const preferredChannelName =
          this.normalizeChannelName(data.uploader) ||
          this.normalizeChannelName(data.channel) ||
          this.normalizeChannelName(data.uploader_id) ||
          this.normalizeChannelName(data.channel_id) ||
          'Unknown Channel';

        const videoMetadata = {
          youtubeId: data.id,
          youTubeChannelName: preferredChannelName,
          youTubeVideoName: data.title,
          duration: data.duration,
          description: data.description,
          originalDate: data.upload_date,
          channel_id: data.channel_id,
          media_type: data.media_type || 'video',
        };

        // First check if we have the actual filepath from yt-dlp
        let fullPath;
        if (data._actual_filepath) {
          // Use the actual filepath that yt-dlp provided
          logger.debug({ filepath: data._actual_filepath, videoId: id }, 'Using actual filepath from yt-dlp');
          fullPath = data._actual_filepath;
        } else {
          // Fallback: Calculate the file path based on the yt-dlp output template
          // Apply yt-dlp's filename sanitization to match the actual files on disk
          const baseOutputPath = configModule.directoryPath;
          const sanitizedChannelName = this.sanitizeFilename(preferredChannelName);
          const sanitizedTitle = this.sanitizeFilename(data.title);
          const videoFolder = `${sanitizedChannelName} - ${sanitizedTitle} - ${id}`;
          const videoFileName = `${sanitizedChannelName} - ${sanitizedTitle}  [${id}].mp4`;
          fullPath = path.join(baseOutputPath, sanitizedChannelName, videoFolder, videoFileName);
          logger.debug({ filepath: fullPath, videoId: id }, 'Using fallback filepath');
        }

        // Check if file exists and get file size - with retry logic for production environments
        let stats = await this.waitForFile(fullPath);

        if (stats) {
          videoMetadata.filePath = fullPath;
          videoMetadata.fileSize = stats.size.toString(); // Convert to string as DB expects BIGINT as string
          videoMetadata.removed = false;
          logger.info({ filepath: fullPath, fileSize: stats.size, videoId: id }, 'Found video file');
        } else {
          // File doesn't exist after retries
          logger.warn({ videoId: id, expectedPath: fullPath }, 'Video file not found after all retries');
          videoMetadata.filePath = fullPath; // Store expected path anyway
          videoMetadata.fileSize = null;
          videoMetadata.removed = false; // Assume it's not removed, just not found yet
        }

        processedVideos.push(videoMetadata);
      } else {
        logger.debug({ dataPath, videoId: id }, 'No info.json file found');
      }
    }

    return processedVideos;
  }
}

module.exports = VideoMetadataProcessor;