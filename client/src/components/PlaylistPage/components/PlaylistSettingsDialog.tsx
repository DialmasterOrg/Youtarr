import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '../../ui';
import { SubfolderAutocomplete } from '../../shared/SubfolderAutocomplete';
import { ResolutionSelect } from '../../shared/ResolutionSelect';
import { AudioFormatSelect } from '../../shared/AudioFormatSelect';
import { RatingSelect } from '../../shared/RatingSelect';
import { useSubfolders } from '../../../hooks/useSubfolders';
import { useConfig } from '../../../hooks/useConfig';
import { usePlaylistMutations } from '../../../hooks/usePlaylistMutations';
import { Playlist, PlaylistSortOrderSetting, PlaylistSubscribeSettings } from '../../../types/playlist';
import PlaylistDownloadFilters from './PlaylistDownloadFilters';
import { hasDownloadFilters, PlaylistFilterValues } from '../hooks/usePlaylistFilterPreview';

interface PlaylistSettingsDialogProps {
  open: boolean;
  playlist: Playlist;
  token: string | null;
  onClose: () => void;
  onSaved: (next: PlaylistSubscribeSettings) => void;
  onFollowFromNow?: () => void;
}

interface FormState extends PlaylistFilterValues {
  default_sub_folder: string | null;
  video_quality: string | null;
  audio_format: string | null;
  default_rating: string | null;
  sort_order: PlaylistSortOrderSetting;
}

function fromPlaylist(p: Playlist): FormState {
  return {
    default_sub_folder: p.default_sub_folder ?? null,
    video_quality: p.video_quality ?? null,
    audio_format: p.audio_format ?? null,
    default_rating: p.default_rating ?? null,
    sort_order: p.sort_order ?? 'default',
    min_duration: p.min_duration ?? null,
    max_duration: p.max_duration ?? null,
    title_filter_regex: p.title_filter_regex ?? null,
  };
}

/** The fields of a draft that differ from the saved values it started from. */
function changedFields(draft: FormState, saved: FormState): Partial<FormState> {
  const changed: Partial<FormState> = {};
  const keep = <K extends keyof FormState>(field: K) => {
    if (draft[field] !== saved[field]) changed[field] = draft[field];
  };
  (Object.keys(saved) as (keyof FormState)[]).forEach(keep);
  return changed;
}

const MP3_HELPER_TEXT ='MP3 files are saved at 192kbps in the same folder as videos.';
const MP3_ONLY_SYNC_HINT =
  ' MP3 Only playlists sync to media servers as music playlists: the server needs a music-type library that includes your Youtarr output folder.';
const VIDEO_MP3_SYNC_HINT =
  ' Video + MP3 playlists sync to media servers as video playlists: the server needs a video-type library that includes your Youtarr output folder.';

