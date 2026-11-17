import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ArrSearch } from '../utils/arrBridgeSearches';

const SEARCHES_URL = '/api/arr-bridge/searches';

interface SearchesResponse {
  searches: ArrSearch[];
}

/**
 * The latest searches Sonarr and Radarr sent. Loaded when the list opens and
 * on refresh; it does not poll.
 * @param token - Session token
 * @param enabled - Whether to load it
 */
export function useArrBridgeSearches(token: string | null, enabled: boolean) {
  const [searches, setSearches] = useState<ArrSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!token || !enabled) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get<SearchesResponse>(SEARCHES_URL, { headers: { 'x-access-token': token } })
      .then((response) => {
        if (!cancelled) setSearches(Array.isArray(response.data.searches) ? response.data.searches : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the recent searches.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, enabled, reloadCount]);

  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

  return { searches, loading, error, refresh };
}
