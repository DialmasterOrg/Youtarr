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
