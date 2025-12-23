/**
 * Shared notification service helpers
 * Used by both configModule and notificationModule to avoid duplication
 */

/**
 * Known notification service patterns and their metadata
 */
const NOTIFICATION_SERVICES = {
  discord: {
    name: 'Discord Webhook',
    patterns: [
      url => url.startsWith('discord://'),
      url => url.includes('discord.com/api/webhooks'),
      url => url.includes('discordapp.com/api/webhooks')
    ],
    supportsRichFormatting: true
  },
  telegram: {
    name: 'Telegram Bot',
    patterns: [
      url => url.startsWith('tgram://'),
      url => url.startsWith('telegram://')
    ],
    supportsRichFormatting: true
  },
  slack: {
    name: 'Slack Webhook',
    patterns: [
      url => url.includes('hooks.slack.com'),
      url => url.startsWith('slack://')
    ],
    supportsRichFormatting: true
  },
  pushover: {
    name: 'Pushover',
    patterns: [
      url => url.startsWith('pover://'),
      url => url.startsWith('pushover://')
    ],
    supportsRichFormatting: false
  },
  email: {
    name: 'Email',
    patterns: [
      url => url.startsWith('mailto://'),
      url => url.startsWith('mailtos://')
    ],
    supportsRichFormatting: true
  },
  gotify: {
    name: 'Gotify',
    patterns: [
      url => url.startsWith('gotify://'),
      url => url.startsWith('gotifys://')
    ],
    supportsRichFormatting: false
  },
  ntfy: {
    name: 'Ntfy',
    patterns: [
      url => url.startsWith('ntfy://'),
      url => url.startsWith('ntfys://')
    ],
    supportsRichFormatting: false
  },
  matrix: {
    name: 'Matrix',
    patterns: [
      url => url.startsWith('matrix://'),
      url => url.startsWith('matrixs://')
    ],
    supportsRichFormatting: true
  },
  mattermost: {
    name: 'Mattermost',
    patterns: [
      url => url.startsWith('mmost://')
    ],
    supportsRichFormatting: true
  }
};

/**
 * Detect the service type from a URL
 * @param {string} url - The notification URL
 * @returns {string|null} Service key or null if unknown
 */
function detectServiceType(url) {
  if (!url) return null;

  for (const [serviceKey, service] of Object.entries(NOTIFICATION_SERVICES)) {
    if (service.patterns.some(pattern => pattern(url))) {
      return serviceKey;
    }
  }
  return null;
}

/**
 * Get a default display name for a notification URL based on its type
 * @param {string} url - The notification URL
 * @returns {string} A friendly name for the service
 */
function getDefaultNameForUrl(url) {
  if (!url) return 'Notification Service';

  const serviceType = detectServiceType(url);
  if (serviceType && NOTIFICATION_SERVICES[serviceType]) {
    return NOTIFICATION_SERVICES[serviceType].name;
  }

  // Try to extract service name from URL scheme
  const schemeMatch = url.match(/^([a-z]+):\/\//i);
  if (schemeMatch) {
    return schemeMatch[1].charAt(0).toUpperCase() + schemeMatch[1].slice(1);
  }

  return 'Notification Service';
}

/**
 * Check if a URL supports rich formatting (embeds, blocks, etc.)
 * @param {string} url - The notification URL
 * @returns {boolean} True if the service supports rich formatting
 */
function supportsRichFormatting(url) {
  if (!url) return false;

  const serviceType = detectServiceType(url);
  if (serviceType && NOTIFICATION_SERVICES[serviceType]) {
    return NOTIFICATION_SERVICES[serviceType].supportsRichFormatting;
  }

  return false;
}

/**
 * Check if a URL is a Discord HTTP webhook (NOT Apprise discord://)
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a Discord HTTP webhook
 */
function isDiscordWebhook(url) {
  if (!url) return false;
  // Only match HTTP webhook URLs, NOT discord:// Apprise URLs
  return url.includes('discord.com/api/webhooks') ||
         url.includes('discordapp.com/api/webhooks');
}

/**
 * Check if a URL is a Discord Apprise URL (discord://)
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a Discord Apprise URL
 */
function isDiscordApprise(url) {
  if (!url) return false;
  return url.startsWith('discord://');
}

/**
 * Check if a URL is any Discord notification URL (HTTP or Apprise)
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a Discord URL
 */
function isDiscord(url) {
  if (!url) return false;
  return url.startsWith('discord://') ||
         url.includes('discord.com/api/webhooks') ||
         url.includes('discordapp.com/api/webhooks');
}

/**
 * Check if a URL is a Slack webhook
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a Slack webhook
 */
function isSlackWebhook(url) {
  if (!url) return false;
  return url.includes('hooks.slack.com') || url.startsWith('slack://');
}

/**
 * Check if a URL is any Slack notification URL
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a Slack URL
 */
function isSlack(url) {
  if (!url) return false;
  return url.includes('hooks.slack.com') || url.startsWith('slack://');
}

/**
 * Check if a URL is a Telegram notification
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's a Telegram URL
 */
function isTelegram(url) {
  if (!url) return false;
  return url.startsWith('tgram://') || url.startsWith('telegram://');
}

/**
 * Check if a URL is an Email notification
 * @param {string} url - The URL to check
 * @returns {boolean} True if it's an Email URL
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

/**
 * Get list of services that support rich formatting (for UI display)
 * @returns {string[]} Array of service keys that support rich formatting
 */
function getRichFormattingServices() {
  return Object.entries(NOTIFICATION_SERVICES)
    .filter(([, service]) => service.supportsRichFormatting)
    .map(([key]) => key);
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

