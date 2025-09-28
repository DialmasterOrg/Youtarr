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
        };

        // Calculate the file path based on the yt-dlp output template
        const baseOutputPath = configModule.directoryPath;
        const videoFolder = `${preferredChannelName} - ${data.title} - ${id}`;
        const videoFileName = `${preferredChannelName} - ${data.title}  [${id}].mp4`;
        const fullPath = path.join(baseOutputPath, preferredChannelName, videoFolder, videoFileName);

        // Check if file exists and get file size
        try {
          const stats = await fsPromises.stat(fullPath);
          videoMetadata.filePath = fullPath;
          videoMetadata.fileSize = stats.size.toString(); // Convert to string as DB expects BIGINT as string
          videoMetadata.removed = false;
          console.log(`Found video file at ${fullPath}, size: ${stats.size} bytes`);
        } catch (err) {
          // File might not exist yet or might be a different format
          console.log(`Video file not found at expected path: ${fullPath}`);
          // Try other common extensions
          const extensions = ['.webm', '.mkv', '.m4v', '.avi'];
          let fileFound = false;

          for (const ext of extensions) {
            const altPath = fullPath.replace('.mp4', ext);
            try {
              const stats = await fsPromises.stat(altPath);
              videoMetadata.filePath = altPath;
              videoMetadata.fileSize = stats.size.toString();
              videoMetadata.removed = false;
              fileFound = true;
              console.log(`Found video file at ${altPath}, size: ${stats.size} bytes`);
              break;
            } catch (altErr) {
              // Continue trying other extensions
            }
          }

          if (!fileFound) {
            // File doesn't exist or is still downloading
            videoMetadata.filePath = fullPath; // Store expected path anyway
            videoMetadata.fileSize = null;
            videoMetadata.removed = false; // Assume it's not removed, just not found yet
          }
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