import React, { useState } from 'react';
import { Box, Button, IconButton, Typography } from '../../../ui';
import { ArrowDownward, ArrowUpward, Delete } from '../../../../lib/icons';
import { TitleShow } from '../../../../types/titleShows';
import { libraryFolderLabel } from '../../../../utils/libraryLayouts';

const REMOVE_NOTE = 'Its videos follow the channel\'s layout again. Its order and hand-assigned numbers are kept if you restore it.';

function countsText(show: TitleShow): string {
  const counts = show.counts;
  if (!counts) return '';
  const parts = [`${counts.episodes} ${counts.episodes === 1 ? 'episode' : 'episodes'}`, `${counts.downloaded} downloaded`];
  if (counts.duplicates > 0) parts.push(`${counts.duplicates} ${counts.duplicates === 1 ? 'duplicate' : 'duplicates'}`);
  if (counts.unsupported > 0) parts.push(`${counts.unsupported} not supported yet`);
  return parts.join(', ');
}

interface TitleShowListProps {
  shows: TitleShow[];
  retired: TitleShow[];
  busy: boolean;
  onEdit: (show: TitleShow) => void;
  onRemove: (show: TitleShow) => void;
  onRestore: (show: TitleShow) => void;
  /** Move the show at one position to another */
  onMove: (from: number, to: number) => void;
}

/** A channel's title shows in order, with their counts and actions, and its removed shows. */
function TitleShowList({ shows, retired, busy, onEdit, onRemove, onRestore, onMove }: TitleShowListProps) {
  const [confirming, setConfirming] = useState<number | null>(null);

  return (
    <Box className="flex flex-col gap-2">
      {shows.length === 0 && (
        <Typography variant="body2" color="text.secondary">No shows yet. Add one for a series this channel uploads.</Typography>
      )}
      <ul aria-label="Shows" className="flex flex-col gap-2">
        {shows.map((show, index) => (
          <li key={show.id} className="flex flex-col gap-1 rounded-[var(--radius-ui)] border border-border p-3">
            <Box className="flex flex-wrap items-center gap-2">
              <Typography variant="body2" className="min-w-0 flex-1 font-semibold break-words">{show.name}</Typography>
              <IconButton aria-label={`Move ${show.name} up`} size="small" disabled={busy || index === 0} onClick={() => onMove(index, index - 1)}>
                <ArrowUpward size={16} />
              </IconButton>
              <IconButton
                aria-label={`Move ${show.name} down`} size="small" disabled={busy || index === shows.length - 1}
                onClick={() => onMove(index, index + 1)}
              >
                <ArrowDownward size={16} />
              </IconButton>
              <Button size="small" variant="outlined" disabled={busy} aria-label={`Edit ${show.name}`} onClick={() => onEdit(show)}>Edit</Button>
              <IconButton aria-label={`Remove ${show.name}`} size="small" disabled={busy} onClick={() => setConfirming(show.id)}>
                <Delete size={16} />
              </IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary">{libraryFolderLabel(show.libraryFolder)}/{show.folderName}</Typography>
            {show.counts && <Typography variant="caption" color="text.secondary">{countsText(show)}</Typography>}
            {confirming === show.id && (
              <Box className="flex flex-wrap items-center gap-2">
                <Typography variant="caption" className="flex-1">{`Remove ${show.name}? ${REMOVE_NOTE}`}</Typography>
                <Button size="small" variant="text" onClick={() => setConfirming(null)}>Cancel</Button>
                <Button size="small" variant="contained" color="error" onClick={() => { setConfirming(null); onRemove(show); }}>Remove</Button>
              </Box>
            )}
          </li>
        ))}
      </ul>
      {retired.length > 0 && (
        <Box className="flex flex-col gap-1">
          <Typography variant="caption" color="text.secondary">Removed shows</Typography>
          {retired.map((show) => (
            <Box key={show.id} className="flex items-center gap-2">
              <Typography variant="body2" color="text.secondary" className="flex-1 break-words">{show.name}</Typography>
              <Button size="small" variant="text" disabled={busy} aria-label={`Restore ${show.name}`} onClick={() => onRestore(show)}>
                Restore
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default TitleShowList;
