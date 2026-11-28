import React from 'react';
import { Box, Button, Chip } from '../../../ui';
import { ArrPagedList } from '../../hooks/useArrBridgePagedList';
import { ArrGrabRetry } from '../../hooks/useArrBridgeGrabRetry';
import {
  ArrGrab, BLOCKED_GRAB_ADVICE, GRAB_STATE_LABELS, LIBRARY_COPY_NOTES, blockedGrabText, grabRetryNote,
  hiddenGrabNote, requestedRetryNote,
} from '../../utils/arrBridgeSetup';
import { ArrBridgeListFrame } from './ArrBridgeListFrame';
import { youtubeVideoUrl } from '../../../../utils/youtubeUrls';

const ROW_COLUMNS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.5fr)_auto]';
const READY_HINT = "Waiting for Sonarr/Radarr to import it. If it stays here, check the app's queue for the reason.";

const NOTE_CLASS = 'mt-1 block break-words text-muted-foreground';

interface ArrBridgeGrabListProps {
  list: ArrPagedList<ArrGrab>;
  /** "Try again" on a grab that waits while YouTube blocks downloads. */
  retry: ArrGrabRetry;
}

const formatted = (value: string, format: (date: Date) => string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : format(date);
};
const formatWhen = (value: string) => formatted(value, (date) => date.toLocaleString());
const formatTime = (value: string) => formatted(
  value, (date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
);
const formatDay = (value: string) => formatted(value, (date) => date.toLocaleDateString());

const GrabRow: React.FC<{ grab: ArrGrab; retry: ArrGrabRetry }> = ({ grab, retry }) => {
  const { label, tone } = GRAB_STATE_LABELS[grab.state] ?? { label: grab.state, tone: 'default' as const };
  const retryNote = grabRetryNote(grab, retry.outcomes[grab.id]);
  const requestedNote = grab.state === 'blocked' ? requestedRetryNote(grab) : null;
  const trying = retry.busyId === grab.id;
  return (
    <li className={`grid gap-2 border-0 border-t border-solid border-[var(--border)] py-3 text-sm ${ROW_COLUMNS}`}>
      <span className="break-all font-mono">{grab.releaseTitle}</span>
      <span className="min-w-0">
        <a
          href={youtubeVideoUrl(grab.youtubeId)}
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
        {grab.state === 'failed' && grab.failMessage && <span className={NOTE_CLASS}>{grab.failMessage}</span>}
        {grab.state === 'failed' && grab.hiddenUntil && (
          <span className={NOTE_CLASS}>{hiddenGrabNote(grab.hiddenUntil, formatDay)}</span>
        )}
        {grab.state === 'blocked' && (
          <>
            <span className={NOTE_CLASS}>{blockedGrabText(grab, formatTime)}</span>
            <span className={NOTE_CLASS}>{BLOCKED_GRAB_ADVICE}</span>
            {requestedNote && <span className={NOTE_CLASS}>{requestedNote}</span>}
          </>
        )}
        {grab.state === 'ready' && <span className="mt-1 block text-muted-foreground">{READY_HINT}</span>}
        {retryNote && (
          <span className={NOTE_CLASS} role="status">
            {retryNote}
          </span>
        )}
        {grab.state === 'blocked' && (
          <Button
            variant="outlined"
            size="small"
            className="mt-2"
            disabled={retry.busyId !== null}
            aria-label={`${trying ? 'Trying' : 'Try again'}: ${grab.releaseTitle}`}
            onClick={() => retry.retry(grab.id)}
          >
            {trying ? 'Trying...' : 'Try again'}
          </Button>
        )}
        {grab.libraryCopy && <span className={NOTE_CLASS}>{LIBRARY_COPY_NOTES[grab.libraryCopy]}</span>}
      </span>
      <span className="text-muted-foreground md:text-right">{formatWhen(grab.createdAt)}</span>
    </li>
  );
};

/**
 * What Sonarr and Radarr grabbed and what became of each grab, one page at
 * a time.
 */
export const ArrBridgeGrabList: React.FC<ArrBridgeGrabListProps> = ({ list, retry }) => (
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
        <GrabRow key={grab.id} grab={grab} retry={retry} />
      ))}
    </ul>
  </ArrBridgeListFrame>
);

export default ArrBridgeGrabList;
