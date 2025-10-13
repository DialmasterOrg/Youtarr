const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const configModule = require('../configModule');

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
        console.log(`File found but size is 0, waiting ${delayMs}ms... (attempt ${i + 1}/${maxRetries})`);
      } catch (err) {
        if (i < maxRetries - 1) {
          console.log(`Waiting ${delayMs}ms for file to be available... (attempt ${i + 1}/${maxRetries})`);
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
      console.log('Looking for info.json file at', dataPath);

      if (fs.existsSync(dataPath)) {
        console.log('Found info.json file at', dataPath);
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
          console.log(`Using actual filepath from yt-dlp: ${data._actual_filepath}`); // DEBUG TO REMOVE LATER
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
          console.log(`Using fallback filepath: ${fullPath}`); // DEBUG TO REMOVE LATER
        }

        // Check if file exists and get file size - with retry logic for production environments
        let stats = await this.waitForFile(fullPath);

        if (stats) {
          videoMetadata.filePath = fullPath;
          videoMetadata.fileSize = stats.size.toString(); // Convert to string as DB expects BIGINT as string
          videoMetadata.removed = false;
          console.log(`Found video file at ${fullPath}, size: ${stats.size} bytes`);
        } else {
          // File doesn't exist after retries
          console.log(`WARNING: Video file not found after all retries for ${id}`);
          videoMetadata.filePath = fullPath; // Store expected path anyway
          videoMetadata.fileSize = null;
          videoMetadata.removed = false; // Assume it's not removed, just not found yet
        }

        processedVideos.push(videoMetadata);
      } else {
        console.log('No info.json file at', dataPath);
      }
    }

    return processedVideos;
  }
}

module.exports = VideoMetadataProcessor;