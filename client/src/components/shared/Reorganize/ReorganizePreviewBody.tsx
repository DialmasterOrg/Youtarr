import React from 'react';
import { Alert, Box, Chip, Typography } from '../../ui';
import { ReorganizePreview, ReorganizePreviewItem } from '../../../types/reorganize';
import { LibraryCheckResponse } from '../../../types/libraryCheck';
import { LibraryCheckNotes } from '../LibraryCheck/LibraryCheckNotes';
import {
  agree, countOf, DOWNLOADS_WAIT_NOTE, folderName, MOVIE_TAGS_NOTE, serverName, WATCH_STATE_NOTE,
} from './reorganizeText';

interface ReorganizePreviewBodyProps {
  preview: ReorganizePreview;
  /** The library check for the TV folders videos move into */
  libraryCheck?: LibraryCheckResponse | null;
}

/** Media server library problems for the TV folders videos move into. */
function LibraryProblems({ libraryCheck }: { libraryCheck: LibraryCheckResponse }) {
  const folders = libraryCheck.folders.filter((folder) => folder.servers.some((server) => server.status !== 'ok'));
  if (folders.length === 0) return null;
  return (
    <Alert severity="warning">
      <Typography variant="body2" className="mb-1">Check the media server libraries for these TV folders before or after the move:</Typography>
      {folders.map((folder) => (
        <Box key={folder.name || 'main-folder'} className="mt-1">
          <Typography variant="body2" className="font-semibold">{folderName(folder.name)}</Typography>
          <LibraryCheckNotes folder={folder} servers={libraryCheck.servers} showSetupHints problemsOnly />
        </Box>
      ))}
    </Alert>
  );
}

function MoveRow({ item }: { item: ReorganizePreviewItem }) {
  return (
    <li className="flex flex-col gap-0.5 py-2">
      <Box className="flex flex-wrap items-center gap-2">
        <Typography variant="body2" className="font-medium break-words">{item.title || item.youtubeId}</Typography>
        {item.episode && <Chip label={item.episode} size="small" variant="outlined" />}
      </Box>
      <Typography variant="caption" color="text.secondary" className="break-all">From: {item.from}</Typography>
      <Typography variant="caption" color="text.secondary" className="break-all">To: {item.to}</Typography>
    </li>
  );
}

function summaryLines(preview: ReorganizePreview): string[] {
  const { totals } = preview;
  const lines: string[] = [];
  const { toTv, toVideos, betweenFolders, unchanged } = totals;
  if (toTv > 0) lines.push(`${countOf(toTv, 'video')} ${agree(toTv, 'becomes a TV episode', 'become TV episodes')}.`);
  if (toVideos > 0) lines.push(`${countOf(toVideos, 'video')} ${agree(toVideos, 'is', 'are')} saved movie-style again.`);
  if (betweenFolders > 0) lines.push(`${countOf(betweenFolders, 'video')} ${agree(betweenFolders, 'moves', 'move')} to another folder.`);
  if (unchanged > 0) {
    lines.push(`${countOf(unchanged, 'video')} ${agree(unchanged, 'is already where it belongs', 'are already where they belong')}.`);
  }
  return lines;
}

function noteLines(preview: ReorganizePreview): string[] {
  const { totals } = preview;
  const notes: string[] = [];
  const { overridePlaced, adopted, uploadDateOnly, downloadTime, movieTags } = totals;
  if (overridePlaced > 0) {
    notes.push(`${countOf(overridePlaced, 'video')} downloaded to another folder with a download override `
      + `${agree(overridePlaced, 'moves', 'move')} with the channel.`);
  }
  if (adopted > 0) {
    notes.push(`${countOf(adopted, 'file')} named by the Plex TV Series preset ${agree(adopted, 'keeps its', 'keep their')} episode `
      + `${agree(adopted, 'number', 'numbers')}.`);
  }
  if (uploadDateOnly > 0) {
    notes.push(`${countOf(uploadDateOnly, 'video')} ${agree(uploadDateOnly, 'has', 'have')} no exact upload time, so `
      + `${agree(uploadDateOnly, 'it is', 'they are')} numbered by upload day.`);
  }
  if (downloadTime > 0) {
    notes.push(`${countOf(downloadTime, 'video')} ${agree(downloadTime, 'has', 'have')} no upload date, so `
      + `${agree(downloadTime, 'it is', 'they are')} numbered by download time.`);
  }
  if (movieTags > 0) notes.push(`${countOf(movieTags, 'video')} ${agree(movieTags, 'keeps', 'keep')} ${MOVIE_TAGS_NOTE}`);
  return notes;
}

