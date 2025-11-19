import { ConfigState } from '../types';

/**
 * Validate proxy URL format
 * @param proxy - Proxy URL string
 * @returns Error message if invalid, null if valid
 */
export const validateProxyUrl = (proxy: string): string | null => {
  if (!proxy || proxy.trim() === '') {
    return null; // Empty is valid (no proxy)
  }

  const trimmedProxy = proxy.trim();

  // Valid proxy URL patterns: http://, https://, socks4://, socks5://
  // With optional authentication: protocol://user:pass@host:port
  const proxyRegex = /^(https?|socks4|socks5):\/\/([^:@]+:[^:@]+@)?[^:/\s]+(:\d+)?(\/.*)?$/i;

  if (!proxyRegex.test(trimmedProxy)) {
    return 'Invalid proxy URL format. Must be http://, https://, socks4://, or socks5://';
  }

  // Additional validation using URL constructor
  try {
    new URL(trimmedProxy);
  } catch {
    return 'Invalid proxy URL';
  }

  return null;
};

/**
 * Centralized configuration validation
 * Validates all configuration fields and returns the first error found
 * @param config - Current configuration state
 * @returns Error message if validation fails, null if valid
 */
export const validateConfig = (config: ConfigState): string | null => {
  // Auto removal validation
  if (
    config.autoRemovalEnabled &&
    !config.autoRemovalFreeSpaceThreshold &&
    !config.autoRemovalVideoAgeThreshold
  ) {
    return 'Cannot save: Automatic removal is enabled but no thresholds are configured';
  }

  // Proxy URL validation
  if (config.proxy && config.proxy.trim()) {
    const proxyError = validateProxyUrl(config.proxy);
    if (proxyError) {
      return `Cannot save: ${proxyError}`;
    }
  }

  return null;
};
