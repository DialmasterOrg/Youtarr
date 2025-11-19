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

    const targetSuffix = `[${videoId}].mp4`;
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

    return this.searchForVideoFile(baseDir, targetSuffix, visited);
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

        let fullPath = data._actual_filepath;

        if (!fullPath) {
          fullPath = await this.findVideoFilePath(data.id, preferredChannelName);

          if (fullPath) {
            logger.info({ filepath: fullPath, videoId: id }, 'Located video file path via filesystem search');
          }
        }

        if (!fullPath) {
          logger.warn({ videoId: id }, 'Video file path could not be determined from metadata or filesystem search');
          videoMetadata.filePath = null;
          videoMetadata.fileSize = null;
          videoMetadata.removed = false;
          processedVideos.push(videoMetadata);
          continue;
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
