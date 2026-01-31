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

  static normalizeForDirectoryMatch(name) {
    if (!name) {
      return '';
    }

    const normalized = name
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');

    return normalized.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  static async searchForVideoFile(startDir, targetSuffix, visited) {
    const stack = [startDir];

    while (stack.length > 0) {
      const currentDir = stack.pop();

      if (visited.has(currentDir)) {
        continue;
      }

      visited.add(currentDir);

      let entries;
      try {
        entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
      } catch (err) {
        logger.debug({ err, currentDir }, 'Unable to read directory while locating video file');
        continue;
      }

      for (const entry of entries) {
        const entryPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          stack.push(entryPath);
        } else if (entry.isFile() && entry.name.endsWith(targetSuffix)) {
          return entryPath;
        }
      }
    }

    return null;
  }

  static async findVideoFilePath(videoId, preferredChannelName) {
    const baseDir = configModule.directoryPath;

    if (!baseDir || !fs.existsSync(baseDir)) {
      return null;
    }

    // Search for both .mp4 and .mp3 files (video and audio-only downloads)
    const suffixesToTry = [`[${videoId}].mp4`, `[${videoId}].mp3`];

    for (const targetSuffix of suffixesToTry) {
      const visited = new Set();

      if (preferredChannelName) {
        const normalizedTarget = this.normalizeForDirectoryMatch(preferredChannelName);

        try {
          const channelDirs = await fsPromises.readdir(baseDir, { withFileTypes: true });

          for (const dirent of channelDirs) {
            if (!dirent.isDirectory()) {
              continue;
            }

            const dirPath = path.join(baseDir, dirent.name);
            const normalizedDir = this.normalizeForDirectoryMatch(dirent.name);

            if (
              normalizedDir &&
              normalizedTarget &&
              (normalizedDir === normalizedTarget ||
                normalizedDir.includes(normalizedTarget) ||
                normalizedTarget.includes(normalizedDir))
            ) {
              const locatedPath = await this.searchForVideoFile(dirPath, targetSuffix, visited);
              if (locatedPath) {
                return locatedPath;
              }
            }
          }
        } catch (err) {
          logger.warn({ err, baseDir }, 'Error scanning channel directories while locating video file');
        }
      }

      const result = await this.searchForVideoFile(baseDir, targetSuffix, visited);
      if (result) {
        return result;
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
          normalized_rating: data.normalized_rating || null,
          rating_source: data.rating_source || null,
          filePath: null,
          fileSize: null,
          audioFilePath: null,
          audioFileSize: null,
          removed: false,
        };

        // Get file paths from JSON (supports dual-format downloads)
        let videoFilePath = data._actual_video_filepath || null;
        let audioFilePath = data._actual_audio_filepath || null;

        // Fallback: if only _actual_filepath exists (old format or single-file download)
        if (!videoFilePath && !audioFilePath && data._actual_filepath) {
          const ext = path.extname(data._actual_filepath).toLowerCase();
          if (ext === '.mp3') {
            audioFilePath = data._actual_filepath;
          } else {
            videoFilePath = data._actual_filepath;
          }
        }

        // If no paths found in JSON, try filesystem search
        if (!videoFilePath && !audioFilePath) {
          const foundPath = await this.findVideoFilePath(data.id, preferredChannelName);
          if (foundPath) {
            logger.info({ filepath: foundPath, videoId: id }, 'Located file path via filesystem search');
            const ext = path.extname(foundPath).toLowerCase();
            if (ext === '.mp3') {
              audioFilePath = foundPath;
            } else {
              videoFilePath = foundPath;
            }
          }
        }

        // If still no paths, log warning and continue
        if (!videoFilePath && !audioFilePath) {
          logger.warn({ videoId: id }, 'No file paths could be determined from metadata or filesystem search');
          processedVideos.push(videoMetadata);
          continue;
        }

        // Get video file info
        if (videoFilePath) {
          const videoStats = await this.waitForFile(videoFilePath);
          if (videoStats) {
            videoMetadata.filePath = videoFilePath;
            videoMetadata.fileSize = videoStats.size.toString();
            logger.info({ filepath: videoFilePath, fileSize: videoStats.size, videoId: id }, 'Found video file');
          } else {
            videoMetadata.filePath = videoFilePath; // Store expected path anyway
            logger.warn({ videoId: id, expectedPath: videoFilePath }, 'Video file not found after retries');
          }
        }

        // Get audio file info
        if (audioFilePath) {
          const audioStats = await this.waitForFile(audioFilePath);
          if (audioStats) {
            videoMetadata.audioFilePath = audioFilePath;
            videoMetadata.audioFileSize = audioStats.size.toString();
            logger.info({ filepath: audioFilePath, fileSize: audioStats.size, videoId: id }, 'Found audio file');
          } else {
            videoMetadata.audioFilePath = audioFilePath; // Store expected path anyway
            logger.warn({ videoId: id, expectedPath: audioFilePath }, 'Audio file not found after retries');
          }
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
