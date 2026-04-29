import React, { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography,
} from './ui';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { usePlaylistDetail } from '../hooks/usePlaylistDetail';
import { usePlaylistMutations } from '../hooks/usePlaylistMutations';
import { useMediaServerStatus } from '../hooks/useMediaServerStatus';
import { MediaServerType, Playlist, PlaylistSubscribeSettings, PlaylistVideo } from '../types/playlist';
import PlaylistSyncChips from './PlaylistPage/components/PlaylistSyncChips';
import NoMediaServerWarning from './PlaylistPage/components/NoMediaServerWarning';
import PlaylistVideoTable from './PlaylistPage/components/PlaylistVideoTable';
import PlaylistSettingsDialog from './PlaylistPage/components/PlaylistSettingsDialog';
import VideoModal from './shared/VideoModal';
import { VideoModalData } from './shared/VideoModal/types';

interface PlaylistPageProps {
  token: string | null;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info';
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function toModalData(v: PlaylistVideo): VideoModalData {
  const status = v.youtube_removed
    ? 'missing'
    : v.downloaded
      ? 'downloaded'
      : 'never_downloaded';
  return {
    youtubeId: v.youtube_id,
    title: v.title || v.youtube_id,
    channelName: v.channel_name || '',
    thumbnailUrl: v.thumbnail || `https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`,
    duration: v.duration,
    publishedAt: v.published_at,
    addedAt: v.added_at,
    mediaType: 'video',
    status,
    isDownloaded: v.downloaded,
    filePath: v.file_path,
    fileSize: v.file_size,
    audioFilePath: null,
    audioFileSize: null,
    isProtected: false,
    isIgnored: v.ignored,
    normalizedRating: null,
    ratingSource: null,
    databaseId: v.video_id,
    channelId: v.channel_id,
  };
}

function PlaylistPage({ token }: PlaylistPageProps) {
  const { id: playlistIdParam } = useParams<{ id: string }>();
  const playlistId = playlistIdParam || null;
  const isMobile = useMediaQuery('(max-width: 767px)');

  const {
    playlist,
    videos,
    loading,
    error,
    refetch,
    refresh,
    sync,
    regenerateM3U,
    triggerDownload,
  } = usePlaylistDetail({ token, playlistId });

  const {
    status: serverStatus,
    anyConfigured,
  } = useMediaServerStatus(token);

  const {
    pending,
    toggleSyncTarget,
    togglePublic,
    ignoreVideo,
    unignoreVideo,
  } = usePlaylistMutations({ token });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmPublicOpen, setConfirmPublicOpen] = useState(false);
  const [pendingVideoId, setPendingVideoId] = useState<string | null>(null);
  const [modalVideo, setModalVideo] = useState<VideoModalData | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [actionRunning, setActionRunning] = useState(false);

