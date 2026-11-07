import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const TOKEN_URL = '/api/feeds/downloads/token';
const REGENERATE_URL = '/api/feeds/downloads/regenerate-token';

interface FeedTokenResponse {
  token: string;
}

/**
 * The secret in the download feed URL. The server owns it and /getconfig leaves
 * it out, so it is not part of the config this page saves.
 * @param token - Session token
 * @param enabled - Whether to load it; the server creates the token on first request
 */
export function useDownloadsFeedToken(token: string | null, enabled: boolean) {
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!token || !enabled) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get<FeedTokenResponse>(TOKEN_URL, { headers: { 'x-access-token': token } })
      .then((response) => {
        if (!cancelled) setFeedToken(response.data.token);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the feed URL.');
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
      const response = await axios.post<FeedTokenResponse>(REGENERATE_URL, null, {
        headers: { 'x-access-token': token ?? '' },
      });
      setFeedToken(response.data.token);
      return true;
    } catch {
      return false;
    } finally {
      setRegenerating(false);
    }
  }, [token]);

  return { feedToken, loading, error, regenerating, regenerate };
}
