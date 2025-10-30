const https = require('https');
const { URL } = require('url');
const logger = require('../logger');

class NotificationModule {
  constructor() {
    this.configModule = require('./configModule');
  }

  /**
   * Check if notifications are properly configured
   * @returns {boolean} True if notifications can be sent
   */
  isConfigured() {
    const config = this.configModule.getConfig();
    return !!(
      config.notificationsEnabled &&
      config.discordWebhookUrl &&
      config.discordWebhookUrl.trim().length > 0
    );
  }

  /**
   * Send a notification about completed downloads
   * @param {Object} notificationData - Data about the download
   * @param {Object} notificationData.finalSummary - Summary from downloadExecutor
   * @param {Array} notificationData.videoData - Array of video metadata
   * @param {string} notificationData.channelName - Channel name (for channel downloads)
   * @returns {Promise<void>}
   */
  async sendDownloadNotification(notificationData) {
    if (!this.isConfigured()) {
      logger.debug('Notifications not configured, skipping notification');
      return;
    }

    try {
      const { finalSummary, videoData } = notificationData;
      const config = this.configModule.getConfig();

      // Don't send notification if nothing was downloaded
      if (finalSummary.totalDownloaded === 0) {
        logger.debug('No new videos downloaded, skipping notification');
        return;
      }

      const message = this.formatDownloadMessage(finalSummary, videoData);
      await this.sendDiscordWebhook(config.discordWebhookUrl, message);
      logger.info({ downloadCount: finalSummary.totalDownloaded }, 'Download notification sent successfully');
    } catch (error) {
      // Never crash the app due to notification failures
      logger.error({ err: error }, 'Failed to send download notification');
    }
  }

  /**
   * Send a test notification
   * @returns {Promise<void>}
   */
  async sendTestNotification() {
    const config = this.configModule.getConfig();

    if (!config.discordWebhookUrl || config.discordWebhookUrl.trim().length === 0) {
      throw new Error('Discord webhook URL is not configured');
    }

    const message = {
      embeds: [{
        title: '✅ Test Notification',
        description: 'Your Youtarr notifications are working correctly!',
        color: 0x00ff00, // Green
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Youtarr Notifications'
        }
      }]
    };

    await this.sendDiscordWebhook(config.discordWebhookUrl, message);
  }

  /**
   * Format duration from seconds to human readable format (HH:MM:SS or MM:SS)
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format download completion data into a Discord message
   * @param {Object} finalSummary - Summary object from downloadExecutor
   * @param {Array} videoData - Array of video metadata objects
   * @param {string} channelName - Channel name for channel downloads
   * @returns {Object} Discord webhook message payload
   */
  formatDownloadMessage(finalSummary, videoData) {
    const { totalDownloaded, jobType } = finalSummary;
    const isChannelDownload = jobType.includes('Channel Downloads');

    // Build the title
    let title;
    if (totalDownloaded === 1) {
      title = '🎬 New Video Downloaded';
    } else {
      title = `🎬 ${totalDownloaded} New Videos Downloaded`;
    }

    // Build the description
    let description = '';

    if (isChannelDownload) {
      description += '**Channel Video Downloads:**\n';
    } else {
      description += '**Manually Selected Video Downloads:**\n';
    }

    // Add video titles (limit to first 10 to avoid hitting Discord limits)
    if (videoData && videoData.length > 0) {
      const videosToShow = videoData.slice(0, 10);

      videosToShow.forEach(video => {
        const channelName = video.youTubeChannelName || 'Unknown Channel';
        const videoTitle = video.youTubeVideoName || 'Unknown Title';
        const duration = this.formatDuration(video.duration);

        // Format: Channel Name - Video Title - Duration
        const fullLine = `${channelName} - ${videoTitle} - ${duration}`;

        // Truncate if too long (Discord has a 4096 char limit for embed descriptions)
        const truncatedLine = fullLine.length > 150
          ? `${fullLine.substring(0, 147)}...`
          : fullLine;
        description += `• ${truncatedLine}\n`;
      });

      if (videoData.length > 10) {
        description += `\n...and ${videoData.length - 10} more`;
      }
    }

    return {
      embeds: [{
        title,
        description,
        color: 0x00ff00, // Green for success
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Youtarr'
        }
      }]
    };
  }

  /**
   * Send a message to a Discord webhook
   * @param {string} webhookUrl - The Discord webhook URL
   * @param {Object} message - The message payload (should contain embeds)
   * @returns {Promise<void>}
   */
  async sendDiscordWebhook(webhookUrl, message) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(webhookUrl);

        // Validate it's a Discord webhook URL
        if (!url.hostname.includes('discord')) {
          throw new Error('Invalid Discord webhook URL');
        }

        const payload = JSON.stringify(message);

        const options = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: 10000 // 10 second timeout
        };

        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`Discord webhook returned status ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(new Error(`Failed to send Discord webhook: ${error.message}`));
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Discord webhook request timed out'));
        });

        req.write(payload);
        req.end();
      } catch (error) {
        reject(new Error(`Invalid webhook URL: ${error.message}`));
      }
    });
  }
}

module.exports = new NotificationModule();
