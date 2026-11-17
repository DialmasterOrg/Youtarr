import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ArrApp, ArrBridgeStatus, ArrConnectionResult, ArrConnectionView } from '../utils/arrBridgeSetup';

const STATUS_URL = '/api/arr-bridge/status';
const connectionUrl = (app: ArrApp) => `/api/arr-bridge/connections/${app}`;
const RATE_LIMITED_MESSAGE = 'Too many attempts. Wait a minute and try again.';

function failedResult(err: unknown, fallback: string): ArrConnectionResult {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 429) return { ok: false, message: RATE_LIMITED_MESSAGE };
    const data = err.response?.data as { error?: unknown } | undefined;
    if (err.response?.status === 400 && typeof data?.error === 'string') return { ok: false, message: data.error };
  }
  return { ok: false, message: fallback };
}

/**
 * The bridge's status and the connections to the user's own Sonarr and
 * Radarr. A connection is saved outside the page's Save button: the server
 * tests the address and key and stores them together, and never returns a key.
 * @param token - Session token
 */
export function useArrBridgeConnections(token: string | null) {
  const [status, setStatus] = useState<ArrBridgeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyApp, setBusyApp] = useState<ArrApp | null>(null);

  useEffect(() => {
    if (!token) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get<ArrBridgeStatus>(STATUS_URL, { headers: { 'x-access-token': token } })
      .then((response) => {
        if (!cancelled) setStatus(response.data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the Sonarr and Radarr connections.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const setConnection = useCallback((app: ArrApp, connection: ArrConnectionView) => {
    setStatus((current) => (
      current ? { ...current, connections: { ...current.connections, [app]: connection } } : current
    ));
  }, []);

  const save = useCallback(async (app: ArrApp, url: string, apiKey: string): Promise<ArrConnectionResult> => {
    setBusyApp(app);
    try {
      const response = await axios.put<ArrConnectionResult>(connectionUrl(app), { url, apiKey }, {
        headers: { 'x-access-token': token ?? '' },
      });
      if (response.data.ok && response.data.connection) setConnection(app, response.data.connection);
      return response.data;
    } catch (err: unknown) {
      return failedResult(err, 'Could not save the connection.');
    } finally {
      setBusyApp(null);
    }
  }, [token, setConnection]);

  const test = useCallback(async (app: ArrApp): Promise<ArrConnectionResult> => {
    setBusyApp(app);
    try {
      const response = await axios.post<ArrConnectionResult>(`${connectionUrl(app)}/test`, null, {
        headers: { 'x-access-token': token ?? '' },
      });
      return response.data;
    } catch (err: unknown) {
      return failedResult(err, 'Could not test the connection.');
    } finally {
      setBusyApp(null);
    }
  }, [token]);

  const remove = useCallback(async (app: ArrApp): Promise<boolean> => {
    setBusyApp(app);
    try {
      const response = await axios.delete<{ connection: ArrConnectionView }>(connectionUrl(app), {
        headers: { 'x-access-token': token ?? '' },
      });
      setConnection(app, response.data.connection);
      return true;
    } catch {
      return false;
    } finally {
      setBusyApp(null);
    }
  }, [token, setConnection]);

  return { status, loading, error, busyApp, save, test, remove };
}
