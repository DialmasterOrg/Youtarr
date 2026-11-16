import React, { useState } from 'react';
import { Alert, Box, Button, Chip, Typography } from '../../../ui';
import { ArrGrab, GRAB_STATE_LABELS } from '../../utils/arrBridgeSetup';

// The page stays short; the rest of the list is one click away.
const COLLAPSED_ROWS = 10;

const ROW_COLUMNS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_auto]';
const READY_HINT = "Waiting for Sonarr/Radarr to import it. If it stays here, check the app's queue for the reason.";

interface ArrBridgeGrabListProps {
  grabs: ArrGrab[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const formatWhen = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

const GrabRow: React.FC<{ grab: ArrGrab }> = ({ grab }) => {
  const { label, tone } = GRAB_STATE_LABELS[grab.state] ?? { label: grab.state, tone: 'default' as const };
  return (
    <li className={`grid gap-2 border-0 border-t border-solid border-[var(--border)] py-3 text-sm ${ROW_COLUMNS}`}>
      <span className="break-all font-mono">{grab.releaseTitle}</span>
      <span className="min-w-0">
        <a
          href={`https://www.youtube.com/watch?v=${encodeURIComponent(grab.youtubeId)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="break-words text-primary underline"
        >
          {grab.videoTitle ?? grab.youtubeId}
        </a>
        {grab.channelName && <span className="block text-muted-foreground">{grab.channelName}</span>}
      </span>
      <span className="min-w-0">
        <Chip size="small" color={tone} label={label} />
        {grab.state === 'failed' && grab.failMessage && (
          <span className="mt-1 block break-words text-muted-foreground">{grab.failMessage}</span>
        )}
        {grab.state === 'ready' && <span className="mt-1 block text-muted-foreground">{READY_HINT}</span>}
      </span>
      <span className="text-muted-foreground md:text-right">{formatWhen(grab.createdAt)}</span>
    </li>
  );
};

/**
 * What Sonarr and Radarr grabbed lately and what became of each grab.
 */
export const ArrBridgeGrabList: React.FC<ArrBridgeGrabListProps> = ({ grabs, loading, error, onRefresh }) => {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? grabs : grabs.slice(0, COLLAPSED_ROWS);

  return (
    <Box className="flex flex-col gap-2">
      <Box className="flex flex-wrap items-center justify-between gap-2">
        <Typography variant="body2" color="text.secondary">
          The newest grabs first. This list does not update by itself.
        </Typography>
        <Button variant="outlined" disabled={loading} onClick={onRefresh}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {!error && grabs.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          {loading ? 'Loading the recent grabs...' : 'Nothing grabbed yet.'}
        </Typography>
      )}
      {!error && grabs.length > 0 && (
        <>
          <Box className={`hidden gap-2 text-sm font-semibold text-muted-foreground md:grid ${ROW_COLUMNS}`} aria-hidden="true">
            <span>Release</span>
            <span>Video</span>
            <span>State</span>
            <span className="text-right">Grabbed</span>
          </Box>
          <ul className="m-0 list-none p-0" aria-label="Recent grabs">
            {shown.map((grab) => (
              <GrabRow key={grab.id} grab={grab} />
            ))}
          </ul>
          {grabs.length > COLLAPSED_ROWS && (
            <Box>
              <Button variant="text" onClick={() => setShowAll((all) => !all)}>
                {showAll ? 'Show fewer' : `Show all ${grabs.length}`}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default ArrBridgeGrabList;
