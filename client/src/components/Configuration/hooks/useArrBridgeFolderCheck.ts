import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ARR_APPS, ArrApp, ArrFolderCheck } from '../utils/arrBridgeSetup';

const checkUrl = (app: ArrApp) => `/api/arr-bridge/connections/${app}/shared-folder`;
const RATE_LIMITED_MESSAGE = 'Too many attempts. Wait a minute and check again.';
const FAILED_MESSAGE = 'Could not run the check.';

function failedCheck(err: unknown): ArrFolderCheck {
  const limited = axios.isAxiosError(err) && err.response?.status === 429;
  return { ok: false, message: limited ? RATE_LIMITED_MESSAGE : FAILED_MESSAGE };
}

/**
 * Asks each connected Sonarr and Radarr whether it can see the staging
 * folder it imports from. The server asks the app itself, read-only.
 * @param token - Session token; null skips the check
 * @param connected - Which apps have a saved connection
 * @param version - Changes when something saved changes that the answer
 *   depends on (the folder's path, a connection), which checks again
 */
export function useArrBridgeFolderCheck(token: string | null, connected: Record<ArrApp, boolean>, version: string) {
  const [results, setResults] = useState<Partial<Record<ArrApp, ArrFolderCheck>>>({});
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { sonarr, radarr } = connected;

  useEffect(() => {
    const apps = ARR_APPS.filter((app) => (app === 'sonarr' ? sonarr : radarr));
    if (!token || apps.length === 0) {
      setResults({});
      setChecking(false);
      return undefined;
    }

    let cancelled = false;
    setChecking(true);
    Promise.all(
      apps.map((app) => axios
        .get<ArrFolderCheck>(checkUrl(app), { headers: { 'x-access-token': token } })
        .then((response): [ArrApp, ArrFolderCheck] => [app, response.data])
        .catch((err: unknown): [ArrApp, ArrFolderCheck] => [app, failedCheck(err)]))
    ).then((entries) => {
      if (cancelled) return;
      setResults(Object.fromEntries(entries));
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token, sonarr, radarr, version, attempt]);

  const recheck = useCallback(() => setAttempt((count) => count + 1), []);

  return { results, checking, recheck };
}
