import React, { useEffect, useId, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '../../ui';
import { EpisodeAssignment, VideoEpisode } from '../../../types/titleShows';
import { ReorganizeChange, ReorganizeStartResult } from '../../../types/reorganize';
import { isReorganizeRequired } from '../Reorganize/reorganizeErrors';
import ReorganizeDialog from '../Reorganize/ReorganizeDialog';
import { useReorganizeOutcome } from '../Reorganize/hooks/useReorganizeOutcome';
import { useVideoEpisode } from './useVideoEpisode';
import { isAssignableSeason, MAX_YEAR_SEASON, SEASON_RANGE_TEXT } from '../../../utils/seasonNumbers';

const NO_SHOWS_NOTE = 'This video\'s channel has no shows. Add a show in Channel Settings > TV Show first.';
const MANUAL_NOTE = 'A number you assign stays until you change it: new titles and show edits never move it.';

export interface EpisodeAssignDialogProps {
  open: boolean;
  token: string | null;
  youtubeId: string | null;
  videoTitle?: string | null;
  onClose: () => void;
  /** The assignment was saved, or the move it needs was started */
  onSaved?: () => void;
}

function describeCurrent(classification: VideoEpisode['classification']): string {
  if (!classification) return 'Now: not in a show.';
  if (classification.notAnEpisode) return 'Now: not an episode.';
  if (classification.status === 'duplicate') return `Now: a duplicate in ${classification.showName}.`;
  if (classification.status === 'pending_number') return `Now: in ${classification.showName}, numbered when it downloads.`;
  if (classification.status === 'unsupported') return `Now: matched ${classification.showName}, but not supported yet.`;
  if (!classification.code) return `Now: in ${classification.showName}.`;
  return `Now: ${classification.code} of ${classification.showName}.`;
}

function toNumber(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/** Assign a video to a title show episode by hand, or take it out of title shows. */
function EpisodeAssignDialog({ open, token, youtubeId, videoTitle = null, onClose, onSaved }: EpisodeAssignDialogProps) {
  const showLabelId = useId();
  const { data, loading, error, assign } = useVideoEpisode(open ? youtubeId : null, token);
  const [showId, setShowId] = useState<number | null>(null);
  const [season, setSeason] = useState('1');
  const [episode, setEpisode] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [move, setMove] = useState<ReorganizeChange | null>(null);
  // The move a reassignment started: the episode is saved when it ends (or
  // undone, when nothing could move), not when it starts.
  const [trackedMove, setTrackedMove] = useState<{ operationId: number; attempt: number } | null>(null);
  useReorganizeOutcome(token, trackedMove?.operationId ?? null, () => onSaved?.(), { attempt: trackedMove?.attempt ?? 0 });

  const handleMoveStarted = (result: ReorganizeStartResult) => {
    if (result.operationId) setTrackedMove({ operationId: result.operationId, attempt: 0 });
    else onSaved?.();
  };
  const handleMoveRetried = (operationId: number) => {
    setTrackedMove((current) => ({
      operationId,
      attempt: current && current.operationId === operationId ? current.attempt + 1 : 1,
    }));
  };

  // Start from the current episode, else the first show; forget the previous
  // video's values while the next one loads.
  useEffect(() => {
    if (!data) {
      setShowId(null);
      setSeason('1');
      setEpisode('');
      return;
    }
    const current = data.classification;
    const inTitleShow = current && current.kind === 'title' && data.shows.some((show) => show.id === current.showId);
    setShowId(inTitleShow ? current.showId : data.shows[0]?.id ?? null);
    setSeason(inTitleShow && current.season !== null ? String(current.season) : '1');
    setEpisode(inTitleShow && current.episode !== null ? String(current.episode) : '');
    setSaveError(null);
  }, [data]);

  const save = async (assignment: EpisodeAssignment) => {
    setSaving(true);
    setSaveError(null);
    try {
      await assign(assignment);
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      if (isReorganizeRequired(err)) setMove(err.change);
      else setSaveError(err instanceof Error ? err.message : 'Failed to save the episode');
    } finally {
      setSaving(false);
    }
  };

  const seasonNumber = toNumber(season);
  const episodeNumber = toNumber(episode);
  const valid = Boolean(data && data.assignable) && showId !== null && isAssignableSeason(seasonNumber)
    && episodeNumber !== null && episodeNumber >= 1;
  const current = data?.classification ?? null;
  const inTitleShow = Boolean(current && current.kind === 'title' && !current.notAnEpisode);
  const canReset = Boolean(current && (current.notAnEpisode || current.source === 'manual'));
  const selectedShow = data?.shows.find((show) => show.id === showId);
  const seasonName = selectedShow && seasonNumber !== null ? selectedShow.seasonNames[seasonNumber] : undefined;
  const seasonHint = season.trim() !== '' && !isAssignableSeason(seasonNumber) ? SEASON_RANGE_TEXT : seasonName;

  return (
    <>
      <Dialog open={open && move === null} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle onClose={onClose}>Change episode</DialogTitle>
        <DialogContent>
          <Box className="flex flex-col gap-3 pt-2">
            {videoTitle && <Typography variant="body2" className="font-medium break-words">{videoTitle}</Typography>}
            {loading && !data && <CircularProgress size={24} />}
            {error && <Alert severity="error">{error}</Alert>}
            {data && !data.assignable && <Alert severity="info">{NO_SHOWS_NOTE}</Alert>}
            {data && data.assignable && (
              <>
                <Typography variant="body2" color="text.secondary">{describeCurrent(current)}</Typography>
                <FormControl fullWidth>
                  <InputLabel id={showLabelId} shrink>Show</InputLabel>
                  <Select
                    labelId={showLabelId}
                    size="small"
                    value={showId === null ? '' : String(showId)}
                    onChange={(event) => setShowId(Number(event.target.value))}
                  >
                    {data.shows.map((show) => <MenuItem key={show.id} value={String(show.id)}>{show.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <Box className="flex gap-3">
                  <TextField
                    label="Season"
                    type="number"
                    size="small"
                    value={season}
                    onChange={(event) => setSeason(event.target.value)}
                    inputProps={{ min: 0, max: MAX_YEAR_SEASON }}
                    helperText={seasonHint || undefined}
                  />
                  <TextField
                    label="Episode"
                    type="number"
                    size="small"
                    value={episode}
                    onChange={(event) => setEpisode(event.target.value)}
                    inputProps={{ min: 1 }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">{MANUAL_NOTE}</Typography>
              </>
            )}
            {saveError && <Alert severity="error">{saveError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions>
          {data && data.assignable && canReset && (
            <Button variant="text" disabled={saving} onClick={() => { void save({ automatic: true }); }}>Back to automatic</Button>
          )}
          {data && data.assignable && inTitleShow && (
            <Button variant="outlined" disabled={saving} onClick={() => { void save({ notAnEpisode: true }); }}>Not an episode</Button>
          )}
          <Button
            variant="contained"
            disabled={!valid || saving}
            startIcon={saving ? <CircularProgress size={14} /> : undefined}
            onClick={() => {
              if (valid && showId !== null && seasonNumber !== null && episodeNumber !== null) {
                void save({ showId, season: seasonNumber, episode: episodeNumber });
              }
            }}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>
      <ReorganizeDialog
        open={move !== null}
        token={token}
        change={move}
        onClose={() => { setMove(null); onClose(); }}
        onApplied={handleMoveStarted}
        onRetried={handleMoveRetried}
      />
    </>
  );
}

export default EpisodeAssignDialog;
