export const normalizeChannelUrl = (input: string): string | null => {
  try {
    let url = input.trim().replace(/\/+$/, '');

    if (!url) {
      return null;
    }

    if (!url.includes('.') && !url.includes('/')) {
      const channelName = url.startsWith('@') ? url : `@${url}`;
      if (/^@[\w.-]+$/.test(channelName)) {
        return `https://www.youtube.com/${channelName}`;
      }
      return null;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    const isYouTube = hostname.endsWith('youtube.com') || hostname === 'youtu.be';
    if (!isYouTube) {
      return null;
    }

    const pathname = urlObj.pathname;
    const handleMatch = pathname.match(/^\/@([^/]+)(\/.*)?$/);
    if (handleMatch) {
      return `https://www.youtube.com/@${handleMatch[1]}`;
    }

    const legacyMatch = pathname.match(/^\/(c|channel)\/([^/]+)(\/.*)?$/);
    if (legacyMatch) {
      return `https://www.youtube.com/${legacyMatch[1]}/${legacyMatch[2]}`;
    }

    return null;
  } catch {
    return null;
  }
};

export const channelMatchesFilter = (channelName: string, channelUrl: string, filterValue: string): boolean => {
  if (!filterValue) {
    return true;
  }

  const normalizedFilter = filterValue.trim().toLowerCase();
  if (!normalizedFilter) {
    return true;
  }

  return (
    channelName.toLowerCase().includes(normalizedFilter) ||
    channelUrl.toLowerCase().includes(normalizedFilter)
  );
};

export const DEFAULT_SUBFOLDER_KEY = '__default__';

/**
 * Sentinel value for explicitly specifying "use global default subfolder"
 * This distinguishes from NULL which means "download to root" (backwards compatible)
 */
export const GLOBAL_DEFAULT_SENTINEL = '##USE_GLOBAL_DEFAULT##';

/**
 * Sentinel value for explicitly specifying "download to root directory"
 * Used in manual downloads to override channel subfolder settings and download directly to root
 */
export const ROOT_SENTINEL = '##ROOT##';

export const normalizeSubFolderKey = (value?: string | null): string => {
  // null/empty = root (backwards compatible), so use a special key for display
  if (value === undefined || value === null || value === '') {
    return DEFAULT_SUBFOLDER_KEY;
  }
  if (value === GLOBAL_DEFAULT_SENTINEL) {
    return GLOBAL_DEFAULT_SENTINEL;
  }
  return value;
};

export const formatSubFolderLabel = (key: string): string => {
  if (key === DEFAULT_SUBFOLDER_KEY) {
    return 'root';
  }
  if (key === GLOBAL_DEFAULT_SENTINEL) {
    return 'global default';
  }
  return `__${key}/`;
};

/**
 * Check if a subfolder value means "use the global default"
 * @param value - The subfolder value from database or UI
 * @returns true if the value means "use default"
 */
export const isUsingDefaultSubfolder = (value: string | null | undefined): boolean => {
  return value === GLOBAL_DEFAULT_SENTINEL;
};

/**
 * Check if a subfolder value means "explicitly no subfolder (root)"
 * @param value - The subfolder value from database or UI
 * @returns true if the value means "explicitly root"
 */
export const isExplicitlyNoSubfolder = (value: string | null | undefined): boolean => {
  return value === null || value === undefined || value === '';
};

/**
 * Check if a subfolder value is the ROOT sentinel (explicit root override in downloads)
 * @param value - The subfolder value
 * @returns true if the value is the ROOT sentinel
 */
export const isExplicitlyRoot = (value: string | null | undefined): boolean => {
  return value === ROOT_SENTINEL;
};

