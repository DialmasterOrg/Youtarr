const fs = require('fs-extra');
const fsPromises = fs.promises;
const path = require('path');
const { execSync } = require('child_process');
const configModule = require('../configModule');
const logger = require('../../logger');
const {
  copySyncWithFallback,
  resolveEffectiveSubfolder,
  buildChannelPath,
  resolveChannelFolderName,
} = require('../filesystem');
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
   * Extract the uncropped banner URL from channel metadata
   * @param {Object} channelData - Channel metadata from yt-dlp or the YouTube API
   * @returns {string|null} - Banner URL or null if the channel has no banner
   */
  extractBannerThumbnailUrl(channelData) {
    if (!channelData.thumbnails || !Array.isArray(channelData.thumbnails)) {
      return null;
    }
    const bannerThumb = channelData.thumbnails.find(t => t.id === 'banner_uncropped');
    return bannerThumb?.url || null;
  }

  /**
   * Download an image from a URL into the image cache directory
   * @param {string} imageUrl - Direct URL to the image
   * @param {string} targetFileName - File name to write inside the image directory
   * @returns {Promise<void>}
   */
  async downloadImageToFile(imageUrl, targetFileName) {
    const https = require('https');
    const http = require('http');
    const imageDir = configModule.getImagePath();
    const imagePath = path.join(imageDir, targetFileName);

    return new Promise((resolve, reject) => {
      const protocol = imageUrl.startsWith('https') ? https : http;
      const file = fs.createWriteStream(imagePath);

      const req = protocol.get(imageUrl, { timeout: 15000 }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(imagePath);
          return this.downloadImageToFile(response.headers.location, targetFileName)
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
          logger.debug({ targetFileName, imagePath }, 'Image downloaded via HTTP');
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
        await this.downloadImageToFile(thumbnailUrl, `channelthumb-${channelId}.jpg`);
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
   * Cache the channel banner image (used for backdrop.jpg generation).
   * Best-effort: never throws.
   * @param {Object} channelData - Channel metadata containing thumbnails array
   * @param {string} channelId - Channel ID
   * @returns {Promise<void>}
   */
  async processChannelBanner(channelData, channelId) {
    const bannerUrl = this.extractBannerThumbnailUrl(channelData);
    if (!bannerUrl) {
      logger.debug({ channelId }, 'No banner_uncropped thumbnail in channel metadata, skipping banner cache');
      return;
    }
    try {
      await this.downloadImageToFile(bannerUrl, `channelbanner-${channelId}.jpg`);
      logger.info({ channelId }, 'Channel banner cached');
    } catch (err) {
      logger.warn({ err, channelId }, 'Failed to download channel banner');
    }
  }

  /**
   * Backfill poster.jpg and backdrop.jpg files for existing channel folders.
   * @param {Array} channels - Array of channel database records
   * @returns {Promise<void>}
   */
  async backfillChannelImages(channels) {
    try {
      const config = configModule.getConfig() || {};
      const shouldWritePosters = config.writeChannelPosters !== false;
      const shouldWriteBackdrops = config.writeBackdropImages === true;

      if (!shouldWritePosters && !shouldWriteBackdrops) {
        return;
      }

      const outputDir = configModule.directoryPath;
      const imageDir = configModule.getImagePath();

      if (!outputDir || !fs.existsSync(outputDir)) {
        return;
      }

      for (const channel of channels) {
        if (!channel.channel_id) continue;

        const channelFolderName = resolveChannelFolderName(channel);
        if (!channelFolderName) continue;

        // Channels can live under a __subfolder (explicit or via the global
        // default); resolve the real folder path the same way downloads do.
        let channelFolderPath;
        try {
          const subfolder = resolveEffectiveSubfolder(channel.sub_folder, configModule.getDefaultSubfolder());
          channelFolderPath = buildChannelPath(outputDir, subfolder, channelFolderName);
        } catch (pathErr) {
          logger.warn({ err: pathErr, channelId: channel.channel_id }, 'Skipping channel with unresolvable folder path during image backfill');
          continue;
        }
        if (!fs.existsSync(channelFolderPath)) continue;

        if (shouldWritePosters) {
          this.copyChannelImageIfMissing(
            path.join(imageDir, `channelthumb-${channel.channel_id}.jpg`),
            path.join(channelFolderPath, 'poster.jpg'),
            channelFolderName
          );
        }
        if (shouldWriteBackdrops) {
          this.copyChannelImageIfMissing(
            path.join(imageDir, `channelbanner-${channel.channel_id}.jpg`),
            path.join(channelFolderPath, 'backdrop.jpg'),
            channelFolderName
          );
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error during channel image backfill');
    }
  }

  /**
   * Copy a cached channel image to a target path if the source exists and the
   * target doesn't.
   * @param {string} sourcePath - Cached image path in the image directory
   * @param {string} targetPath - Destination path inside the channel folder
   * @param {string} channelFolderName - For error logging context
   */
  copyChannelImageIfMissing(sourcePath, targetPath, channelFolderName) {
    if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
      return;
    }
    try {
      copySyncWithFallback(sourcePath, targetPath);
    } catch (copyErr) {
      logger.error({ err: copyErr, channelFolderName, targetPath }, 'Error backfilling channel image');
    }
  }
}

module.exports = new ChannelThumbnails();
