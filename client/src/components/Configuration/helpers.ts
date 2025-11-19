import { FREQUENCY_MAPPING } from './constants';

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

/**
 * Converts cron expression to human-readable frequency label
 */
export const reverseFrequencyMapping = (cronExpression: string): string => {
  for (const [key, value] of Object.entries(FREQUENCY_MAPPING)) {
    if (value === cronExpression) {
      return key;
    }
  }
  return cronExpression; // Return the cron expression if no match found
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
