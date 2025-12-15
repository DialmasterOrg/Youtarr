/**
 * Notification Module - Main Orchestrator
 * 
 * Routes notifications to appropriate formatters and senders:
 * - Discord: Uses direct webhook with embeds for rich formatting
 * - Telegram: Uses Apprise with HTML formatting
 * - Email: Uses Apprise with HTML formatting
 * - Others: Uses Apprise with plain text
 */

const logger = require('../../logger');
const {
  normalizeAppriseEntry,
  supportsRichFormatting,
  isDiscord,
  isSlack,
  isTelegram,
  isEmail
} = require('../notificationHelpers');

// Formatters
const {
  discordFormatter,
  slackMarkdownFormatter,
  telegramFormatter,
  emailFormatter,
  plainFormatter
} = require('./formatters');

// Senders
const { appriseSender, discordSender } = require('./senders');

/**
 * Get the appropriate formatter and send configuration for a URL
 */
function getFormatterConfig(url, useRichFormatting) {
  if (!useRichFormatting) {
    return { formatter: plainFormatter, sendMethod: 'apprise-plain' };
  }

  // Discord uses direct webhook with embeds for rich formatting
  if (isDiscord(url)) {
    return { formatter: discordFormatter, sendMethod: 'discord-embed' };
  }

  // Slack uses markdown via Apprise
  if (isSlack(url)) {
    return { formatter: slackMarkdownFormatter, sendMethod: 'apprise-plain' };
  }

  // Telegram uses HTML formatting via Apprise
  if (isTelegram(url)) {
    return { formatter: telegramFormatter, sendMethod: 'apprise-html' };
  }

  // Email uses HTML formatting via Apprise
  if (isEmail(url)) {
    return { formatter: emailFormatter, sendMethod: 'apprise-html' };
  }

  // All other services use plain text via Apprise
  return { formatter: plainFormatter, sendMethod: 'apprise-plain' };
}

/**
 * Send notification using the appropriate method
 */
async function sendNotification(url, message, sendMethod) {
  switch (sendMethod) {
  case 'discord-embed':
    // message is already a Discord embed payload
    return discordSender.send(url, message);
  case 'apprise-html':
    // message is { title, body } with HTML body
    return appriseSender.sendHtml(message.title, message.body, [url]);
  case 'apprise-plain':
  default:
    // message is { title, body } with plain text
    return appriseSender.send(message.title, message.body, [url]);
  }
}

class NotificationModule {
  constructor() {
    this.configModule = require('../configModule');
  }

  /**
   * Check if notifications are properly configured
   */
  isConfigured() {
    const config = this.configModule.getConfig();
    const urls = this.getUrlsFromConfig(config);
    return !!(config.notificationsEnabled && urls.length > 0);
  }

  /**
   * Extract URLs from config
   */
  getUrlsFromConfig(config) {
    const appriseUrls = config.appriseUrls || [];
    if (!Array.isArray(appriseUrls)) return [];
    return appriseUrls
      .map(normalizeAppriseEntry)
      .filter(item => item.url.trim().length > 0);
  }

  /**
   * Send a notification about completed downloads
   */
  async sendDownloadNotification(notificationData) {
    if (!this.isConfigured()) {
      logger.debug('Notifications not configured, skipping notification');
      return;
    }

    try {
      const { finalSummary, videoData } = notificationData;
      const config = this.configModule.getConfig();

      if (finalSummary.totalDownloaded === 0) {
        logger.debug('No new videos downloaded, skipping notification');
        return;
      }

      const urls = this.getUrlsFromConfig(config);

      // Send notifications individually to use appropriate formatting per service
      await Promise.all(urls.map(async (entry) => {
        try {
          const useRichFormatting = entry.richFormatting && supportsRichFormatting(entry.url);
          const { formatter, sendMethod } = getFormatterConfig(entry.url, useRichFormatting);
          const message = formatter.formatDownloadMessage(finalSummary, videoData);
          await sendNotification(entry.url, message, sendMethod);
        } catch (err) {
          logger.error({ err, name: entry.name }, 'Failed to send notification');
        }
      }));

      logger.info({ downloadCount: finalSummary.totalDownloaded }, 'Download notification sent successfully');
    } catch (error) {
      logger.error({ err: error }, 'Failed to send download notification');
    }
  }

  /**
   * Send a test notification to all configured webhooks
   */
  async sendTestNotification() {
    const config = this.configModule.getConfig();
    const urls = this.getUrlsFromConfig(config);

    if (urls.length === 0) {
      throw new Error('No notification URLs are configured');
    }

    const errors = [];

    await Promise.all(urls.map(async (entry) => {
      try {
        const useRichFormatting = entry.richFormatting && supportsRichFormatting(entry.url);
        const { formatter, sendMethod } = getFormatterConfig(entry.url, useRichFormatting);
        const message = formatter.formatTestMessage(entry.name);
        await sendNotification(entry.url, message, sendMethod);
      } catch (err) {
        errors.push(`${entry.name}: ${err.message}`);
      }
    }));

    if (errors.length > 0 && errors.length === urls.length) {
      throw new Error(errors.join('; '));
    }
  }

  /**
   * Send a test notification to a single webhook URL
   */
  async sendTestNotificationToSingle(entry) {
    const { url, name, richFormatting } = entry;

    if (!url || url.trim().length === 0) {
      throw new Error('Notification URL is required');
    }

    const useRichFormatting = richFormatting && supportsRichFormatting(url);
    const { formatter, sendMethod } = getFormatterConfig(url, useRichFormatting);
    const message = formatter.formatTestMessage(name);
    await sendNotification(url, message, sendMethod);
  }
}

module.exports = new NotificationModule();
