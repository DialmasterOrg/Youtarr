import { useCallback, useState } from 'react';
import type { LibraryLayout } from '../../../types/tvShows';
import type { ReorganizeChange, ReorganizeStartResult } from '../../../types/reorganize';
import { LIBRARY_FOLDERS_UPDATED_EVENT } from '../../../hooks/useLibraryFolders';
import { useReorganizeOutcome, useReorganizeRequest } from '../../shared/Reorganize';

export interface ReorganizeHandoffContext {
  kind: 'layout' | 'default' | 'create';
  folder: string;
  target?: LibraryLayout;
}

interface Options {
  /** Refetch folders and the check */
  onSettled: () => void;
  onLayoutMoving: (folder: string, target: LibraryLayout) => void;
  /** A move the page started ended: replace its moving line */
  onLayoutSettled: (folder: string, target: LibraryLayout) => void;
  /** Patches the config and announces the folder change (which refetches folders and the check); null when it failed */
  readBackDefault: () => Promise<string | null>;
}

interface TrackedOperation {
  operationId: number;
  attempt: number;
  kind: ReorganizeHandoffContext['kind'];
  folder: string;
  target?: LibraryLayout;
}

/**
 * The page's hand-off to the shared ReorganizeDialog (UI 7.5): opens it on a
 * change, follows the started operation to each end, and reads the default
 * folder back for a default switch, since the server undoes the change when
 * nothing moved. Each settle refreshes once.
 */
export function useReorganizeHandoff(token: string | null, { onSettled, onLayoutMoving, onLayoutSettled, readBackDefault }: Options) {
  const request = useReorganizeRequest();
  const [context, setContext] = useState<ReorganizeHandoffContext | null>(null);
  const [tracked, setTracked] = useState<TrackedOperation | null>(null);
  const { review: openReview, close } = request;

  const review = useCallback((change: ReorganizeChange, next: ReorganizeHandoffContext) => {
    setContext(next);
    openReview(change);
  }, [openReview]);

  // The read-back's announcement refetches folders and the check; refresh here only when it failed.
  const settleDefault = useCallback(() => {
    void Promise.resolve(readBackDefault()).then((value) => {
      if (value === null) onSettled();
    });
  }, [readBackDefault, onSettled]);

  const onApplied = useCallback((result: ReorganizeStartResult) => {
    window.dispatchEvent(new Event(LIBRARY_FOLDERS_UPDATED_EVENT));
    if (result.operationId && context && context.kind !== 'default' && context.target) onLayoutMoving(context.folder, context.target);
    if (result.operationId) {
      setTracked({
        operationId: result.operationId, attempt: 0, kind: context?.kind ?? 'layout', folder: context?.folder ?? '', target: context?.target,
      });
    }
  }, [context, onLayoutMoving]);

  const onRetried = useCallback((operationId: number) => {
    setTracked((current) => (current && current.operationId === operationId ? { ...current, attempt: current.attempt + 1 } : current));
  }, []);

  const onClose = useCallback(() => {
    const kind = context?.kind;
    close();
    setContext(null);
    if (kind === 'default') settleDefault();
    else onSettled();
  }, [close, context, onSettled, settleDefault]);

  useReorganizeOutcome(token, tracked?.operationId ?? null, () => {
    if (!tracked) return;
    if (tracked.kind === 'default') {
      settleDefault();
      return;
    }
    onSettled();
    if (tracked.target) onLayoutSettled(tracked.folder, tracked.target);
  }, { attempt: tracked?.attempt ?? 0 });

  return {
    review,
    /** The operation this page started and follows to its end, or null */
    trackedOperationId: tracked?.operationId ?? null,
    dialogProps: {
      open: request.open, change: request.change, operationId: request.operationId, onClose, onApplied, onRetried,
    },
  };
}
