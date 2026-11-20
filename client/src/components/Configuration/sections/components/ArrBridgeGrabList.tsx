import React from 'react';
import { Box, Chip } from '../../../ui';
import { ArrPagedList } from '../../hooks/useArrBridgePagedList';
import { ArrGrab, GRAB_STATE_LABELS, LIBRARY_COPY_NOTES } from '../../utils/arrBridgeSetup';
import { ArrBridgeListFrame } from './ArrBridgeListFrame';

const ROW_COLUMNS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_auto]';
const READY_HINT = "Waiting for Sonarr/Radarr to import it. If it stays here, check the app's queue for the reason.";

interface ArrBridgeGrabListProps {
  list: ArrPagedList<ArrGrab>;
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
        {grab.libraryCopy && (
          <span className="mt-1 block break-words text-muted-foreground">{LIBRARY_COPY_NOTES[grab.libraryCopy]}</span>
        )}
      </span>
      <span className="text-muted-foreground md:text-right">{formatWhen(grab.createdAt)}</span>
    </li>
  );
};

/**
 * What Sonarr and Radarr grabbed and what became of each grab, one page at
 * a time.
 */
export const ArrBridgeGrabList: React.FC<ArrBridgeGrabListProps> = ({ list }) => (
  <ArrBridgeListFrame
    list={list}
    intro="The newest grabs first. This list does not update by itself."
    searchLabel="Filter grabs"
    searchHint="Matches the release name, the video's title, its channel or its video id."
    loadingText="Loading the recent grabs..."
    emptyText="Nothing grabbed yet."
    noMatchText="No grabs match this filter."
  >
    <Box className={`hidden gap-2 text-sm font-semibold text-muted-foreground md:grid ${ROW_COLUMNS}`} aria-hidden="true">
      <span>Release</span>
      <span>Video</span>
      <span>State</span>
      <span className="text-right">Grabbed</span>
    </Box>
    <ul className="m-0 list-none p-0" aria-label="Recent grabs">
      {list.items.map((grab) => (
        <GrabRow key={grab.id} grab={grab} />
      ))}
    </ul>
  </ArrBridgeListFrame>
);

export default ArrBridgeGrabList;
