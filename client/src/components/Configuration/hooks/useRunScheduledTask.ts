import { useCallback, useState } from 'react';
import axios from 'axios';
import { ScheduleKey } from '../schedules';

const START_ERROR_MESSAGE = 'Could not start the task.';
const HTTP_CONFLICT = 409;

function describeStartError(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return START_ERROR_MESSAGE;
  // A 409 means the task can't run now; the refreshed status shows why.
  if (err.response?.status === HTTP_CONFLICT) return null;
  const message = (err.response?.data as { error?: unknown } | undefined)?.error;
  return typeof message === 'string' ? message : START_ERROR_MESSAGE;
}

// Starts a scheduled task from the Scheduling page. onChange refetches the
// status, which reports the run as running as soon as the server accepts it.
export function useRunScheduledTask(token: string | null, onChange: () => void | Promise<void>) {
  // Keyed by task: requests for different cards can overlap and finish in any order.
  const [pending, setPending] = useState<Partial<Record<ScheduleKey, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<ScheduleKey, string>>>({});

  const runTask = useCallback(async (key: ScheduleKey) => {
    if (!token) return;
    setPending((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    try {
      await axios.post(`/api/schedules/${key}/run`, null, { headers: { 'x-access-token': token } });
    } catch (err: unknown) {
      const message = describeStartError(err);
      if (message) setErrors((prev) => ({ ...prev, [key]: message }));
    } finally {
      // Wait for the refetch so the button doesn't flash back to enabled
      // between the pending state clearing and the running status arriving.
      try {
        await onChange();
      } catch {
        // A failed refetch shouldn't block clearing the pending state.
      }
      setPending((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [token, onChange]);

  return { pending, errors, runTask };
}
