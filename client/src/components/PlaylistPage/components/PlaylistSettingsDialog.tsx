import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Typography,
} from '../../ui';
import { SubfolderAutocomplete } from '../../shared/SubfolderAutocomplete';
import { ResolutionSelect } from '../../shared/ResolutionSelect';
import { AudioFormatSelect } from '../../shared/AudioFormatSelect';
import { RatingSelect } from '../../shared/RatingSelect';
import { useSubfolders } from '../../../hooks/useSubfolders';
import { useConfig } from '../../../hooks/useConfig';
import { usePlaylistMutations } from '../../../hooks/usePlaylistMutations';
import { Playlist, PlaylistSubscribeSettings } from '../../../types/playlist';

interface PlaylistSettingsDialogProps {
  open: boolean;
  playlist: Playlist;
  token: string | null;
  onClose: () => void;
  onSaved: (next: PlaylistSubscribeSettings) => void;
}

// Settings surfaced by this dialog. The playlist also has min_duration,
// max_duration and title_filter_regex columns; they only pre-seed auto-created
// source channels (not the playlist download resolver) and are intentionally not
// exposed here yet. They are left untouched on save.
interface FormState {
  default_sub_folder: string | null;
  video_quality: string | null;
  audio_format: string | null;
  default_rating: string | null;
}

function fromPlaylist(p: Playlist): FormState {
  return {
    default_sub_folder: p.default_sub_folder ?? null,
    video_quality: p.video_quality ?? null,
    audio_format: p.audio_format ?? null,
    default_rating: p.default_rating ?? null,
  };
}

const MP3_HELPER_TEXT = 'MP3 files are saved at 192kbps in the same folder as videos.';

const PlaylistSettingsDialog: React.FC<PlaylistSettingsDialogProps> = ({
  open,
  playlist,
  token,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<FormState>(() => fromPlaylist(playlist));

  const { subfolders, loading: subfoldersLoading } = useSubfolders(token);
  const { config, refetch: refetchConfig } = useConfig(token);
  const { updateSettings, pending, error } = usePlaylistMutations({ token });

  useEffect(() => {
    if (open) {
      setForm(fromPlaylist(playlist));
      refetchConfig().catch(() => {
        /* non-critical: dialog still works without the latest global default */
      });
    }
  }, [open, playlist, refetchConfig]);

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    const settings: PlaylistSubscribeSettings = {
      default_sub_folder: form.default_sub_folder,
      video_quality: form.video_quality,
      audio_format: form.audio_format,
      default_rating: form.default_rating,
    };
    const ok = await updateSettings(playlist.playlist_id, settings);
    if (ok) {
      onSaved(settings);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Playlist Download Settings</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-4 mt-2">
          {error && <Alert severity="error">{error}</Alert>}

          <Alert severity="info">
            <Typography variant="body2">
              Defaults for videos downloaded from this playlist. A video&apos;s own channel
              settings take precedence; these apply when the channel has no override. They also
              seed new channels auto-created from this playlist.
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
              helperText={form.audio_format ? MP3_HELPER_TEXT : undefined}
            />
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
        </div>
      </DialogContent>
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
