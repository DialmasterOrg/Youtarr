import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ArrGrab } from '../utils/arrBridgeSetup';

const GRABS_URL = '/api/arr-bridge/grabs';

interface GrabsResponse {
  grabs: ArrGrab[];
}

/**
 * The newest Sonarr/Radarr grabs. Loaded when the list opens and on refresh;
 * it does not poll.
 * @param token - Session token
 * @param enabled - Whether to load it
 */
export function useArrBridgeGrabs(token: string | null, enabled: boolean) {
  const [grabs, setGrabs] = useState<ArrGrab[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!token || !enabled) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get<GrabsResponse>(GRABS_URL, { headers: { 'x-access-token': token } })
      .then((response) => {
        if (!cancelled) setGrabs(Array.isArray(response.data.grabs) ? response.data.grabs : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the recent grabs.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, enabled, reloadCount]);

  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

  return { grabs, loading, error, refresh };
}
