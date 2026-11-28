import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

export interface ServerOwnedSecretSource {
  url: string;
  regenerateUrl: string;
  // The response field that holds the secret.
  field: string;
  loadError: string;
}

export interface ServerOwnedSecret {
  value: string | null;
  loading: boolean;
  error: string | null;
  regenerating: boolean;
  regenerate: () => Promise<boolean>;
}

/**
 * A secret the server owns. /getconfig leaves it out, so it is not part of the
 * config the Settings page saves.
 * @param source - Where it is read and replaced; a module-level constant
 * @param token - Session token
 * @param enabled - Whether to load it; the server creates the secret on first request
 */
export function useServerOwnedSecret(
  source: ServerOwnedSecretSource,
  token: string | null,
  enabled: boolean
): ServerOwnedSecret {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!token || !enabled) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get<Record<string, string>>(source.url, { headers: { 'x-access-token': token } })
      .then((response) => {
        if (!cancelled) setValue(response.data[source.field]);
      })
      .catch(() => {
        if (!cancelled) setError(source.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [source, token, enabled]);

  const regenerate = useCallback(async (): Promise<boolean> => {
    setRegenerating(true);
    try {
      const response = await axios.post<Record<string, string>>(source.regenerateUrl, null, {
        headers: { 'x-access-token': token ?? '' },
      });
      setValue(response.data[source.field]);
      return true;
    } catch {
      return false;
    } finally {
      setRegenerating(false);
    }
  }, [source, token]);

  return { value, loading, error, regenerating, regenerate };
}
