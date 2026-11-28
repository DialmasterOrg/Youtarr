import { useState } from 'react';
import { decodeHtml } from '../../../utils/formatters';
import { YoutubeSearch, YoutubeSearchSource, useYoutubeSearch } from '../../../hooks/useYoutubeSearch';
import { SearchResult, PageSize, PAGE_SIZES } from '../types';

export const LAST_SEARCH_STORAGE_KEY = 'findVideos.lastSearch';

interface LastSearch {
  query: string;
  count: PageSize;
  results: SearchResult[];
}

export interface RestoredSearch {
  query: string;
  count: PageSize;
}

interface UseVideoSearchOptions {
  // The query the page was opened with (`?q=`): when it matches the remembered
  // search, its results are shown again without spending another request.
  restoreQuery?: string | null;
}

interface UseVideoSearchResult extends YoutubeSearch<SearchResult> {
  restored: RestoredSearch | null;
}

function readLastSearch(query: string | null | undefined): LastSearch | null {
  if (!query) return null;
  try {
    const raw = window.sessionStorage.getItem(LAST_SEARCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { query: storedQuery, count, results } = parsed as Partial<LastSearch>;
    if (storedQuery !== query || !Array.isArray(results)) return null;
    if (!PAGE_SIZES.includes(count as PageSize)) return null;
    return { query: storedQuery, count: count as PageSize, results };
  } catch {
    return null;
  }
}

function writeLastSearch(entry: LastSearch) {
  try {
    window.sessionStorage.setItem(LAST_SEARCH_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage unavailable or full; the results are still on screen.
  }
}

const VIDEO_SEARCH: YoutubeSearchSource<SearchResult> = {
  url: '/api/videos/search',
  decode: (r) => ({
    ...r,
    title: r.title ? decodeHtml(r.title) : r.title,
    channelName: r.channelName ? decodeHtml(r.channelName) : r.channelName,
  }),
  onResults: (query, count, results) => writeLastSearch({ query, count, results }),
};

export function useVideoSearch(token: string | null, options: UseVideoSearchOptions = {}): UseVideoSearchResult {
  const [restoredSearch] = useState<LastSearch | null>(() => readLastSearch(options.restoreQuery));
  const searchState = useYoutubeSearch(token, VIDEO_SEARCH, restoredSearch?.results);
  const restored = restoredSearch ? { query: restoredSearch.query, count: restoredSearch.count } : null;

  return { ...searchState, restored };
}
