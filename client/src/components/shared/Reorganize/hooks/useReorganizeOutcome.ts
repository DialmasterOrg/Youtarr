import { useEffect, useRef } from 'react';
import { ReorganizeOperation } from '../../../../types/reorganize';
import { useReorganizeOperation } from './useReorganizeOperation';

const RUNNING_STATUSES = new Set<ReorganizeOperation['status']>(['starting', 'running']);

export interface UseReorganizeOutcomeOptions {
  /** Bumped when a retry of the operation starts, so its end is reported too */
  attempt?: number;
}

/**
 * Follow a reorganize to its end and call back once per run with its final
 * state, whether or not the dialog showing it is still open. The server
 * undoes the settings change when no video could be moved (and applies it
 * again when a retry moves some), so what the caller saved optimistically
 * must be read back at each end. Each run ends with its own `finishedAt`,
 * which tells a retry's end from the one already reported.
 */
export function useReorganizeOutcome(
  token: string | null,
  operationId: number | null,
  onFinished: (operation: ReorganizeOperation) => void,
  { attempt = 0 }: UseReorganizeOutcomeOptions = {}
): void {
  const { operation, refetch } = useReorganizeOperation(token, operationId);
  const handledEnd = useRef<string | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // A retry reopened the operation on the server: read it again.
  useEffect(() => {
    if (operationId !== null && attempt > 0) void refetch();
  }, [operationId, attempt, refetch]);

  useEffect(() => {
    if (!operation || operation.id === null || RUNNING_STATUSES.has(operation.status)) return;
    const end = `${operation.id}:${operation.finishedAt ?? ''}`;
    if (handledEnd.current === end) return;
    handledEnd.current = end;
    onFinishedRef.current(operation);
  }, [operation]);
}

export default useReorganizeOutcome;
