/**
 * Notification Service Registry
 *
 * Central registry for all notification services. Adding a new service
 * only requires adding an entry here - no changes to routing logic needed.
 *
 * Each service defines:
 * - name: Display name for the service
 * - patterns: Array of detection functions (url => boolean)
 * - supportsRichFormatting: Whether Youtarr provides custom rich formatting
 * - formatter: Module path for the formatter (lazy loaded)
 * - sendMethod: How to send ('discord-embed', 'apprise-html', 'apprise-markdown', 'apprise-plain')
 */

const services = {
  discord: {
    name: 'Discord',
    patterns: [
      url => url.startsWith('discord://'),
      url => url.includes('discord.com/api/webhooks'),
      url => url.includes('discordapp.com/api/webhooks')
    ],
    supportsRichFormatting: true,
    formatter: './formatters/discordFormatter',
    sendMethod: 'discord-embed'
  },

  slack: {
    name: 'Slack',
    patterns: [
      url => url.startsWith('slack://'),
      url => url.includes('hooks.slack.com')
    ],
    supportsRichFormatting: true,
    formatter: './formatters/slackMarkdownFormatter',
    sendMethod: 'apprise-markdown'
  },

  telegram: {
    name: 'Telegram',
    patterns: [
      url => url.startsWith('tgram://'),
      url => url.startsWith('telegram://')
    ],
    supportsRichFormatting: true,
    formatter: './formatters/telegramFormatter',
    sendMethod: 'apprise-html'
  },

  email: {
    name: 'Email',
    patterns: [
      url => url.startsWith('mailto://'),
      url => url.startsWith('mailtos://')
    ],
    supportsRichFormatting: true,
    formatter: './formatters/emailFormatter',
    sendMethod: 'apprise-html'
  },

  // Services that don't have custom rich formatting (use Apprise defaults)
  pushover: {
    name: 'Pushover',
    patterns: [
      url => url.startsWith('pover://'),
      url => url.startsWith('pushover://')
    ],
    supportsRichFormatting: false,
    formatter: './formatters/plainFormatter',
    sendMethod: 'apprise-plain'
  },

  gotify: {
    name: 'Gotify',
    patterns: [
      url => url.startsWith('gotify://'),
      url => url.startsWith('gotifys://')
    ],
    supportsRichFormatting: false,
    formatter: './formatters/plainFormatter',
    sendMethod: 'apprise-plain'
  },

  ntfy: {
    name: 'Ntfy',
    patterns: [
      url => url.startsWith('ntfy://'),
      url => url.startsWith('ntfys://')
    ],
    supportsRichFormatting: false,
    formatter: './formatters/plainFormatter',
    sendMethod: 'apprise-plain'
  },

  matrix: {
    name: 'Matrix',
    patterns: [
      url => url.startsWith('matrix://'),
      url => url.startsWith('matrixs://')
    ],
    supportsRichFormatting: false,
    formatter: './formatters/plainFormatter',
    sendMethod: 'apprise-plain'
  },

  mattermost: {
    name: 'Mattermost',
    patterns: [
      url => url.startsWith('mmost://')
    ],
    supportsRichFormatting: false,
    formatter: './formatters/plainFormatter',
    sendMethod: 'apprise-plain'
  }
};

/**
 * Default configuration for unknown services
 */
const defaultService = {
  key: 'generic',
  name: 'Notification Service',
  supportsRichFormatting: false,
  formatter: './formatters/plainFormatter',
  sendMethod: 'apprise-plain'
};

/**
 * Formatter cache to avoid repeated requires
 */
const formatterCache = new Map();

/**
 * Detect which service a URL belongs to
 * @param {string} url - The notification URL
 * @returns {Object} Service configuration with key
 */
function getServiceForUrl(url) {
  if (!url) {
    return defaultService;
  }

  for (const [key, service] of Object.entries(services)) {
    if (service.patterns.some(pattern => pattern(url))) {
      return { key, ...service };
    }
  }

  return defaultService;
}

/**
 * Get the formatter module for a service
 * @param {Object} service - Service configuration from getServiceForUrl
 * @returns {Object} Formatter module with formatDownloadMessage and formatTestMessage
 */
function getFormatter(service) {
  const formatterPath = service.formatter;

  if (!formatterCache.has(formatterPath)) {
    formatterCache.set(formatterPath, require(formatterPath));
  }

  return formatterCache.get(formatterPath);
}

/**
 * Check if a URL supports rich formatting
 * @param {string} url - The notification URL
 * @returns {boolean} True if the service supports rich formatting
 */
function supportsRichFormatting(url) {
  const service = getServiceForUrl(url);
  return service.supportsRichFormatting;
}

/**
 * Get a default display name for a URL based on its detected service
 * @param {string} url - The notification URL
 * @returns {string} Display name for the service
 */
function getDefaultNameForUrl(url) {
  const service = getServiceForUrl(url);
  return service.name;
}

/**
 * Check if URL is a Discord service (any format)
 * @param {string} url - The notification URL
 * @returns {boolean}
 */
function isDiscord(url) {
  const service = getServiceForUrl(url);
  return service.key === 'discord';
}

/**
 * Check if URL is a Discord HTTP webhook (not discord://)
 * Used for migration logic
 * @param {string} url - The notification URL
 * @returns {boolean}
 */
function isDiscordWebhook(url) {
  if (!url) return false;
  return url.includes('discord.com/api/webhooks') ||
         url.includes('discordapp.com/api/webhooks');
}

/**
 * Get list of services that support rich formatting
 * @returns {string[]} Array of service keys
 */
function getRichFormattingServices() {
  return Object.entries(services)
    .filter(([, service]) => service.supportsRichFormatting)
    .map(([key]) => key);
}

/**
 * Get all registered services (for documentation/UI)
 * @returns {Object} All service definitions
 */
function getAllServices() {
  return services;
}

module.exports = {
  services,
  defaultService,
  getServiceForUrl,
  getFormatter,
  supportsRichFormatting,
  getDefaultNameForUrl,
  isDiscord,
  isDiscordWebhook,
  getRichFormattingServices,
  getAllServices
};

