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

export type { PageSize } from '../../types/youtubeSearch';
export { PAGE_SIZES, DEFAULT_PAGE_SIZE } from '../../types/youtubeSearch';
