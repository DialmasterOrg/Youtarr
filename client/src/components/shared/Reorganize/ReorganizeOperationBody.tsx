import React from 'react';
import { Alert, Box, Button, LinearProgress, Typography } from '../../ui';
import { ReorganizeOperation } from '../../../types/reorganize';
import { agree, countOf, DOWNLOADS_WAIT_NOTE } from './reorganizeText';

interface ReorganizeOperationBodyProps {
  operation: ReorganizeOperation | null;
  error: string | null;
  retrying: boolean;
  onRetry: () => void;
}

function isRunning(operation: ReorganizeOperation): boolean {
  return operation.status === 'running' || operation.status === 'starting';
}

function resultAlert(operation: ReorganizeOperation) {
  const done = operation.done ?? 0;
  const failed = operation.failed ?? 0;
  if (operation.status === 'completed') {
    return <Alert severity="success">Moved {countOf(done, 'video')}.</Alert>;
  }
  if (operation.status === 'partial') {
    const unfinished = (operation.failedItems ?? []).filter((item) => item.filesMoved).length;
    const stayed = Math.max(failed - unfinished, 0);
    const parts = [`Moved ${countOf(done, 'video')}.`];
    if (stayed > 0) {
      parts.push(`${countOf(stayed, 'video')} could not be moved and ${agree(stayed, 'stays where it was', 'stay where they were')}.`);
    }
    if (unfinished > 0) {
      parts.push(`${countOf(unfinished, 'video')} ${agree(unfinished, 'was', 'were')} moved but did not finish.`);
    }
    return <Alert severity="warning">{parts.join(' ')}</Alert>;
  }
  return <Alert severity="error">{operation.error || 'The move failed.'}</Alert>;
}

/** A reorganize's progress, then its result with the videos that could not move. */
function ReorganizeOperationBody({ operation, error, retrying, onRetry }: ReorganizeOperationBodyProps) {
  if (!operation) {
    return error ? <Alert severity="error">{error}</Alert> : <LinearProgress />;
  }
  const total = operation.total ?? 0;
  const handled = (operation.done ?? 0) + (operation.failed ?? 0);

  if (isRunning(operation)) {
    return (
      <Box className="flex flex-col gap-2">
        <Typography variant="body2">
          Moving videos for {operation.label}: {handled} of {total}.
        </Typography>
        <LinearProgress
          variant={total > 0 ? 'determinate' : 'indeterminate'}
          value={total > 0 ? Math.round((handled / total) * 100) : undefined}
        />
        <Typography variant="caption" color="text.secondary">
          {DOWNLOADS_WAIT_NOTE} You can close this window; the move keeps going.
        </Typography>
      </Box>
    );
  }

  const failedItems = operation.failedItems ?? [];
  return (
    <Box className="flex flex-col gap-3">
      {resultAlert(operation)}
      {error && <Alert severity="error">{error}</Alert>}
      {failedItems.length > 0 && (
        <Box>
          <Typography variant="body2" className="font-semibold">Not moved</Typography>
          <ul aria-label="Videos not moved" className="max-h-[260px] divide-y divide-border overflow-auto">
            {failedItems.map((item) => (
              <li key={item.id} className="py-2">
                <Typography variant="body2" className="break-words">{item.title || item.youtubeId}</Typography>
                <Typography variant="caption" color="text.secondary" className="break-words">{item.error}</Typography>
              </li>
            ))}
          </ul>
          <Button variant="outlined" size="small" onClick={onRetry} disabled={retrying} className="mt-2">
            {retrying ? 'Retrying...' : 'Retry these videos'}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default ReorganizeOperationBody;
