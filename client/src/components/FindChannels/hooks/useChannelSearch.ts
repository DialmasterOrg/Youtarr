import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { decodeHtml } from '../../../utils/formatters';
import { ChannelSearchResult, PageSize } from '../types';

interface UseChannelSearchResult {
  results: ChannelSearchResult[];
  loading: boolean;
  error: string | null;
  search: (query: string, count: PageSize) => Promise<void>;
  cancel: () => void;
}

export function useChannelSearch(token: string | null): UseChannelSearchResult {
  const [results, setResults] = useState<ChannelSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

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
        '/api/channels/search',
        { query, count },
        {
          headers: token ? { 'x-access-token': token } : undefined,
          signal: controller.signal,
        }
      );
      // Late-arriving response from a superseded search: drop it.
      if (controllerRef.current !== controller) return;
      // The YouTube Data API HTML-encodes channel names (e.g. "Tom &amp; Jerry").
      // yt-dlp results are already plain, so decodeHtml is a no-op for them.
      const decoded = (res.data.results || []).map((r: ChannelSearchResult) => ({
        ...r,
        name: r.name ? decodeHtml(r.name) : r.name,
      }));
      setResults(decoded);
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

  return { results, loading, error, search, cancel };
}