const PlaylistSettingsDialog: React.FC<PlaylistSettingsDialogProps> = ({
  open,
  playlist,
  token,
  onClose,
  onSaved,
  onFollowFromNow,
}) => {
  const [form, setForm] = useState<FormState>(() => fromPlaylist(playlist));
  const sortOrderLabelId = useId();

  const { subfolders, loading: subfoldersLoading, createSubfolder } = useSubfolders(token);
  const { config, refetch: refetchConfig } = useConfig(token);
  const { updateSettings, pending, error } = usePlaylistMutations({ token });
  // The hook keeps its last error until the next save. It described the values
  // sent then, so it is hidden once they are edited or the dialog is reopened.
  const [errorDismissed, setErrorDismissed] = useState(true);
  const saveError = errorDismissed ? null : error;

  // The saved values the form was last brought up to date with; null until
  // the dialog opens, and again when it switches playlists.
  const syncedRef = useRef<FormState | null>(null);
  useEffect(() => {
    syncedRef.current = null;
  }, [open, playlist.playlist_id]);

  // The page refetches the playlist on download and sync events, and another
  // session may have saved settings meanwhile. A refresh updates every field
  // the user has not changed and keeps the ones they have, so it never
  // discards a draft and a save never writes back a value the user did not pick.
  useEffect(() => {
    if (!open) return;
    const saved = fromPlaylist(playlist);
    const synced = syncedRef.current;
    syncedRef.current = saved;
    if (synced) {
      setForm((draft) => ({ ...saved, ...changedFields(draft, synced) }));
      return;
    }
    setErrorDismissed(true);
    setForm(saved);
    refetchConfig().catch(() => {
      /* non-critical: dialog still works without the latest global default */
    });
  }, [open, playlist, refetchConfig]);

  const changeForm = (changes: Partial<FormState>) => {
    setErrorDismissed(true);
    setForm((prev) => ({ ...prev, ...changes }));
  };
  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    changeForm({ [field]: value } as Pick<FormState, K>);
  };

  // Media-server playlists are typed by the Download Type setting (MP3 Only =
  // music playlist, anything else = video playlist), so crossing that boundary
  // replaces the synced playlist on the next sync. Warn before saving.
  const wasAudio = playlist.audio_format === 'mp3_only';
  const willBeAudio = form.audio_format === 'mp3_only';
  const syncTypeChanges = wasAudio !== willBeAudio;

  const isDirty = JSON.stringify(form) !== JSON.stringify(fromPlaylist(playlist));
  // Saving a new order doesn't sync anything by itself.
  const sortOrderChanges = form.sort_order !== (playlist.sort_order ?? 'default');

  const handleSave = async () => {
    const saved = fromPlaylist(playlist);
    // Only edited filters are sent. Filters set through the API before this
    // dialog existed were not validated, and resending one the server now
    // rejects would block saving an unrelated setting. Unedited fields track
    // the playlist (see the refresh effect), so comparing with it finds the edits.
    const settings: PlaylistSubscribeSettings = {
      default_sub_folder: form.default_sub_folder,
      video_quality: form.video_quality,
      audio_format: form.audio_format,
      default_rating: form.default_rating,
      sort_order: form.sort_order,
      ...(form.min_duration !== saved.min_duration && { min_duration: form.min_duration }),
      ...(form.max_duration !== saved.max_duration && { max_duration: form.max_duration }),
      ...(form.title_filter_regex !== saved.title_filter_regex && {
        title_filter_regex: form.title_filter_regex?.trim() || null,
      }),
    };
    setErrorDismissed(false);
    const ok = await updateSettings(playlist.playlist_id, settings);
    if (ok) {
      onSaved(settings);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Playlist Settings</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-4 mt-2">
          {playlist.auto_download_baseline_at && onFollowFromNow && (
            <div className="rounded-md border border-border p-3 flex flex-col gap-2">
              <Typography variant="subtitle2">Automatic downloads</Typography>
              <Typography variant="body2" color="text.secondary">
                Tracking started {new Date(playlist.auto_download_baseline_at).toLocaleString()}.
                Follow from now to skip the current undownloaded backlog. This keeps automatic downloads running or paused as they are now. You will review this before applying it.
              </Typography>
              <Button variant="outlined" onClick={onFollowFromNow}
                disabled={pending || isDirty}>Follow from now...</Button>
              {isDirty && <Typography variant="caption">Save or discard your settings changes before changing the starting point.</Typography>}
            </div>
          )}

          <Alert severity="info">
            <Typography variant="body2">
              Defaults for videos downloaded from this playlist. A video&apos;s own channel
              settings take precedence; these apply when the channel has no override. They also
              seed new channels auto-created from this playlist. The Download Type additionally
              decides whether this playlist syncs to media servers as a video or music playlist.
            </Typography>
          </Alert>

          <div>
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
              Subfolder
            </Typography>
            <SubfolderAutocomplete
              mode="channel"
              value={form.default_sub_folder}
              onChange={(value) => update('default_sub_folder', value)}
              subfolders={subfolders}
              loading={subfoldersLoading}
              createSubfolder={createSubfolder}
              defaultSubfolderDisplay={config.defaultSubfolder || null}
              label="Default Subfolder"
              helperText="Where this playlist's videos are saved when the channel has no subfolder of its own."
            />
          </div>

          <Divider />

          <div>
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
              Resolution Override
            </Typography>
            <ResolutionSelect
              value={form.video_quality}
              onChange={(value) => update('video_quality', value)}
              label="Video Quality"
              emptyLabel="Using Global Setting"
            />
          </div>

          <div>
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
              Download Type
            </Typography>
            <AudioFormatSelect
              value={form.audio_format}
              onChange={(value) => update('audio_format', value)}
              helperText={
                form.audio_format
                  ? form.audio_format === 'mp3_only'
                    ? MP3_HELPER_TEXT + MP3_ONLY_SYNC_HINT
                    : MP3_HELPER_TEXT + VIDEO_MP3_SYNC_HINT
                  : undefined
              }
            />
            {syncTypeChanges && (
              <div className="mt-2">
                <Alert severity="warning">
                  <Typography variant="body2">
                    {willBeAudio
                      ? 'On the next sync, media servers will replace the synced video playlist with a music playlist. Items downloaded as video without an MP3 will not appear in it; existing downloads are never converted or re-downloaded.'
                      : 'On the next sync, media servers will replace the synced music playlist with a video playlist. Items downloaded as MP3 only will not appear in it; existing downloads are never converted or re-downloaded.'}
                  </Typography>
                </Alert>
              </div>
            )}
          </div>

          <Divider />

          <div>
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
              Playlist Order
            </Typography>
            <FormControl style={{ minWidth: 230 }}>
              <InputLabel id={sortOrderLabelId} shrink>
                Playlist order
              </InputLabel>
              <Select
                labelId={sortOrderLabelId}
                size="small"
                value={form.sort_order}
                onValueChange={(next) => update('sort_order', next as PlaylistSortOrderSetting)}
              >
                <MenuItem value="default">YouTube playlist order</MenuItem>
                <MenuItem value="reversed">Reverse playlist order</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" className="block mt-1">
              Playback order in the .m3u file and synced media server playlists.
              This does not affect automatic downloads or sorting on this page.
            </Typography>
            {sortOrderChanges && (
              <div className="mt-2">
                <Alert severity="info">
                  <Typography variant="body2">
                    The new order applies the next time this playlist syncs. Use Sync now and
                    Rebuild .m3u file on the playlist page, or wait for the next download.
                  </Typography>
                </Alert>
              </div>
            )}
          </div>

          <Divider />

          <div>
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
              Default Rating
            </Typography>
            <RatingSelect
              value={form.default_rating}
              onChange={(value) => update('default_rating', value)}
              label="Default Rating"
            />
          </div>

          <Divider />

          <PlaylistDownloadFilters
            value={{
              min_duration: form.min_duration,
              max_duration: form.max_duration,
              title_filter_regex: form.title_filter_regex,
            }}
            onChange={changeForm}
            playlistId={playlist.playlist_id}
            token={token}
            hasSavedFilters={hasDownloadFilters(playlist)}
            autoDownload={playlist.auto_download}
            disabled={pending}
          />
        </div>
      </DialogContent>
      {/* Outside the scrolling content, so it shows wherever the dialog is scrolled to. */}
      {saveError && (
        <div className="px-6 py-3">
          <Alert severity="error">{saveError}</Alert>
        </div>
      )}
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlaylistSettingsDialog;
