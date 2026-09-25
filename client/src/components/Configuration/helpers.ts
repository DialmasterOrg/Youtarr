/**
 * Formats bytes into human-readable file sizes
 */
export const formatBytes = (bytes: number): string => {
  if (!bytes || Number.isNaN(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const decimals = exponent === 0 ? 0 : exponent === 1 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[exponent]}`;
};

const STORAGE_SIZE_UNIT_BYTES: Record<string, number> = {
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

/**
 * Converts a storage size setting such as "500GB" or "2TB" to bytes, matching
 * the server's parser. Returns null for blank or unrecognized values.
 */
export const storageSizeToBytes = (value: string | null | undefined): number | null => {
  const match = /^(\d+)(MB|GB|TB)$/.exec(value || '');
  if (!match) {
    return null;
  }
  return Number(match[1]) * STORAGE_SIZE_UNIT_BYTES[match[2]];
};

/**
 * Generates channel files download options (1-10, plus current value if > 10)
 */
export const getChannelFilesOptions = (currentValue: number): number[] => {
  const options = [];
  // Always include 1-10
  for (let i = 1; i <= 10; i++) {
    options.push(i);
  }
  // If current value is greater than 10, include it as well
  if (currentValue > 10 && !options.includes(currentValue)) {
    options.push(currentValue);
    options.sort((a, b) => a - b);
  }
  return options;
};
