import React from 'react';
import { Box, Button, Typography } from '../../../ui';
import { TitleShowConflict } from '../../../../types/titleShows';

function episodeCode(season: number | null, episode: number | null): string {
  if (season === null || episode === null) return 'its episode';
  return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
}

function describe(conflict: TitleShowConflict): string {
  if (conflict.kind === 'classification_error') {
    return `Its title could not be checked against the shows: ${conflict.message || 'unknown error'}`;
  }
  const holder = conflict.duplicateOfTitle || conflict.duplicateOf;
  const state = conflict.downloaded
    ? 'Downloaded duplicate: it stays where it is.'
    : conflict.suppressed ? 'Ignored, so it isn\'t downloaded.' : 'You ignored it.';
  return `Duplicate of ${episodeCode(conflict.season, conflict.episode)}: ${holder}. ${state}`;
}

interface ConflictListProps {
  conflicts: TitleShowConflict[];
  busy: boolean;
  /** "Use this copy instead": the duplicate takes the number */
  onUseCopy: (conflict: TitleShowConflict) => void;
  /** "Not a duplicate": assign the video by hand */
  onAssign: (conflict: TitleShowConflict) => void;
  /** Delete a downloaded duplicate's files */
  onDelete: (conflict: TitleShowConflict) => void;
  /** Classify the channel's titles again */
  onRecheck: () => void;
}

/** A channel's duplicate episodes and titles that could not be classified, with what can be done about them. */
function ConflictList({ conflicts, busy, onUseCopy, onAssign, onDelete, onRecheck }: ConflictListProps) {
  if (conflicts.length === 0) return null;
  return (
    <Box className="flex flex-col gap-2">
      <Typography variant="body2" className="font-semibold">Duplicates and errors</Typography>
      <ul aria-label="Duplicates and errors" className="max-h-[280px] divide-y divide-border overflow-auto">
        {conflicts.map((conflict) => (
          <li key={conflict.youtubeId} className="flex flex-col gap-1 py-2">
            <Typography variant="body2" className="break-words">{conflict.title || conflict.youtubeId}</Typography>
            <Typography variant="caption" color="text.secondary">{describe(conflict)}</Typography>
            <Box className="flex flex-wrap gap-2">
              {conflict.kind === 'duplicate' ? (
                <>
                  <Button size="small" variant="outlined" disabled={busy} onClick={() => onUseCopy(conflict)}>Use this copy instead</Button>
                  <Button size="small" variant="text" disabled={busy} onClick={() => onAssign(conflict)}>Not a duplicate</Button>
                  {conflict.downloaded && conflict.videoId !== null && (
                    <Button size="small" variant="text" color="error" disabled={busy} onClick={() => onDelete(conflict)}>Delete this copy</Button>
                  )}
                </>
              ) : (
                <Button size="small" variant="outlined" disabled={busy} onClick={onRecheck}>Check again</Button>
              )}
            </Box>
          </li>
        ))}
      </ul>
    </Box>
  );
}

export default ConflictList;
