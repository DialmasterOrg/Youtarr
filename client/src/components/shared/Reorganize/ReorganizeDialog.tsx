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
import { ReorganizeChange, ReorganizeOperation, ReorganizeStartResult } from '../../../types/reorganize';
import { useReorganizePreview } from './hooks/useReorganizePreview';
import { useReorganizeOperation } from './hooks/useReorganizeOperation';
import ReorganizePreviewBody from './ReorganizePreviewBody';
import ReorganizeOperationBody from './ReorganizeOperationBody';
import { isReorganizeRequired, serverCodeOf, toRequestError } from './reorganizeErrors';
import { useLibraryCheck } from '../../../hooks/useLibraryCheck';
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
  /** What to show under the result once the move finished (completed or partial); gets the operation so a partial result can say something else */
  afterMove?: (operation: ReorganizeOperation) => React.ReactNode;
  /** Opens the main folder move when the server asks for it before this change */
  onMainFolderMoveRequired?: (change: ReorganizeChange) => void;
}

/**
 * Review a change that moves downloaded files (the dry run), start it, and
 * follow it to its result.
 */
function ReorganizeDialog({
  open, token, change = null, operationId: initialOperationId = null, onClose, onApplied, onRetried, afterMove,
  onMainFolderMoveRequired,
}: ReorganizeDialogProps) {
  const [operationId, setOperationId] = useState<number | null>(initialOperationId);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [startRequiredChange, setStartRequiredChange] = useState<ReorganizeChange | null>(null);
  // Ref, not state, so a double click can't start two operations.
  const startingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setOperationId(initialOperationId);
    setStartError(null);
    setStartRequiredChange(null);
    startingRef.current = false;
  }, [open, initialOperationId, change]);

  const previewing = open && operationId === null;
  const { preview, loading, error: previewError, requiredChange: previewRequiredChange, refresh } = useReorganizePreview(token, previewing ? change : null);
  const { operation, error: operationError, retrying, retry } = useReorganizeOperation(token, open ? operationId : null);
  const tvFolders = preview?.tvFolders ?? [];
  // Checked as TV folders: a folder switching layouts is still saved as a Videos folder until the move.
  const { data: libraryCheck } = useLibraryCheck(token, {
    folders: tvFolders, layout: 'tv', enabled: previewing && tvFolders.length > 0,
  });

  const start = async () => {
    if (!preview || !change || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setStartError(null);
    setStartRequiredChange(null);
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
      const failure = toRequestError(err, 'Failed to start the move');
      setStartError(failure.message);
      setStartRequiredChange(isReorganizeRequired(failure) ? failure.change : null);
      if (serverCodeOf(err) === STALE_PREVIEW_CODE) await refresh();
    } finally {
      setStarting(false);
    }
  };

  const handleRetry = async () => {
    if (await retry() && operationId !== null) onRetried?.(operationId);
  };

  const mainFolderMoveFor = (requiredChange: ReorganizeChange | null) => (
    requiredChange?.type === 'mainFolderMove' && onMainFolderMoveRequired ? (
      <div>
        <Button size="sm" variant="outlined" onClick={() => onMainFolderMoveRequired(requiredChange)}>
          Review the main folder move
        </Button>
      </div>
    ) : null
  );

  const running = operation !== null && (operation.status === 'running' || operation.status === 'starting');
  const finished = operation !== null && (operation.status === 'completed' || operation.status === 'partial');
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
            {previewError && mainFolderMoveFor(previewRequiredChange)}
            {startError && <Alert severity="error">{startError}</Alert>}
            {startError && mainFolderMoveFor(startRequiredChange)}
            {preview && <ReorganizePreviewBody preview={preview} libraryCheck={libraryCheck} />}
          </div>
        ) : (
          <div className="pt-2">
            <ReorganizeOperationBody operation={operation} error={operationError} retrying={retrying} onRetry={() => { void handleRetry(); }} />
            {finished && operation && afterMove?.(operation)}
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
