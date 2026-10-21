import type { RemovalReason } from '../../utils/videoRemoval';

export type SearchResultStatus = 'downloaded' | 'deleted' | 'missing' | 'never_downloaded' | 'queued' | 'downloading';

export interface SearchResult {
  youtubeId: string;
  title: string;
  channelName: string;
  channelId: string | null;
  duration: number | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  viewCount: number | null;
  status: SearchResultStatus;
  // The video's channel is an enabled subscription (set by the search, not by
  // the local-status refresh, which has no channel id to answer with).
  channelSubscribed?: boolean;
  // Listed in the download archive without a database record, so a download
  // skips it unless re-downloading is allowed.
  inArchive?: boolean;
  // Why the file is gone, for a 'deleted' or 'missing' status (see utils/videoRemoval).
  removedReason?: RemovalReason | null;
  removedAt?: string | null;
  removedDetail?: string | null;
  isDownloaded?: boolean;
  databaseId?: number | null;
  filePath?: string | null;
  fileSize?: number | null;
  audioFilePath?: string | null;
  audioFileSize?: number | null;
  addedAt?: string | null;
  isProtected?: boolean;
  normalizedRating?: string | null;
  ratingSource?: string | null;
}

export type PageSize = 10 | 25 | 50 | 100;
export const PAGE_SIZES: PageSize[] = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

export type ViewMode = 'grid' | 'table';

// Minimum-duration filter applied client-side. 0 = no filter, show everything
// (including Shorts). Other values are minimum seconds.
export type MinDuration = 0 | 60 | 180 | 300 | 600 | 900 | 1200;
export const MIN_DURATIONS: MinDuration[] = [0, 60, 180, 300, 600, 900, 1200];
export const DEFAULT_MIN_DURATION: MinDuration = 0;
export const MIN_DURATION_LABELS: Record<MinDuration, string> = {
  0: 'Any length',
  60: '1+ min (hides Shorts)',
  180: '3+ min',
  300: '5+ min',
  600: '10+ min',
  900: '15+ min',
  1200: '20+ min',
};

export const MIN_DURATION_STORAGE_KEY = 'findVideos.minDuration';

// YouTube's original Shorts limit; search results carry no vertical-video flag,
// so length is the only signal.
export const SHORT_MAX_SECONDS = 60;

export function isShort(duration: number | null): boolean {
  return duration !== null && duration <= SHORT_MAX_SECONDS;
}

export const THUMB_WIDTH = 120;
export const THUMB_HEIGHT = 67;

export interface ResultSelection {
  isChecked: (id: string) => boolean;
  toggle: (id: string) => void;
}

// Eligible to multi-select for download. Includes 'missing' and 'deleted' so
// users can bulk re-download videos whose files are gone; the
// DownloadSettingsDialog already surfaces the allow-redownload toggle for that case.
export function isSelectableForDownload(status: SearchResultStatus): boolean {
  return status === 'never_downloaded' || status === 'missing' || status === 'deleted';
}
