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

export const normalizeSubFolderKey = (value?: string | null): string => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_SUBFOLDER_KEY;
  }
  return value;
};

export const formatSubFolderLabel = (key: string): string => {
  if (key === DEFAULT_SUBFOLDER_KEY) {
    return 'default';
  }
  return `__${key}/`;
};
