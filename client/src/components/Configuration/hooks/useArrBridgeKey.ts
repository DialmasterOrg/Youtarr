import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const KEY_URL = '/api/arr-bridge/key';
const REGENERATE_URL = '/api/arr-bridge/key/regenerate';

interface BridgeKeyResponse {
  key: string;
}

/**
 * The key Sonarr and Radarr send to Youtarr. The server owns it and /getconfig
 * leaves it out, so it is not part of the config this page saves.
 * @param token - Session token
 * @param enabled - Whether to load it; the server creates the key on first request
 */
export function useArrBridgeKey(token: string | null, enabled: boolean) {
  const [bridgeKey, setBridgeKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!token || !enabled) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get<BridgeKeyResponse>(KEY_URL, { headers: { 'x-access-token': token } })
      .then((response) => {
        if (!cancelled) setBridgeKey(response.data.key);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the key.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, enabled]);

  const regenerate = useCallback(async (): Promise<boolean> => {
    setRegenerating(true);
    try {
      const response = await axios.post<BridgeKeyResponse>(REGENERATE_URL, null, {
        headers: { 'x-access-token': token ?? '' },
      });
      setBridgeKey(response.data.key);
      return true;
    } catch {
      return false;
    } finally {
      setRegenerating(false);
    }
  }, [token]);

  return { bridgeKey, loading, error, regenerating, regenerate };
}
