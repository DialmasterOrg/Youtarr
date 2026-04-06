import { RowSettings } from '../../../types/subscriptionImport';

export const QUALITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Use global default' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '1440p', label: '1440p' },
  { value: '2160p', label: '2160p' },
  { value: 'best', label: 'best' },
];

export const DOWNLOAD_TYPE_OPTIONS: Array<{ value: RowSettings['downloadType']; label: string }> = [
  { value: 'videos', label: 'Videos' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'livestreams', label: 'Livestreams' },
];

export const RATING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Use global default' },
  { value: 'G', label: 'G' },
  { value: 'PG', label: 'PG' },
  { value: 'PG-13', label: 'PG-13' },
  { value: 'R', label: 'R' },
  { value: 'NC-17', label: 'NC-17' },
];
