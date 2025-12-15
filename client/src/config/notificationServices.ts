/**
 * Shared notification service configuration
 * Single source of truth for service detection and metadata
 */

export interface NotificationService {
  name: string;
  patterns: ((url: string) => boolean)[];
  supportsRichFormatting: boolean;
}

export const NOTIFICATION_SERVICES: Record<string, NotificationService> = {
  discord: {
    name: 'Discord Webhook',
    patterns: [
      (url) => url.startsWith('discord://'),
      (url) => url.includes('discord.com/api/webhooks'),
      (url) => url.includes('discordapp.com/api/webhooks')
    ],
    supportsRichFormatting: true
  },
  telegram: {
    name: 'Telegram Bot',
    patterns: [
      (url) => url.startsWith('tgram://'),
      (url) => url.startsWith('telegram://')
    ],
    supportsRichFormatting: true
  },
  slack: {
    name: 'Slack Webhook',
    patterns: [
      (url) => url.includes('hooks.slack.com'),
      (url) => url.startsWith('slack://')
    ],
    supportsRichFormatting: true
  },
  pushover: {
    name: 'Pushover',
    patterns: [
      (url) => url.startsWith('pover://'),
      (url) => url.startsWith('pushover://')
    ],
    supportsRichFormatting: false
  },
  email: {
    name: 'Email',
    patterns: [
      (url) => url.startsWith('mailto://'),
      (url) => url.startsWith('mailtos://')
    ],
    supportsRichFormatting: true
  },
  gotify: {
    name: 'Gotify',
    patterns: [
      (url) => url.startsWith('gotify://'),
      (url) => url.startsWith('gotifys://')
    ],
    supportsRichFormatting: false
  },
  ntfy: {
    name: 'Ntfy',
    patterns: [
      (url) => url.startsWith('ntfy://'),
      (url) => url.startsWith('ntfys://')
    ],
    supportsRichFormatting: false
  },
  matrix: {
    name: 'Matrix',
    patterns: [
      (url) => url.startsWith('matrix://'),
      (url) => url.startsWith('matrixs://')
    ],
    supportsRichFormatting: true
  },
  mattermost: {
    name: 'Mattermost',
    patterns: [(url) => url.startsWith('mmost://')],
    supportsRichFormatting: true
  }
};

/**
 * Detect the service type from a URL
 */
export function detectServiceType(url: string): string | null {
  if (!url) return null;

  for (const [serviceKey, service] of Object.entries(NOTIFICATION_SERVICES)) {
    if (service.patterns.some((pattern) => pattern(url))) {
      return serviceKey;
    }
  }
  return null;
}

/**
 * Get a default display name for a notification URL based on its type
 */
export function getDefaultNameForUrl(url: string): string {
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
 */
export function supportsRichFormatting(url: string): boolean {
  if (!url) return false;

  const serviceType = detectServiceType(url);
  if (serviceType && NOTIFICATION_SERVICES[serviceType]) {
    return NOTIFICATION_SERVICES[serviceType].supportsRichFormatting;
  }

  return false;
}

/**
 * Get list of service keys that support rich formatting
 */
export function getRichFormattingServices(): string[] {
  return Object.entries(NOTIFICATION_SERVICES)
    .filter(([, service]) => service.supportsRichFormatting)
    .map(([key]) => key);
}

