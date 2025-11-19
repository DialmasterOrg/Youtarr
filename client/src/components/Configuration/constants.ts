export const FREQUENCY_MAPPING: { [key: string]: string } = {
  'Every 15 minutes': '*/15 * * * *',
  'Every 30 minutes': '*/30 * * * *',
  'Hourly': '0 * * * *',
  'Every 4 hours': '0 */4 * * *',
  'Every 6 hours': '0 */6 * * *',
  'Every 12 hours': '0 */12 * * *',
  'Daily': '0 0 * * *',
  'Weekly': '0 0 * * 0',
};