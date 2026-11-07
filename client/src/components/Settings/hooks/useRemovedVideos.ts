import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

export interface RemovedVideosLibraryCheck {
  ok: boolean;
  reason: string | null;
  path: string | null;
  message: string | null;
}

export interface RemovedVideosSummary {
  deleted: number;
  missing: number;
  // Deleted videos removed before Youtarr recorded why (a subset of deleted).
  legacy: number;
  libraryCheck: RemovedVideosLibraryCheck;
  // The failing library check covers missing videos: marking all of them as
  // deleted needs the user's say-so (empty folder only) and emptying them is refused.
  missingActionsBlocked: boolean;
  // A download is running, so emptying the trash with archive removal would be refused.
  downloadsActive: boolean;
}

export type TrashState = 'deleted' | 'missing';

export interface EmptyTrashOptions {
  states: TrashState[];
  removeFromArchive: boolean;
}

export interface MarkAllMissingOptions {
  // The user emptied the downloads folder (or a subfolder) on purpose; the
  // server honours it only while the check fails because a folder is empty.
  ignoreLibraryCheck?: boolean;
}

export interface EmptyTrashResult {
  purged: number;
  archiveEntriesRemoved: number;
  jobsAffected: number;
}

export interface UseRemovedVideosReturn {
  summary: RemovedVideosSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  // Both resolve null on failure, with the server's message in actionError.
  markAllMissingDeleted: (options?: MarkAllMissingOptions) => Promise<{ updated: number } | null>;
  emptyTrash: (options: EmptyTrashOptions) => Promise<EmptyTrashResult | null>;
  actionPending: boolean;
  actionError: string | null;
}

const LOAD_ERROR = 'Failed to load the deleted and missing video counts';

function serverMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof message === 'string' ? message : fallback;
}

export function useRemovedVideos(token: string | null): UseRemovedVideosReturn {
  const [summary, setSummary] = useState<RemovedVideosSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const headers = useCallback(() => ({ headers: { 'x-access-token': token ?? '' } }), [token]);

  const refetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await axios.get<RemovedVideosSummary>('/api/videos/removed-summary', headers());
      setSummary(response.data);
      setError(null);
    } catch {
      setError(LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const runAction = useCallback(async <T,>(request: () => Promise<{ data: T }>, fallback: string): Promise<T | null> => {
    setActionPending(true);
    setActionError(null);
    try {
      const response = await request();
      return response.data;
    } catch (err: unknown) {
      setActionError(serverMessage(err, fallback));
      return null;
    } finally {
      // Also after a failure: a purge that failed partway still forgot the
      // videos it reached, and a refusal can mean the library check changed.
      await refetch();
      setActionPending(false);
    }
  }, [refetch]);

  const markAllMissingDeleted = useCallback(
    ({ ignoreLibraryCheck = false }: MarkAllMissingOptions = {}) => runAction(
      () => axios.post<{ updated: number }>(
        '/api/videos/mark-deleted',
        ignoreLibraryCheck ? { all: true, ignoreLibraryCheck: true } : { all: true },
        headers()
      ),
      'Failed to mark videos as deleted'
    ),
    [runAction, headers]
  );

  const emptyTrash = useCallback(
    (options: EmptyTrashOptions) => runAction(
      () => axios.post<EmptyTrashResult>('/api/videos/purge-removed', options, headers()),
      'Failed to empty the trash'
    ),
    [runAction, headers]
  );

  return { summary, loading, error, refetch, markAllMissingDeleted, emptyTrash, actionPending, actionError };
}
