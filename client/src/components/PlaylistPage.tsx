import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Typography,
} from './ui';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useConfig } from '../hooks/useConfig';
import { usePlaylistDetail, PlaylistSortOrder } from '../hooks/usePlaylistDetail';
import { usePlaylistMutations } from '../hooks/usePlaylistMutations';
import { useMediaServerStatus } from '../hooks/useMediaServerStatus';
import { MediaServerType, PlaylistSubscribeSettings, PlaylistVideo } from '../types/playlist';
import PlaylistHeader from './PlaylistPage/components/PlaylistHeader';
import NoMediaServerWarning from './PlaylistPage/components/NoMediaServerWarning';
import PlaylistVideoList from './PlaylistPage/components/PlaylistVideoList';
import PlaylistSortControl from './PlaylistPage/components/PlaylistSortControl';
import { useVideoSelection } from './shared/VideoList/hooks/useVideoSelection';
import VideoListSelectionPill from './shared/VideoList/VideoListSelectionPill';
import { SelectionAction } from './shared/VideoList/types';
import { Download as DownloadIcon } from '../lib/icons';
import PlaylistSettingsDialog from './PlaylistPage/components/PlaylistSettingsDialog';
import DownloadSettingsDialog from './DownloadManager/ManualDownload/DownloadSettingsDialog';
import { DownloadSettings } from './DownloadManager/ManualDownload/types';
import SubscriptionsBackButton from './shared/SubscriptionsBackButton';
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

  const [sortOrder, setSortOrder] = useState<PlaylistSortOrder>('desc');

  const {
    playlist,
    videos,
    notDownloadedCount,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refetch,
    refetchMeta,
    markVideoIgnored,
    refresh,
    sync,
    regenerateM3U,
    triggerDownload,
  } = usePlaylistDetail({ token, playlistId, sortOrder });

  const {
    status: serverStatus,
    anyConfigured,
  } = useMediaServerStatus(token);

  const {
    pending,
    toggleSyncTarget,
    togglePublic,
    toggleAutoDownload,
    ignoreVideo,
    unignoreVideo,
  } = usePlaylistMutations({ token });

  const navigate = useNavigate();
  const { config } = useConfig(token);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{ mode: 'all' | 'selected'; ids: string[] }>({
    mode: 'all',
    ids: [],
  });

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
    async (label: string, action: () => Promise<unknown>): Promise<boolean> => {
      setActionRunning(true);
      try {
        await action();
        showSnackbar(`${label} succeeded`);
        return true;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : `${label} failed`;
        showSnackbar(msg, 'error');
        return false;
      } finally {
        setActionRunning(false);
      }
    },
    [showSnackbar]
  );

  const selectionClearRef = useRef<() => void>(() => {});
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const handleDownloadSelected = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setPendingDownload({ mode: 'selected', ids });
    setDownloadDialogOpen(true);
  }, []);

  const handleConfirmDownload = useCallback(
    async (settings: DownloadSettings | null) => {
      setDownloadDialogOpen(false);
      const overrideSettings = settings
        ? {
            resolution: settings.resolution,
            allowRedownload: settings.allowRedownload,
            subfolder: settings.subfolder,
            audioFormat: settings.audioFormat,
            rating: settings.rating,
            skipVideoFolder: settings.skipVideoFolder,
          }
        : undefined;
      const ids = pendingDownload.mode === 'selected' ? pendingDownload.ids : undefined;
      const ok = await handleAction('Download', () => triggerDownload(ids, overrideSettings));
      if (ok) {
        if (pendingDownload.mode === 'selected') selectionClearRef.current();
        navigate('/downloads/activity');
      }
    },
    [pendingDownload, handleAction, triggerDownload, navigate]
  );

  const openDownloadAll = useCallback(() => {
    setPendingDownload({ mode: 'all', ids: [] });
    setDownloadDialogOpen(true);
  }, []);

  const downloadActions = useMemo<SelectionAction<string>[]>(
    () => [
      {
        id: 'download',
        label: 'Download Selected',
        intent: 'success',
        icon: <DownloadIcon size={14} />,
        onClick: (ids) => {
          void handleDownloadSelected(ids);
        },
      },
    ],
    [handleDownloadSelected]
  );

  const selection = useVideoSelection<string>({ actions: downloadActions });

  useEffect(() => {
    selectionClearRef.current = selection.clear;
  }, [selection.clear]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    if (loading || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { root: null, rootMargin: '0px 0px 160px 0px', threshold: 0 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, loadMore]);

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

  const handleToggleAutoDownload = useCallback(
    async (enabled: boolean) => {
      if (!playlist) return;
      const updated = await toggleAutoDownload(playlist.playlist_id, enabled);
      if (updated) {
        await refetch();
        showSnackbar(enabled ? 'Auto-download enabled' : 'Auto-download disabled');
      }
    },
    [playlist, toggleAutoDownload, refetch, showSnackbar]
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
      if (ok) {
        // Update the row in place and refresh only the count, so the user's
        // scroll position in a long (paginated) list is preserved.
        markVideoIgnored(ytId, true);
        await refetchMeta();
      }
    },
    [playlist, ignoreVideo, markVideoIgnored, refetchMeta]
  );

  const handleUnignoreVideo = useCallback(
    async (ytId: string) => {
      if (!playlist) return;
      setPendingVideoId(ytId);
      const ok = await unignoreVideo(playlist.playlist_id, ytId);
      setPendingVideoId(null);
      if (ok) {
        markVideoIgnored(ytId, false);
        await refetchMeta();
      }
    },
    [playlist, unignoreVideo, markVideoIgnored, refetchMeta]
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
      <div>
        <Box className="mb-3">
          <SubscriptionsBackButton tab="playlists" />
        </Box>
        <Box className="py-8 flex justify-center">
          <Typography color="text.secondary">Loading playlist...</Typography>
        </Box>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div>
        <Box className="mb-3">
          <SubscriptionsBackButton tab="playlists" />
        </Box>
        <Alert severity="error" className="mt-4">
          {error || 'Playlist not found.'}
        </Alert>
      </div>
    );
  }

  const playlistThumbUrl =
    playlist.thumbnail ||
    (videos[0]?.youtube_id ? `https://i.ytimg.com/vi/${videos[0].youtube_id}/hqdefault.jpg` : '');

  return (
    <div>
      <Box className="mb-3">
        <SubscriptionsBackButton tab="playlists" />
      </Box>

      {!anyConfigured && <NoMediaServerWarning />}

      <PlaylistHeader
        playlist={playlist}
        thumbnailUrl={playlistThumbUrl}
        isMobile={isMobile}
        serverStatus={serverStatus}
        anyConfigured={anyConfigured}
        newCount={notDownloadedCount}
        togglePending={pending}
        actionRunning={actionRunning}
        onRefresh={() => handleAction('Refresh', refresh)}
        onDownloadAll={openDownloadAll}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleAutoDownload={handleToggleAutoDownload}
        onToggleSync={handleToggleSync}
        onChangePublic={() => setConfirmPublicOpen(true)}
        onSyncNow={() => handleAction('Sync', sync)}
        onRegenerateM3U={() => handleAction('M3U regen', regenerateM3U)}
      />

      <Card style={{ borderRadius: 'var(--radius-ui)' }}>
        <CardContent>
          <Box className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <Typography variant="h6" style={{ fontWeight: 600 }}>
              Videos
            </Typography>
            <PlaylistSortControl
              value={sortOrder}
              onChange={setSortOrder}
              disabled={loading && videos.length === 0}
            />
          </Box>
          <PlaylistVideoList
            videos={videos}
            loading={loading}
            onIgnore={handleIgnoreVideo}
            onUnignore={handleUnignoreVideo}
            onVideoClick={(v) => setModalVideo(toModalData(v))}
            pendingId={pendingVideoId}
            isSelected={selection.isSelected}
            onToggle={selection.toggle}
            onSelectAll={(ids) => selection.selectAll(ids)}
            onClearSelection={selection.clear}
          />
          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-3">
              {loadingMore && (
                <Typography variant="body2" color="text.secondary">
                  Loading more...
                </Typography>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <PlaylistSettingsDialog
        open={settingsOpen}
        playlist={playlist}
        token={token}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
      />

      <DownloadSettingsDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        onConfirm={handleConfirmDownload}
        mode="manual"
        token={token}
        videoCount={
          pendingDownload.mode === 'selected'
            ? pendingDownload.ids.length
            : notDownloadedCount ?? playlist.video_count
        }
        defaultResolution={config.preferredResolution || '1080'}
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
              ? 'On Jellyfin and Emby, this playlist will no longer be visible to other users. ' +
                'Plex playlists are shared manually, so this setting does not affect them.'
              : 'On Jellyfin and Emby, this playlist will become visible to other users. ' +
                'Plex has no automatic public setting; share Plex playlists with each user inside Plex.'}
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

      <VideoListSelectionPill selection={selection} isMobile={isMobile} />
    </div>
  );
}

export default PlaylistPage;
