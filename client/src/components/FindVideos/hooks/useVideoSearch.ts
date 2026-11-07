import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { decodeHtml } from '../../../utils/formatters';
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

interface UseVideoSearchResult {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  restored: RestoredSearch | null;
  search: (query: string, count: PageSize) => Promise<void>;
  cancel: () => void;
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

export function useVideoSearch(token: string | null, options: UseVideoSearchOptions = {}): UseVideoSearchResult {
  const [restoredSearch] = useState<LastSearch | null>(() => readLastSearch(options.restoreQuery));
  const [results, setResults] = useState<SearchResult[]>(() => restoredSearch?.results ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const restored = restoredSearch ? { query: restoredSearch.query, count: restoredSearch.count } : null;

  useEffect(() => {
    return () => { controllerRef.current?.abort(); };
  }, []);

  const search = useCallback(async (query: string, count: PageSize) => {
    // Cancel any in-flight search so a stale response cannot overwrite a newer
    // one and leave the prior search's results stuck on the page.
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await axios.post(
        '/api/videos/search',
        { query, count },
        {
          headers: token ? { 'x-access-token': token } : undefined,
          signal: controller.signal,
        }
      );
      // Late-arriving response from a superseded search: drop it.
      if (controllerRef.current !== controller) return;
      // The YouTube Data API HTML-encodes titles/channel names (e.g. "Rubik&#39;s").
      // Decode here so all result views render plain text; yt-dlp results are already
      // plain, so decodeHtml is a no-op for them.
      const decoded = (res.data.results || []).map((r: SearchResult) => ({
        ...r,
        title: r.title ? decodeHtml(r.title) : r.title,
        channelName: r.channelName ? decodeHtml(r.channelName) : r.channelName,
      }));
      setResults(decoded);
      writeLastSearch({ query, count, results: decoded });
    } catch (err: unknown) {
      if (axios.isCancel(err)) {
        // user canceled or superseded; do not surface as error
      } else if (controllerRef.current === controller) {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
          || 'Search failed';
        setError(message);
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }, [token]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { results, loading, error, restored, search, cancel };
}
