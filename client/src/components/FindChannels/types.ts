export interface ChannelSearchResult {
  channelId: string;
  name: string;
  handle: string | null;
  url: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  description: string | null;
  subscribed: boolean;
}

export type PageSize = 10 | 25 | 50 | 100;
export const PAGE_SIZES: PageSize[] = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE: PageSize = 25;
