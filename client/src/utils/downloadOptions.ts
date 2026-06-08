export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Canonical maximum-resolution choices, ordered low -> high.
 * Single source of truth for every resolution/quality dropdown.
 */
export const RESOLUTION_OPTIONS: SelectOption[] = [
  { value: '360', label: '360p' },
  { value: '480', label: '480p' },
  { value: '720', label: '720p (HD)' },
  { value: '1080', label: '1080p (Full HD)' },
  { value: '1440', label: '1440p (2K)' },
  { value: '2160', label: '2160p (4K)' },
];

/**
 * Audio/download-type choices. The empty (video-only) default is rendered by the
 * consuming component via its `emptyLabel`, so it is intentionally not listed here.
 */
export const AUDIO_FORMAT_OPTIONS: SelectOption[] = [
  { value: 'video_mp3', label: 'Video + MP3' },
  { value: 'mp3_only', label: 'MP3 Only' },
];