  const showSnackbar = useCallback((message: string, severity: SnackbarState['severity'] = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleAction = useCallback(
    async (label: string, action: () => Promise<unknown>) => {
      setActionRunning(true);
      try {
        await action();
        showSnackbar(`${label} succeeded`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `${label} failed`;
        showSnackbar(msg, 'error');
      } finally {
        setActionRunning(false);
      }
    },
    [showSnackbar]
  );

  const handleToggleSync = useCallback(
    async (server: MediaServerType, enabled: boolean) => {
      if (!playlist) return;
      const updated = await toggleSyncTarget(playlist.playlist_id, server, enabled);
      if (updated) {
        await refetch();
      }
    },
    [playlist, toggleSyncTarget, refetch]
  );

  const handleConfirmPublic = useCallback(
    async (next: boolean) => {
      if (!playlist) return;
      const updated = await togglePublic(playlist.playlist_id, next);
      if (updated) {
        await refetch();
        showSnackbar(next ? 'Playlist marked public' : 'Playlist marked private');
      }
      setConfirmPublicOpen(false);
    },
    [playlist, togglePublic, refetch, showSnackbar]
  );

  const handleIgnoreVideo = useCallback(
    async (ytId: string) => {
      if (!playlist) return;
      setPendingVideoId(ytId);
      const ok = await ignoreVideo(playlist.playlist_id, ytId);
      setPendingVideoId(null);
      if (ok) await refetch();
    },
    [playlist, ignoreVideo, refetch]
  );

  const handleUnignoreVideo = useCallback(
    async (ytId: string) => {
      if (!playlist) return;
      setPendingVideoId(ytId);
      const ok = await unignoreVideo(playlist.playlist_id, ytId);
      setPendingVideoId(null);
      if (ok) await refetch();
    },
    [playlist, unignoreVideo, refetch]
  );

  const handleSettingsSaved = useCallback(
    (next: PlaylistSubscribeSettings) => {
      showSnackbar('Playlist settings saved');
      // The playlist meta may not include all settings; refetch to refresh it.
      refetch();
      // Keep next reference to avoid unused-var warning.
      void next;
    },
    [refetch, showSnackbar]
  );

  if (loading && !playlist) {
    return (
      <Box className="py-8 flex justify-center">
        <Typography color="text.secondary">Loading playlist...</Typography>
      </Box>
    );
  }

  if (error || !playlist) {
    return (
      <Alert severity="error" className="mt-4">
        {error || 'Playlist not found.'}
      </Alert>
    );
  }

  const playlistThumbUrl =
    playlist.thumbnail ||
    (videos[0]?.youtube_id ? `https://i.ytimg.com/vi/${videos[0].youtube_id}/hqdefault.jpg` : '');

  const renderHeader = (p: Playlist) => (
    <Card elevation={8} className="mb-4" style={{ borderRadius: 'var(--radius-ui)', overflow: 'hidden' }}>
      <CardContent
        style={{
          paddingLeft: isMobile ? 10 : 16,
          paddingRight: isMobile ? 10 : 16,
          paddingTop: isMobile ? 12 : 16,
          paddingBottom: isMobile ? 12 : 16,
        }}
      >
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} sm={4}>
            <Box
              component="img"
              src={playlistThumbUrl}
              alt="Playlist thumbnail"
              className="w-full h-full object-cover rounded-xl bg-muted block"
              style={{ border: '1px solid var(--border)', minHeight: 120 }}
            />
          </Grid>
          <Grid item xs={12} sm={8} className="flex flex-col gap-3">
            <div>
              <Typography variant="h5" style={{ fontWeight: 700 }}>
                {p.title}
              </Typography>
              {p.uploader && (
                <Typography variant="body2" color="text.secondary">
                  By {p.uploader}
                </Typography>
              )}
            </div>

            <Stack direction="row" spacing={2} className="flex-wrap gap-2">
              <Typography variant="body2" color="text.secondary">
                {p.video_count} videos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last fetched: {formatTimestamp(p.lastFetched)}
              </Typography>
            </Stack>

            <PlaylistSyncChips
              playlist={p}
              serverStatus={serverStatus}
              onToggle={handleToggleSync}
              disabled={pending}
            />

            <Stack direction="row" spacing={1} className="flex-wrap gap-2">
              <Button
                variant="contained"
                size="sm"
                onClick={() => handleAction('Refresh', refresh)}
                disabled={actionRunning}
              >
                Refresh
              </Button>
              <Button
                variant="contained"
                size="sm"
                onClick={() => handleAction('Download', triggerDownload)}
                disabled={actionRunning}
              >
                Download
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => handleAction('Sync', sync)}
                disabled={actionRunning || !anyConfigured}
              >
                Sync now
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => handleAction('M3U regen', regenerateM3U)}
                disabled={actionRunning}
              >
                Regen M3U
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                disabled={actionRunning}
              >
                Settings
              </Button>
              <Button
                variant={p.public_on_servers ? 'contained' : 'outlined'}
                size="sm"
                onClick={() => setConfirmPublicOpen(true)}
                disabled={actionRunning || !anyConfigured}
              >
                {p.public_on_servers ? 'Public' : 'Private'}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  return (
    <div>
      {!anyConfigured && <NoMediaServerWarning />}

      {renderHeader(playlist)}

      <Card style={{ borderRadius: 'var(--radius-ui)' }}>
        <CardContent>
          <Typography variant="h6" style={{ fontWeight: 600, marginBottom: 8 }}>
            Videos (in playlist order)
          </Typography>
          <PlaylistVideoTable
            videos={videos}
            loading={loading}
            onIgnore={handleIgnoreVideo}
            onUnignore={handleUnignoreVideo}
            onVideoClick={(v) => setModalVideo(toModalData(v))}
            pendingId={pendingVideoId}
          />
        </CardContent>
      </Card>

      <PlaylistSettingsDialog
        open={settingsOpen}
        playlist={playlist}
        token={token}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
      />

      <Dialog
        open={confirmPublicOpen}
        onClose={() => setConfirmPublicOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Make playlist {playlist.public_on_servers ? 'private' : 'public'}?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {playlist.public_on_servers
              ? 'Other users on your media servers will no longer see this playlist.'
              : 'This playlist will become visible to other users on your media servers. ' +
                'On Plex, visibility may also require per-user access grants in the Plex admin UI.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setConfirmPublicOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => handleConfirmPublic(!playlist.public_on_servers)}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {snackbar.open && (
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          className="mt-3"
        >
          {snackbar.message}
        </Alert>
      )}

      {modalVideo && (
        <VideoModal
          open
          onClose={() => setModalVideo(null)}
          video={modalVideo}
          token={token}
          allowIgnore={false}
        />
      )}
    </div>
  );
}

export default PlaylistPage;
