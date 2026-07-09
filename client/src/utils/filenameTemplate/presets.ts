export interface FilenamePreset {
  label: string;
  prefix: string;
  description: string;
}

export const DEFAULT_PRESET_PREFIX = '%(uploader,channel,uploader_id).80B - %(title).64B';

export const FILENAME_PRESETS: readonly FilenamePreset[] = [
  {
    label: 'Default',
    prefix: DEFAULT_PRESET_PREFIX,
    description: 'Channel name, hyphen, video title.',
  },
  {
    label: 'Date prefix',
    prefix: '%(upload_date>%Y-%m-%d)s - %(title).64B',
    description: 'Upload date (YYYY-MM-DD), hyphen, video title.',
  },
  {
    label: 'Plex YouTube-Agent',
    prefix: '%(upload_date>%Y_%m_%d)s %(title).64B',
    description: 'Compatible with Absolute-Series-Scanner / YouTube-Agent.bundle.',
  },
  {
    label: 'Plex TV Series',
    prefix: '%(timestamp>S%YE%m%d%H%M)s %(title).76B',
    description: 'Compatible with Plex TV series naming convention'
  },
  {
    label: 'Title only',
    prefix: '%(title).64B',
    description: 'Just the video title.',
  },
];
