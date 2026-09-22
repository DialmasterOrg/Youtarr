import React, { useEffect, useId, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, RadioGroup, RadioGroupItem, Select, TextField,
} from '../../ui';
import { Playlist } from '../../../types/playlist';
import { useVideoActivity } from '../../../providers/VideoActivityProvider';
import { formatDate } from './playlistVideoHelpers';
import { MAX_BATCH_SIZE, MAX_PLAYLIST_VIDEOS, DEFAULT_PREVIEW_COUNT, CANDIDATE_PAGE_SIZE } from '../playlistConstants';

export type FollowingDialogMode = 'setup' | 'batch' | 'restart';

interface Candidate {
  youtube_id: string;
  title: string;
  position: number;
  published_at: string | null;
}

interface Preview {
  candidates: Candidate[];
  selectedIds: string[];
  missingDates: number;
}

interface Props {
  playlist: Playlist;
  token: string | null;
  mode: FollowingDialogMode;
  defaultCount: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function PlaylistFollowingDialog({ playlist, token, mode, defaultCount, onClose, onSaved }: Props) {
  const id = useId();
  const { snapshot } = useVideoActivity();
  const [includeExisting, setIncludeExisting] = useState(mode === 'batch');
  const [order, setOrder] = useState('published');
  const [count, setCount] = useState(String(Math.min(MAX_BATCH_SIZE, Math.max(1, defaultCount || DEFAULT_PREVIEW_COUNT))));
  const [preview, setPreview] = useState<(Preview & { key: string }) | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(CANDIDATE_PAGE_SIZE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const numericCount = Number(count);
  const validCount = Number.isInteger(numericCount) && numericCount >= 1 && numericCount <= MAX_BATCH_SIZE;
  const previewKey = `${order}:${count}:${retry}`;
  const currentPreview = preview?.key === previewKey ? preview : null;
  const selectedIds = selected.filter((ytId) => !snapshot.videos[ytId]?.state);

  useEffect(() => {
    if (!includeExisting || !validCount || !token) return;
    const controller = new AbortController();
    setError(null);
    setVisibleCount(CANDIDATE_PAGE_SIZE);
    axios.get<Preview>(`/api/playlists/${playlist.playlist_id}/download-preview`, {
      headers: { 'x-access-token': token }, params: { order, count: numericCount }, signal: controller.signal,
    }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setPreview({ ...data, key: previewKey });
      setSelected(data.selectedIds);
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) {
        setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Could not load the selection.' : 'Could not load the selection.');
      }
    });
    return () => controller.abort();
  }, [includeExisting, validCount, token, playlist.playlist_id, order, numericCount, previewKey]);

  // Selected titles stay at the top so the complete batch is easy to review.
  const candidates = useMemo(() => {
    const chosen = new Set(selected);
    return (currentPreview?.candidates || []).slice().sort((a, b) =>
      Number(chosen.has(b.youtube_id)) - Number(chosen.has(a.youtube_id)) || a.position - b.position);
  }, [currentPreview, selected]);

