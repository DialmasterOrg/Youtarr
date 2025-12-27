/**
 * Notification Module - Main Orchestrator
 *
 * Routes notifications to appropriate formatters and senders based on
 * the service registry. Adding new services only requires updating
 * serviceRegistry.js - no changes needed here.
 */

const logger = require('../../logger');
const {
  getServiceForUrl,
  getFormatter,
  supportsRichFormatting
} = require('./serviceRegistry');

// Senders
const { appriseSender, discordSender } = require('./senders');

// Plain formatter for non-rich formatting
const plainFormatter = require('./formatters/plainFormatter');

/**
 * Normalize an appriseUrls entry to the current object format
 * @param {string|Object} item - URL string or object entry
 * @returns {Object} Normalized entry with url, name, and richFormatting
 */
function normalizeAppriseEntry(item) {
  const { getDefaultNameForUrl } = require('./serviceRegistry');

  if (typeof item === 'string') {
    return {
      url: item,
      name: getDefaultNameForUrl(item),
      richFormatting: supportsRichFormatting(item)
    };
  }

  return {
    url: item.url || '',
    name: item.name || getDefaultNameForUrl(item.url || ''),
    richFormatting: item.richFormatting !== false
  };
}

/**
 * Send notification using the appropriate method based on service config
 * @param {string} url - The notification URL
 * @param {Object} message - The formatted message
 * @param {string} sendMethod - The send method from service registry
 */
async function sendNotification(url, message, sendMethod) {
  switch (sendMethod) {
  case 'discord-embed':
    // message is already a Discord embed payload
    return discordSender.send(url, message);
  case 'apprise-html':
    // message is { title, body } with HTML body
    return appriseSender.sendHtml(message.title, message.body, [url]);
  case 'apprise-markdown':
    // message is { title, body } with Markdown body
    return appriseSender.sendMarkdown(message.title, message.body, [url]);
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
      const results = await Promise.all(urls.map(async (entry) => {
        try {
          const service = getServiceForUrl(entry.url);
          const useRichFormatting = entry.richFormatting && service.supportsRichFormatting;

          // Get formatter based on rich formatting preference
          const formatter = useRichFormatting ? getFormatter(service) : plainFormatter;
          const sendMethod = useRichFormatting ? service.sendMethod : 'apprise-plain';

          const message = formatter.formatDownloadMessage(finalSummary, videoData);
          await sendNotification(entry.url, message, sendMethod);
          return true;
        } catch (err) {
          logger.error({ err, name: entry.name }, 'Failed to send notification');
          return false;
        }
      }));

      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        logger.info({ downloadCount: finalSummary.totalDownloaded, successCount, totalCount: urls.length }, 'Download notification sent successfully');
      }
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
        const service = getServiceForUrl(entry.url);
        const useRichFormatting = entry.richFormatting && service.supportsRichFormatting;

        const formatter = useRichFormatting ? getFormatter(service) : plainFormatter;
        const sendMethod = useRichFormatting ? service.sendMethod : 'apprise-plain';

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

    const service = getServiceForUrl(url);
    const useRichFormatting = richFormatting && service.supportsRichFormatting;

    const formatter = useRichFormatting ? getFormatter(service) : plainFormatter;
    const sendMethod = useRichFormatting ? service.sendMethod : 'apprise-plain';

    const message = formatter.formatTestMessage(name);
    await sendNotification(url, message, sendMethod);
  }
}

module.exports = new NotificationModule();
