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
}

export type PageSize = 10 | 25 | 50;
export const PAGE_SIZES: PageSize[] = [10, 25, 50];
export const DEFAULT_PAGE_SIZE: PageSize = 25;
