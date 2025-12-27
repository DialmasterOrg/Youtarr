/**
 * Notification Helpers
 *
 * Re-exports from serviceRegistry for backward compatibility.
 * New code should import directly from notifications/serviceRegistry.
 */

const {
  services: NOTIFICATION_SERVICES,
  getServiceForUrl: detectServiceType,
  getDefaultNameForUrl,
  supportsRichFormatting,
  isDiscordWebhook,
  isDiscord,
  getRichFormattingServices
} = require('./notifications/serviceRegistry');

/**
 * Check if URL is a Discord Apprise URL (discord://)
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isDiscordApprise(url) {
  if (!url) return false;
  return url.startsWith('discord://');
}

/**
 * Check if URL is a Slack webhook
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isSlack(url) {
  if (!url) return false;
  return url.includes('hooks.slack.com') || url.startsWith('slack://');
}

/**
 * Alias for isSlack for consistency
 */
const isSlackWebhook = isSlack;

/**
 * Check if URL is a Telegram notification
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isTelegram(url) {
  if (!url) return false;
  return url.startsWith('tgram://') || url.startsWith('telegram://');
}

/**
 * Check if URL is an Email notification
 * @param {string} url - The URL to check
 * @returns {boolean}
 */
function isEmail(url) {
  if (!url) return false;
  return url.startsWith('mailto://') || url.startsWith('mailtos://');
}

/**
 * Normalize an appriseUrls entry to the current object format
 * @param {string|Object} item - URL string or object entry
 * @returns {Object} Normalized entry with url, name, and richFormatting
 */
function normalizeAppriseEntry(item) {
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

module.exports = {
  NOTIFICATION_SERVICES,
  detectServiceType,
  getDefaultNameForUrl,
  supportsRichFormatting,
  isDiscordWebhook,
  isDiscordApprise,
  isDiscord,
  isSlackWebhook,
  isSlack,
  isTelegram,
  isEmail,
  normalizeAppriseEntry,
  getRichFormattingServices
};
