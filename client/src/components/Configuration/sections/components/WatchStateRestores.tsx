import React from 'react';
import { Alert, Box, Button, Typography } from '../../../ui';
import { WatchHold } from '../../../../types/reorganize';
import { MEDIA_SERVER_LABELS } from '../../../../utils/mediaServerLabels';
import { useWatchStateHolds } from '../../hooks/useWatchStateHolds';

const EXPLANATION = 'When a reorganize moves downloaded videos, media servers see them as new, unwatched items. '
  + 'Youtarr keeps their watched state and pushes it back once each server has scanned the moved files.';

function describeState(hold: WatchHold): string {
  if (hold.played) return 'watched';
  const minutes = Math.round((hold.positionMs ?? 0) / 60000);
  return `in progress (${minutes} min)`;
}

function describeWho(hold: WatchHold): string {
  const server = MEDIA_SERVER_LABELS[hold.serverType] ?? hold.serverType;
  return hold.serverUserName ? `${server}, ${hold.serverUserName}` : server;
}

interface WatchStateRestoresProps {
  token: string | null;
}

/** Watch state still waiting to reach the media servers after a reorganize, with failed restores to retry or dismiss. */
export function WatchStateRestores({ token }: WatchStateRestoresProps) {
  const { holds, counts, error, busyId, retry, dismiss } = useWatchStateHolds(token);
  if (counts.pending === 0 && counts.failed === 0 && !error) return null;
  const failed = holds.filter((hold) => hold.state === 'failed');

  return (
    <Box className="flex flex-col gap-2">
      <Typography variant="subtitle2" className="font-bold">Watch state restores</Typography>
      <Typography variant="caption" color="text.secondary">{EXPLANATION}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {counts.pending > 0 && (
        <Typography variant="body2" color="text.secondary">
          {counts.pending === 1 ? '1 restore is' : `${counts.pending} restores are`} waiting for the media servers.
        </Typography>
      )}
      {failed.length > 0 && (
        <Alert severity="warning">
          {failed.length === 1 ? '1 restore' : `${failed.length} restores`} did not reach the media server within 14 days.
          {' '}Youtarr keeps its own watched state for these until you dismiss them.
        </Alert>
      )}
      {failed.length > 0 && (
        <ul aria-label="Failed restores" className="m-0 list-none divide-y divide-border p-0">
          {failed.map((hold) => (
            <li key={hold.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
              <Box className="min-w-0">
                <Typography variant="body2" className="break-words">{hold.title || hold.youtubeId || `Video ${hold.id}`}</Typography>
                <Typography variant="caption" color="text.secondary" className="block">
                  {describeWho(hold)}: {describeState(hold)}{hold.lastError ? `. ${hold.lastError}` : ''}
                </Typography>
              </Box>
              <Box className="flex shrink-0 gap-2">
                <Button size="small" variant="outlined" disabled={busyId === hold.id} onClick={() => { void retry(hold.id); }}>
                  Retry
                </Button>
                <Button size="small" variant="text" disabled={busyId === hold.id} onClick={() => { void dismiss(hold.id); }}>
                  Dismiss
                </Button>
              </Box>
            </li>
          ))}
        </ul>
      )}
    </Box>
  );
}

export default WatchStateRestores;
