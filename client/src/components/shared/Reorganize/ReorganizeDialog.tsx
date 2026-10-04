import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
} from '../../ui';
import { ReorganizeChange, ReorganizeStartResult } from '../../../types/reorganize';
import { useReorganizePreview } from './hooks/useReorganizePreview';
import { useReorganizeOperation } from './hooks/useReorganizeOperation';
import ReorganizePreviewBody from './ReorganizePreviewBody';
import ReorganizeOperationBody from './ReorganizeOperationBody';
import { serverCodeOf, serverMessageOf } from './reorganizeErrors';
import { countOf } from './reorganizeText';

const STALE_PREVIEW_CODE = 'STALE_PREVIEW';

export interface ReorganizeDialogProps {
  open: boolean;
  token: string | null;
  /** The change to preview and apply */
  change?: ReorganizeChange | null;
  /** Show an operation's progress or result instead of a preview */
  operationId?: number | null;
  onClose: () => void;
  /** The change was applied (its files move in the background, or nothing had to move) */
  onApplied?: (result: ReorganizeStartResult) => void;
  /** A retry of the shown operation started (it applies the settings again when they were undone) */
  onRetried?: (operationId: number) => void;
}

/**
 * Review a change that moves downloaded files (the dry run), start it, and
 * follow it to its result.
 */
function ReorganizeDialog({
  open, token, change = null, operationId: initialOperationId = null, onClose, onApplied, onRetried,
}: ReorganizeDialogProps) {
  const [operationId, setOperationId] = useState<number | null>(initialOperationId);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // Ref, not state, so a double click can't start two operations.
  const startingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setOperationId(initialOperationId);
    setStartError(null);
    startingRef.current = false;
  }, [open, initialOperationId, change]);

  const previewing = open && operationId === null;
  const { preview, loading, error: previewError, refresh } = useReorganizePreview(token, previewing ? change : null);
  const { operation, error: operationError, retrying, retry } = useReorganizeOperation(token, open ? operationId : null);

  const start = async () => {
    if (!preview || !change || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    try {
      const response = await axios.post<ReorganizeStartResult>(
        '/api/tv/reorganize',
        { change, revision: preview.revision },
        { headers: { 'x-access-token': token || '' } }
      );
      onApplied?.(response.data);
      if (response.data.operationId) {
        setOperationId(response.data.operationId);
      } else {
        onClose();
      }
    } catch (err: unknown) {
      startingRef.current = false;
      setStartError(serverMessageOf(err, 'Failed to start the move'));
      if (serverCodeOf(err) === STALE_PREVIEW_CODE) await refresh();
    } finally {
      setStarting(false);
    }
  };

  const handleRetry = async () => {
    if (await retry() && operationId !== null) onRetried?.(operationId);
  };

  const running = operation !== null && (operation.status === 'running' || operation.status === 'starting');
  const canStart = Boolean(preview) && !loading && !preview?.blocked && !starting;
  const startLabel = preview && preview.needed ? `Move ${countOf(preview.totals.videos, 'video')}` : 'Apply';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle onClose={onClose}>{operationId === null ? 'Review the move' : 'Moving downloads'}</DialogTitle>
      <DialogContent>
        {operationId === null ? (
          <div className="flex flex-col gap-3 pt-2">
            {loading && <LinearProgress />}
            {previewError && <Alert severity="error">{previewError}</Alert>}
            {startError && <Alert severity="error">{startError}</Alert>}
            {preview && <ReorganizePreviewBody preview={preview} />}
          </div>
        ) : (
          <div className="pt-2">
            <ReorganizeOperationBody operation={operation} error={operationError} retrying={retrying} onRetry={() => { void handleRetry(); }} />
          </div>
        )}
      </DialogContent>
      <DialogActions>
        {operationId === null ? (
          <>
            <Button onClick={onClose} variant="outlined">Cancel</Button>
            <Button
              onClick={() => { void start(); }}
              variant="contained"
              disabled={!canStart}
              startIcon={starting ? <CircularProgress size={14} /> : undefined}
            >
              {startLabel}
            </Button>
          </>
        ) : (
          <Button onClick={onClose} variant="contained">{running ? 'Close' : 'Done'}</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ReorganizeDialog;