function problemLines(preview: ReorganizePreview): string[] {
  const { totals } = preview;
  const lines: string[] = [];
  const stays = (count: number) => agree(count, 'stays where it is', 'stay where they are');
  if (totals.missing > 0) {
    lines.push(`${countOf(totals.missing, 'video')} ${agree(totals.missing, 'has', 'have')} no file on disk and `
      + `${agree(totals.missing, 'is', 'are')} left as recorded.`);
  }
  if (totals.noName > 0) {
    lines.push(`${countOf(totals.noName, 'video')} could not be given a file name and ${stays(totals.noName)}.`);
  }
  if (totals.noDate > 0) {
    lines.push(`${countOf(totals.noDate, 'video')} ${agree(totals.noDate, 'has', 'have')} no date to number `
      + `${agree(totals.noDate, 'it', 'them')} by and ${stays(totals.noDate)}.`);
  }
  if (totals.unsafeName > 0) {
    lines.push(`${countOf(totals.unsafeName, 'video')} would land outside the downloads folder and ${stays(totals.unsafeName)}.`);
  }
  if (totals.collisions > 0) {
    lines.push(`${countOf(totals.collisions, 'file')} would replace a file that is already there. `
      + `${agree(totals.collisions, 'Its video fails', 'Those videos fail')} until it is removed.`);
  }
  return lines;
}

function BlockedAlert({ blocked }: { blocked: NonNullable<ReorganizePreview['blocked']> }) {
  // Something else is running, or nothing can be planned: only the first ends on its own.
  const suffix = blocked.reason === 'problems' ? '' : ' You can start the move once that finishes.';
  return <Alert severity="warning">{blocked.message}{suffix}</Alert>;
}

/** The dry run of a reorganize: what moves where, and what to know first. */
function ReorganizePreviewBody({ preview, libraryCheck = null }: ReorganizePreviewBodyProps) {
  const problems = problemLines(preview);
  if (!preview.needed) {
    return (
      <Box className="flex flex-col gap-3">
        {preview.blocked && <BlockedAlert blocked={preview.blocked} />}
        {problems.length > 0 && (
          <Alert severity="warning">
            {problems.map((line) => <Typography key={line} variant="body2">{line}</Typography>)}
          </Alert>
        )}
        {!preview.blocked && (
          <Alert severity="info">No downloaded files need to move. The change is applied without moving anything.</Alert>
        )}
      </Box>
    );
  }
  const notes = noteLines(preview);
  const createdShows = preview.shows.filter((show) => show.action !== 'keep');
  const truncated = preview.totals.videos > preview.items.length;

  return (
    <Box className="flex flex-col gap-3">
      {preview.blocked && <BlockedAlert blocked={preview.blocked} />}
      <Box>
        <Typography variant="body2" className="font-semibold">
          {countOf(preview.totals.videos, 'downloaded video')} move for {preview.change.label}.
        </Typography>
        {summaryLines(preview).map((line) => (
          <Typography key={line} variant="body2" color="text.secondary">{line}</Typography>
        ))}
        <Typography variant="caption" color="text.secondary">{DOWNLOADS_WAIT_NOTE}</Typography>
      </Box>
      {createdShows.length > 0 && (
        <Box>
          <Typography variant="body2" className="font-semibold">Shows</Typography>
          {createdShows.map((show) => (
            <Typography key={`${show.libraryFolder}/${show.folderName}`} variant="body2" color="text.secondary">
              {show.action === 'create' ? 'New show' : 'Moves to'}: {folderName(show.libraryFolder)}/{show.folderName}
            </Typography>
          ))}
        </Box>
      )}
      {problems.length > 0 && (
        <Alert severity="warning">
          {problems.map((line) => <Typography key={line} variant="body2">{line}</Typography>)}
        </Alert>
      )}
      {libraryCheck && <LibraryProblems libraryCheck={libraryCheck} />}
      {preview.watchState.length > 0 && (
        <Alert severity="info">
          <Typography variant="body2">{WATCH_STATE_NOTE}</Typography>
          {preview.watchState.map((server) => (
            <Typography key={server.serverType} variant="body2">
              {serverName(server.serverType)}: {countOf(server.videos, 'video')} watched or in progress
              {' '}({countOf(server.users, 'user')}).
            </Typography>
          ))}
        </Alert>
      )}
      {notes.length > 0 && (
        <Box>
          {notes.map((line) => <Typography key={line} variant="caption" color="text.secondary" className="block">{line}</Typography>)}
        </Box>
      )}
      <Box>
        <Typography variant="body2" className="font-semibold">Moves</Typography>
        <ul aria-label="Planned moves" className="max-h-[320px] divide-y divide-border overflow-auto">
          {preview.items.map((item) => <MoveRow key={item.youtubeId} item={item} />)}
        </ul>
        {truncated && (
          <Typography variant="caption" color="text.secondary">
            Showing the first {preview.items.length} of {preview.totals.videos}.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default ReorganizePreviewBody;
