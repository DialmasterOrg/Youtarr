import { decodeHtml } from '../../../utils/formatters';
import { YoutubeSearch, YoutubeSearchSource, useYoutubeSearch } from '../../../hooks/useYoutubeSearch';
import { ChannelSearchResult } from '../types';

const CHANNEL_SEARCH: YoutubeSearchSource<ChannelSearchResult> = {
  url: '/api/channels/search',
  decode: (r) => ({ ...r, name: r.name ? decodeHtml(r.name) : r.name }),
};

export function useChannelSearch(token: string | null): YoutubeSearch<ChannelSearchResult> {
  return useYoutubeSearch(token, CHANNEL_SEARCH);
}