  const submit = async () => {
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      const endpoint = mode === 'batch' ? 'download-batch' : 'following';
      const { data } = await axios.post<{ queued: number; warning?: string; playlist?: Playlist }>(
        `/api/playlists/${playlist.playlist_id}/${endpoint}`,
        { videoIds: includeExisting ? selectedIds : [], ...(mode === 'restart' && { restart: true }) },
        { headers: { 'x-access-token': token } }
      );
      const stillPaused = !(data.playlist?.auto_download ?? playlist.auto_download);
      const followingMessage = mode === 'restart'
        ? stillPaused
          ? 'Starting point updated. Automatic downloads remain paused until you resume.'
          : 'Starting point updated. Automatic downloads remain enabled.'
        : `Following new additions.${data.queued ? ` ${data.queued} existing ${data.queued === 1 ? 'video' : 'videos'} queued.` : ''}`;
      onSaved(data.warning || (mode === 'batch'
        ? `${data.queued} videos queued.`
        : followingMessage));
    } catch (err: unknown) {
      setError(axios.isAxiosError(err) ? err.response?.data?.error || 'Could not save this selection. Please retry.' : 'Could not save this selection. Please retry.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onClose={() => { if (!pending) onClose(); }} maxWidth="md" fullWidth>
      <DialogTitle>{mode === 'setup' ? 'Start following this playlist' : mode === 'restart' ? 'Reset starting point?' : 'Choose existing videos'}</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-4 pt-1">
          {mode === 'restart' ? (
            <Alert severity="warning">
              Youtarr will refresh this playlist and skip its current undownloaded backlog, including saved batch requests.
              Only entries discovered afterward will be eligible for automatic downloads. Files and already queued downloads are kept.
              <p className="mt-2">{playlist.auto_download
                ? 'Automatic downloads will stay enabled.'
                : 'Automatic downloads will remain paused. Resume them when you are ready.'}</p>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">
              {mode === 'setup'
                ? 'Youtarr will refresh this playlist, then follow newly discovered entries wherever the owner places them. Choose whether to download any existing videos too.'
                : 'Choose a batch from the tracked videos below. This does not change which future additions download automatically. Refresh the playlist first if you need to check for changes on YouTube.'}
            </p>
          )}
          {mode !== 'batch' && (
            <p className="text-xs text-muted-foreground">
              Automatic following supports playlists with up to {MAX_PLAYLIST_VIDEOS.toLocaleString()} entries. Youtarr must verify the complete playlist before saving a starting point.
            </p>
          )}
          {mode === 'setup' && (
            <RadioGroup value={includeExisting ? 'batch' : 'future'} onValueChange={(value) => setIncludeExisting(value === 'batch')} disabled={pending} aria-label="Existing videos">
              <label className="flex items-center gap-2 text-sm" htmlFor={`${id}-future`}>
                <RadioGroupItem id={`${id}-future`} value="future" /> Only download future additions
              </label>
              <label className="flex items-center gap-2 text-sm" htmlFor={`${id}-batch`}>
                <RadioGroupItem id={`${id}-batch`} value="batch" /> Also download existing videos
              </label>
            </RadioGroup>
          )}
          {includeExisting && (
            <>
              <div className="flex flex-wrap items-start gap-3">
                <TextField label="Select up to" type="number" value={count} onChange={(e) => setCount(e.target.value)}
                  inputProps={{ min: 1, max: MAX_BATCH_SIZE }} disabled={pending} error={!validCount}
                  helperText={`Videos (1-${MAX_BATCH_SIZE}). Starts with your global limit.`} className="w-52" />
                <FormControl className="min-w-[240px]">
                  <InputLabel id={`${id}-order`} shrink>Choose by</InputLabel>
                  <Select labelId={`${id}-order`} value={order} onValueChange={setOrder} disabled={pending}>
                    <MenuItem value="published">Newest publication date</MenuItem>
                    <MenuItem value="asc">Beginning of YouTube playlist</MenuItem>
                    <MenuItem value="desc">End of YouTube playlist</MenuItem>
                  </Select>
                </FormControl>
              </div>
              {currentPreview && order === 'published' && currentPreview.missingDates > 0 && (
                <Alert severity="info">
                  Publication dates are missing for {currentPreview.missingDates} {currentPreview.missingDates === 1 ? 'video' : 'videos'}, so Youtarr cannot reliably choose the newest.
                  Choose the beginning or end of the playlist, or check videos manually below.
                </Alert>
              )}
              {!currentPreview && validCount && !error && <p role="status" className="text-sm">Loading eligible videos...</p>}
              {currentPreview && (
                <>
                  <p className="text-sm font-medium" aria-live="polite">{selectedIds.length} {selectedIds.length === 1 ? 'video' : 'videos'} selected. Review or adjust the checkboxes before queuing.</p>
                  <p className="text-xs text-muted-foreground">Previously downloaded, excluded, and unavailable videos are omitted. Downloads use your saved playlist and channel settings.</p>
                  <p className="text-xs text-muted-foreground">The full selection queues now. With following enabled, each scheduled run can queue up to your limit in new discoveries, plus the same number of older saved selections to retry. Older retries take turns; a selected video that is also a new discovery uses only the discovery allowance.</p>
                  <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {candidates.slice(0, Math.max(visibleCount, selected.length)).map((video) => {
                      const active = !!snapshot.videos[video.youtube_id]?.state;
                      const checked = selectedIds.includes(video.youtube_id);
                      return (
                        <label key={video.youtube_id} className="flex items-start gap-3 p-3 text-sm">
                          <Checkbox checked={checked} disabled={pending || active || (!checked && selectedIds.length >= MAX_BATCH_SIZE)}
                            aria-label={`Select ${video.title}`} onChange={() => setSelected((ids) => checked ? ids.filter((ytId) => ytId !== video.youtube_id) : [...ids, video.youtube_id])} />
                          <span className="min-w-0"><span className="block break-words">{video.title}</span>
                            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="whitespace-nowrap">Published {formatDate(video.published_at) || 'Unknown'}</span>
                              <span className="whitespace-nowrap">Position {video.position}</span>
                              {active && <span>Already queued or downloading</span>}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    {!candidates.length && <p className="p-3 text-sm text-muted-foreground">No eligible existing videos.</p>}
                    {candidates.length > Math.max(visibleCount, selected.length) && (
                      <Button variant="text" onClick={() => setVisibleCount((n) => Math.max(n, selected.length) + CANDIDATE_PAGE_SIZE)}>Show more videos</Button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          {error && <Alert severity="error">{error}{includeExisting && !currentPreview && <Button variant="text" onClick={() => setRetry((n) => n + 1)}>Retry preview</Button>}</Alert>}
          {pending && mode !== 'batch' && <p role="status" className="text-sm text-muted-foreground">Refreshing and saving your starting point. Large playlists can take a few minutes.</p>}
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button variant="contained" loading={pending} onClick={() => void submit()}
          disabled={!token || pending || (includeExisting && (!validCount || !currentPreview || selectedIds.length === 0))}>
          {mode === 'batch' ? `Queue ${selectedIds.length} ${selectedIds.length === 1 ? 'video' : 'videos'}` : mode === 'restart' ? 'Skip backlog and reset starting point' : includeExisting ? 'Start following and queue selection' : 'Start following'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
