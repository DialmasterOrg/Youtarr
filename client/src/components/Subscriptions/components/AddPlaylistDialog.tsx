import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '../../ui';
import { usePlaylistMutations } from '../../../hooks/usePlaylistMutations';
import { useMediaServerStatus } from '../../../hooks/useMediaServerStatus';
import {
  Playlist,
  PlaylistPreview,
  PlaylistSubscribeSettings,
} from '../../../types/playlist';

interface AddPlaylistDialogProps {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onSubscribed?: (playlist: Playlist) => void;
}

const AddPlaylistDialog: React.FC<AddPlaylistDialogProps> = ({
  open,
  token,
  onClose,
  onSubscribed,
}) => {
  const navigate = useNavigate();
  const { anyConfigured, status } = useMediaServerStatus(token);
  const { fetchPlaylistInfo, subscribe, error: mutationError, pending } =
    usePlaylistMutations({ token });

  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<PlaylistPreview | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = mutationError || localError;

  const resetAndClose = () => {
    setUrl('');
    setPreview(null);
    setLocalError(null);
    onClose();
  };

  const handleFetch = async () => {
    setLocalError(null);
    setPreview(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setLocalError('Please paste a YouTube playlist URL.');
      return;
    }
    const info = await fetchPlaylistInfo(trimmed);
    if (info) setPreview(info);
  };

  const handleSubscribe = async () => {
    setLocalError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setLocalError('URL is required.');
      return;
    }
    const settings: PlaylistSubscribeSettings = {
      sync_to_plex: status.plex,
      sync_to_jellyfin: status.jellyfin,
      sync_to_emby: status.emby,
    };
    const playlist = await subscribe(trimmed, settings);
    if (playlist) {
      onSubscribed?.(playlist);
      resetAndClose();
      navigate(`/playlist/${playlist.playlist_id}`);
    }
  };

  const enabledServers = [
    status.plex && 'Plex',
    status.jellyfin && 'Jellyfin',
    status.emby && 'Emby',
  ].filter(Boolean) as string[];

  return (
    <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add playlist</DialogTitle>
      <DialogContent>
        <div className="flex flex-col gap-3 mt-2">
          <TextField
            label="YouTube playlist URL"
            placeholder="https://www.youtube.com/playlist?list=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !pending) {
                e.preventDefault();
                handleFetch();
              }
            }}
            fullWidth
            size="small"
            disabled={pending}
          />

          {!anyConfigured && (
            <Alert severity="warning">
              <Typography variant="body2">
                No media server is currently configured. Youtarr will still download videos and
                generate an M3U playlist file, but no native media-server playlist will be created
                until you configure Plex, Jellyfin, or Emby in Settings.
              </Typography>
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {preview && (
            <Box className="flex gap-3 items-start mt-1">
              {preview.thumbnail && (
                <img
                  src={preview.thumbnail}
                  alt={preview.title}
                  style={{
                    width: 120,
                    height: 90,
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-ui)',
                    border: '1px solid var(--border)',
                  }}
                />
              )}
              <div className="flex flex-col gap-1">
                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                  {preview.title}
                </Typography>
                {preview.uploader && (
                  <Typography variant="body2" color="text.secondary">
                    {preview.uploader}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {preview.video_count} videos
                </Typography>
              </div>
            </Box>
          )}

          {preview && anyConfigured && (
            <Typography variant="caption" color="text.secondary">
              On subscribe, Youtarr will sync this playlist to: {enabledServers.join(', ')}.
            </Typography>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={resetAndClose} disabled={pending}>
          Cancel
        </Button>
        {preview ? (
          <Button variant="contained" onClick={handleSubscribe} disabled={pending}>
            {pending ? <CircularProgress size={16} /> : 'Subscribe'}
          </Button>
        ) : (
          <Button variant="contained" onClick={handleFetch} disabled={pending}>
            {pending ? <CircularProgress size={16} /> : 'Fetch info'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default AddPlaylistDialog;
