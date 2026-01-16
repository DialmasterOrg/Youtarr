import { useState, useEffect, useCallback, useRef } from 'react';

const CHANGELOG_URL =
  'https://raw.githubusercontent.com/DialmasterOrg/Youtarr/main/CHANGELOG.md';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

interface UseChangelogResult {
  content: string | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Simple in-memory cache
let cache: { content: string; timestamp: number } | null = null;

export const resetChangelogCache = () => {
  cache = null;
};

export const useChangelog = (): UseChangelogResult => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchChangelog = useCallback(async (bypassCache = false) => {
    // Check cache first (unless bypassing)
    if (!bypassCache && cache && Date.now() - cache.timestamp < CACHE_DURATION_MS) {
      if (isMounted.current) {
        setContent(cache.content);
        setLoading(false);
      }
      return;
    }

    if (isMounted.current) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await fetch(CHANGELOG_URL);

      if (!response.ok) {
        throw new Error(`Failed to fetch changelog: ${response.statusText}`);
      }

      const text = await response.text();

      // Update cache
      cache = { content: text, timestamp: Date.now() };

      if (isMounted.current) {
        setContent(text);
      }
    } catch (err) {
      if (isMounted.current) {
        console.error('Failed to fetch changelog:', err);
        setError(err instanceof Error ? err.message : 'Failed to load changelog');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchChangelog();
  }, [fetchChangelog]);

  // refetch always bypasses cache for manual refresh
  const refetch = useCallback(() => fetchChangelog(true), [fetchChangelog]);

  return {
    content,
    loading,
    error,
    refetch,
  };
};
