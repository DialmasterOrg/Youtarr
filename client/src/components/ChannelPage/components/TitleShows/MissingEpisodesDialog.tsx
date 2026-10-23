import React from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '../../../ui';
import { MissingSeason } from '../../../../types/titleShows';
import { useMissingEpisodes } from '../../hooks/useMissingEpisodes';

const GAPS_NOTE = 'Numbers between 1 and the highest episode that no known video holds: not uploaded, uploaded under '
  + 'another title, or not listed yet (Load all on the channel page).';

function seasonSummary(season: MissingSeason): string {
  const label = season.name ? `Season ${season.season}, ${season.name}` : `Season ${season.season}`;
  return season.downloaded === season.episodes
    ? `${label}: all ${season.episodes} downloaded`
    : `${label}: ${season.downloaded} of ${season.episodes} downloaded`;
}

interface MissingEpisodesDialogProps {
  open: boolean;
  token: string | null;
  channelId: string;
  showId: number | null;
  onClose: () => void;
}

/** A title show's episodes that aren't downloaded, season by season, and the numbers no known video holds. */
function MissingEpisodesDialog({ open, token, channelId, showId, onClose }: MissingEpisodesDialogProps) {
  const { data, loading, error } = useMissingEpisodes(channelId, open ? showId : null, token);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle onClose={onClose}>{data ? `Missing episodes of ${data.name}` : 'Missing episodes'}</DialogTitle>
      <DialogContent>
        <Box className="flex flex-col gap-4 pt-2">
          {loading && <CircularProgress size={24} />}
          {error && <Alert severity="error">{error}</Alert>}
          {data && data.seasons.length === 0 && <Typography variant="body2" color="text.secondary">No numbered episodes yet.</Typography>}
          {data && data.seasons.map((season) => (
            <Box key={season.season} className="flex flex-col gap-1">
              <Typography variant="body2" className="font-semibold">{seasonSummary(season)}</Typography>
              {season.notDownloaded.length > 0 && (
                <ul aria-label={`Season ${season.season} not downloaded`} className="flex flex-col gap-1">
                  {season.notDownloaded.map((episode) => (
                    <li key={episode.youtubeId} className="flex items-center gap-2">
                      <Chip label={episode.code} size="small" variant="outlined" />
                      <Typography variant="body2" className="break-words">{episode.title || episode.youtubeId}</Typography>
                    </li>
                  ))}
                </ul>
              )}
              {season.gaps.length > 0 && (
                <Typography variant="caption" color="text.secondary" title={GAPS_NOTE}>
                  {`No known video for ${season.gaps.map((n) => `E${n}`).join(', ')}${season.gapsTruncated ? ', ...' : ''}.`}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default MissingEpisodesDialog;
