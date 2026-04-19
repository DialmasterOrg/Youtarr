export type SearchResultStatus = 'downloaded' | 'missing' | 'never_downloaded';

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

export type PageSize = 10 | 25 | 50;
export const PAGE_SIZES: PageSize[] = [10, 25, 50];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

export type ViewMode = 'grid' | 'table';

export const THUMB_WIDTH = 120;
export const THUMB_HEIGHT = 67;
