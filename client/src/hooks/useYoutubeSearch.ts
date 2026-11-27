import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { serverErrorMessage } from '../utils/requestError';
import { PageSize } from '../types/youtubeSearch';

export interface YoutubeSearchSource<T> {
  url: string;
  // The YouTube Data API HTML-encodes text ("Tom &amp; Jerry"); this returns the
  // result with it decoded. yt-dlp results are already plain.
  decode: (result: T) => T;
  // Called with each completed search's results.
  onResults?: (query: string, count: PageSize, results: T[]) => void;
}

export interface YoutubeSearch<T> {
  results: T[];
  loading: boolean;
  error: string | null;
  search: (query: string, count: PageSize) => Promise<void>;
  cancel: () => void;
}

/**
 * One search at a time against a YouTube search endpoint: a new search or
 * `cancel` aborts the one in flight, and a late response is dropped.
 * @param token - Session token
 * @param source - The endpoint and its result handling; a module-level constant
 * @param initialResults - Results to show before the first search
 */
export function useYoutubeSearch<T>(
  token: string | null,
  source: YoutubeSearchSource<T>,
  initialResults?: T[]
): YoutubeSearch<T> {
  const [results, setResults] = useState<T[]>(() => initialResults ?? []);
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
        source.url,
        { query, count },
        {
          headers: token ? { 'x-access-token': token } : undefined,
          signal: controller.signal,
        }
      );
      // Late-arriving response from a superseded search: drop it.
      if (controllerRef.current !== controller) return;
      const decoded: T[] = (res.data.results || []).map(source.decode);
      setResults(decoded);
      source.onResults?.(query, count, decoded);
    } catch (err: unknown) {
      if (axios.isCancel(err)) {
        // user canceled or superseded; do not surface as error
      } else if (controllerRef.current === controller) {
        setError(serverErrorMessage(err, 'Search failed'));
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }, [token, source]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { results, loading, error, search, cancel };
}
