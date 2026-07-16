const fs = require('fs-extra');
const fsPromises = fs.promises;
const path = require('path');
const { execSync } = require('child_process');
const configModule = require('../configModule');
const logger = require('../../logger');
const { copySyncWithFallback } = require('../filesystem');
const channelYtdlpExecutor = require('./channelYtdlpExecutor');

class ChannelThumbnails {
  /**
   * Resize channel thumbnail image
   * @param {string} channelId - Channel ID
   * @returns {Promise<void>}
   */
  async resizeChannelThumbnail(channelId) {
    const imagePath = configModule.getImagePath();
    const realImagePath = path.join(
      imagePath,
      `channelthumb-${channelId}.jpg`
    );
    const smallImagePath = path.join(
      imagePath,
      `channelthumb-${channelId}-small.jpg`
    );

    try {
      execSync(
        `${configModule.ffmpegPath} -loglevel error -y -i "${realImagePath}" -vf "scale=iw*0.4:ih*0.4" -q:v 2 "${smallImagePath}"`,
        { stdio: 'inherit' }
      );
      await fsPromises.rename(smallImagePath, realImagePath);
      logger.debug({ channelId }, 'Channel thumbnail resized successfully');
    } catch (err) {
      logger.error({ err, channelId, imagePath: realImagePath }, 'Error resizing channel thumbnail');
    }
  }

  /**
   * Extract the avatar thumbnail URL from channel metadata
   * @param {Object} channelData - Channel metadata from yt-dlp
   * @returns {string|null} - Avatar thumbnail URL or null if not found
   */
  extractAvatarThumbnailUrl(channelData) {
    if (!channelData.thumbnails || !Array.isArray(channelData.thumbnails)) {
      return null;
    }
    // Prefer 900x900 (height and width), then any square dimension thumb, then avatar_uncropped
    // (avatar_uncropped last since it is good, but usually HUGE)
    const avatarThumb = channelData.thumbnails.find(t => t.width === 900 && t.height === 900)
      || channelData.thumbnails.find(t => t.width && t.height && t.width === t.height)
      || channelData.thumbnails.find(t => t.id === 'avatar_uncropped');
    logger.info({ channelId: channelData.channel_id, avatarThumb }, 'Extracted avatar thumbnail URL');
    return avatarThumb?.url || null;
  }

  /**
   * Download channel thumbnail directly from URL
   * @param {string} thumbnailUrl - Direct URL to the thumbnail image
   * @param {string} channelId - Channel ID for naming the file
   * @returns {Promise<void>}
   */
  async downloadChannelThumbnailFromUrl(thumbnailUrl, channelId) {
    const https = require('https');
    const http = require('http');
    const imageDir = configModule.getImagePath();
    const imagePath = path.join(imageDir, `channelthumb-${channelId}.jpg`);

    return new Promise((resolve, reject) => {
      const protocol = thumbnailUrl.startsWith('https') ? https : http;
      const file = fs.createWriteStream(imagePath);

      const req = protocol.get(thumbnailUrl, { timeout: 15000 }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(imagePath);
          return this.downloadChannelThumbnailFromUrl(response.headers.location, channelId)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(imagePath);
          return reject(new Error(`Failed to download thumbnail: HTTP ${response.statusCode}`));
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          logger.debug({ channelId, imagePath }, 'Channel thumbnail downloaded via HTTP');
          resolve();
        });
      });

      req.on('timeout', () => {
        req.destroy();
        file.close();
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
        reject(new Error('Thumbnail download timed out'));
      });

      req.on('error', (err) => {
        file.close();
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
        reject(err);
      });
    });
  }

  /**
   * Download channel thumbnail using yt-dlp (fallback method)
   * @param {string} channelUrl - Channel URL
   * @returns {Promise<void>}
   */
  async downloadChannelThumbnailViaYtdlp(channelUrl) {
    const YtdlpCommandBuilder = require('../download/ytdlpCommandBuilder');
    const imageDir = configModule.getImagePath();
    const imagePath = path.join(
      imageDir,
      'channelthumb-%(channel_id)s.jpg'
    );

    const args = YtdlpCommandBuilder.buildThumbnailDownloadArgs(channelUrl, imagePath);
    await channelYtdlpExecutor.executeYtDlpCommand(args);
  }

  /**
   * Process channel thumbnail (download and resize)
   * @param {Object} channelData - Channel metadata containing thumbnails array
   * @param {string} channelId - Channel ID
   * @param {string} channelUrl - Channel URL (fallback for yt-dlp download)
   * @returns {Promise<void>}
   */
  async processChannelThumbnail(channelData, channelId, channelUrl) {
    const thumbnailUrl = this.extractAvatarThumbnailUrl(channelData);
    logger.info({ channelId, thumbnailUrl }, 'Processing channel thumbnail');

    if (thumbnailUrl) {
      try {
        await this.downloadChannelThumbnailFromUrl(thumbnailUrl, channelId);
      } catch (err) {
        logger.warn({ err, channelId }, 'Failed to download thumbnail via HTTP, falling back to yt-dlp');
        await this.downloadChannelThumbnailViaYtdlp(channelUrl);
      }
    } else {
      logger.info({ channelId }, 'No avatar thumbnail URL found in metadata, using yt-dlp');
      await this.downloadChannelThumbnailViaYtdlp(channelUrl);
    }

    await this.resizeChannelThumbnail(channelId);
  }

  /**
   * Backfill poster.jpg files for existing channel folders.
   * Copies channelthumb to each channel's folder as poster.jpg if it doesn't exist.
   * @param {Array} channels - Array of channel database records
   * @returns {Promise<void>}
   */
  async backfillChannelPosters(channels) {
    try {
      const config = configModule.getConfig() || {};
      const shouldWriteChannelPosters = config.writeChannelPosters !== false;

      if (!shouldWriteChannelPosters) {
        return;
      }

      const outputDir = configModule.directoryPath;
      const imageDir = configModule.getImagePath();

      if (!outputDir || !fs.existsSync(outputDir)) {
        return;
      }

      for (const channel of channels) {
        if (!channel.channel_id) continue;

        // Use folder_name (sanitized by yt-dlp) if available, fall back to uploader
        const channelFolderName = channel.folder_name || channel.uploader;
        if (!channelFolderName) continue;

        const channelFolderPath = path.join(outputDir, channelFolderName);
        const channelPosterPath = path.join(channelFolderPath, 'poster.jpg');

        // Check if channel folder exists and poster.jpg doesn't exist
        if (fs.existsSync(channelFolderPath) && !fs.existsSync(channelPosterPath)) {
          const channelThumbPath = path.join(imageDir, `channelthumb-${channel.channel_id}.jpg`);

          if (fs.existsSync(channelThumbPath)) {
            try {
              copySyncWithFallback(channelThumbPath, channelPosterPath);
            } catch (copyErr) {
              logger.error({ err: copyErr, channelFolderName }, 'Error backfilling poster for channel');
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error during channel poster backfill');
    }
  }
}

module.exports = new ChannelThumbnails();
