import { useCallback, useState } from 'react';
import axios from 'axios';
import { ArrGrabRetryOutcome, SERVER_RETRY_OUTCOMES } from '../utils/arrBridgeSetup';

const HTTP_CONFLICT = 409;

export interface ArrGrabRetry {
  /** Tries a waiting grab now; resolves once the outcome is known. */
  retry: (grabId: string) => Promise<void>;
  /** The grab a try is being asked for, if any. */
  busyId: string | null;
  /** What the last try of each grab led to, by grab id. */
  outcomes: Record<string, ArrGrabRetryOutcome>;
}

function outcomeOf(result: unknown): ArrGrabRetryOutcome {
  const known = SERVER_RETRY_OUTCOMES.find((outcome) => outcome === result);
  return known ?? 'failed';
}

/**
 * "Try again" on a grab that waits while YouTube blocks downloads.
 * @param token - Session token
 * @param onDone - Called after every try, so the list can load the grab's new state
 */
export function useArrBridgeGrabRetry(token: string | null, onDone: () => void): ArrGrabRetry {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, ArrGrabRetryOutcome>>({});

  const retry = useCallback(async (grabId: string) => {
    if (!token) return;
    setBusyId(grabId);
    let outcome: ArrGrabRetryOutcome;
    try {
      const response = await axios.post<{ result?: unknown }>(
        `/api/arr-bridge/grabs/${encodeURIComponent(grabId)}/retry`,
        null,
        { headers: { 'x-access-token': token } }
      );
      outcome = outcomeOf(response.data?.result);
    } catch (err: unknown) {
      const notWaiting = axios.isAxiosError(err) && err.response?.status === HTTP_CONFLICT;
      outcome = notWaiting ? 'not-waiting' : 'failed';
    }
    setOutcomes((current) => ({ ...current, [grabId]: outcome }));
    setBusyId(null);
    onDone();
  }, [token, onDone]);

  return { retry, busyId, outcomes };
}
