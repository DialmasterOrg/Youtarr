import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '../../ui';
import { Playlist, PlaylistSubscribeSettings } from '../../../types/playlist';

interface PlaylistSettingsDialogProps {
  open: boolean;
  playlist: Playlist;
  token: string | null;
  onClose: () => void;
  onSaved: (next: PlaylistSubscribeSettings) => void;
}

const SEED_NOTE =
  'This value seeds new channels created from this playlist. Existing channels are not affected.';

interface FormState {
  default_sub_folder: string;
  video_quality: string;
  min_duration: string;
  max_duration: string;
  title_filter_regex: string;
  audio_format: string;
  default_rating: string;
}

function fromPlaylist(p: Playlist): FormState {
  return {
    default_sub_folder: p.default_sub_folder ?? '',
    video_quality: p.video_quality ?? '',
    min_duration: p.min_duration != null ? String(p.min_duration) : '',
    max_duration: p.max_duration != null ? String(p.max_duration) : '',
    title_filter_regex: p.title_filter_regex ?? '',
    audio_format: p.audio_format ?? '',
    default_rating: p.default_rating ?? '',
  };
}

function toSettings(form: FormState): PlaylistSubscribeSettings {
  const parseIntOrNull = (s: string): number | null => {
    if (!s.trim()) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };
  return {
    default_sub_folder: form.default_sub_folder.trim() || null,
    video_quality: form.video_quality.trim() || null,
    min_duration: parseIntOrNull(form.min_duration),
    max_duration: parseIntOrNull(form.max_duration),
    title_filter_regex: form.title_filter_regex.trim() || null,
    audio_format: form.audio_format.trim() || null,
    default_rating: form.default_rating.trim() || null,
  };
}

const PlaylistSettingsDialog: React.FC<PlaylistSettingsDialogProps> = ({
  open,
  playlist,
  token,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<FormState>(() => fromPlaylist(playlist));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(fromPlaylist(playlist));
      setError(null);
    }
  }, [open, playlist]);

  const handleField = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const settings = toSettings(form);
      await axios.put(
        `/api/playlists/${playlist.playlist_id}/settings`,
        settings,
        { headers: { 'x-access-token': token } }
      );
      onSaved(settings);
      onClose();
    } catch (err: unknown) {
      const message =
        (axios.isAxiosError(err) && err.response?.data?.error) ||
        'Failed to save playlist settings';
      setError(typeof message === 'string' ? message : 'Failed to save playlist settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Playlist Settings</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-3 mt-2">
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Default sub-folder"
            value={form.default_sub_folder}
            onChange={handleField('default_sub_folder')}
            helperText={SEED_NOTE}
            fullWidth
            size="small"
          />
          <TextField
            label="Video quality (e.g. 1080)"
            value={form.video_quality}
            onChange={handleField('video_quality')}
            helperText={SEED_NOTE}
            fullWidth
            size="small"
          />
          <TextField
            label="Min duration (seconds)"
            value={form.min_duration}
            onChange={handleField('min_duration')}
            helperText={SEED_NOTE}
            type="number"
            fullWidth
            size="small"
          />
          <TextField
            label="Max duration (seconds)"
            value={form.max_duration}
            onChange={handleField('max_duration')}
            helperText={SEED_NOTE}
            type="number"
            fullWidth
            size="small"
          />
          <TextField
            label="Title filter (regex)"
            value={form.title_filter_regex}
            onChange={handleField('title_filter_regex')}
            helperText={SEED_NOTE}
            fullWidth
            size="small"
          />
          <TextField
            label="Audio format"
            value={form.audio_format}
            onChange={handleField('audio_format')}
            helperText={SEED_NOTE}
            fullWidth
            size="small"
          />
          <TextField
            label="Default rating"
            value={form.default_rating}
            onChange={handleField('default_rating')}
            helperText={SEED_NOTE}
            fullWidth
            size="small"
          />

          <Typography variant="caption" color="text.secondary" className="mt-2">
            These settings only apply to channels that get created automatically when this
            playlist is fetched. To change settings for an already-existing channel, edit that
            channel directly.
          </Typography>
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlaylistSettingsDialog;
