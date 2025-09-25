const fs = require('fs');
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

  static processVideoMetadata(newVideoUrls) {
    return newVideoUrls
      .map((url) => {
        let id = url.split('youtu.be/')[1].trim();
        let dataPath = path.join(
          configModule.getJobsPath(),
          `info/${id}.info.json`
        );
        console.log('Looking for info.json file at', dataPath);

        if (fs.existsSync(dataPath)) {
          console.log('Found info.json file at', dataPath);
          let data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

          const preferredChannelName =
            this.normalizeChannelName(data.uploader) ||
            this.normalizeChannelName(data.channel) ||
            this.normalizeChannelName(data.uploader_id) ||
            this.normalizeChannelName(data.channel_id) ||
            'Unknown Channel';

          return {
            youtubeId: data.id,
            youTubeChannelName: preferredChannelName,
            youTubeVideoName: data.title,
            duration: data.duration,
            description: data.description,
            originalDate: data.upload_date,
            channel_id: data.channel_id,
          };
        } else {
          console.log('No info.json file at', dataPath);
        }
        return null; // If for some reason .info.json file is not found, return null
      })
      .filter((data) => data !== null); // Filter out any null values
  }
}

module.exports = VideoMetadataProcessor;