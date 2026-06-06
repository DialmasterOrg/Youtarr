import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { SearchResult, PageSize } from '../types';

interface UseVideoSearchResult {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  search: (query: string, count: PageSize) => Promise<void>;
  cancel: () => void;
}

export function useVideoSearch(token: string | null): UseVideoSearchResult {
  const [results, setResults] = useState<SearchResult[]>([]);
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
        '/api/videos/search',
        { query, count },
        {
          headers: token ? { 'x-access-token': token } : undefined,
          signal: controller.signal,
        }
      );
      // Late-arriving response from a superseded search: drop it.
      if (controllerRef.current !== controller) return;
      setResults(res.data.results || []);
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
