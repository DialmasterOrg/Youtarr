import { useVideoActivity } from '../../../../providers/VideoActivityProvider';
import { useLocalVideoStatus } from '../../../../hooks/useLocalVideoStatus';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { VideoModalData } from '../types';
import { useVideoProtection } from '../../useVideoProtection';
import { useVideoDeletion } from '../../useVideoDeletion';
import { useTriggerDownloads } from '../../../../hooks/useTriggerDownloads';
import { DownloadSettings } from '../../../DownloadManager/ManualDownload/types';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

interface AxiosErrorShape {
  response?: { data?: { error?: string } };
}

interface UseVideoModalActionsParams {
  video: VideoModalData;
  token: string | null;
  onVideoDeleted?: (youtubeId: string) => void;
  onMarkedDeleted?: (youtubeId: string) => void;
  onProtectionChanged?: (youtubeId: string, isProtected: boolean) => void;
  onIgnoreChanged?: (youtubeId: string, isIgnored: boolean) => void;
  onDownloadQueued?: (youtubeId: string) => void;
  onRatingChanged?: (youtubeId: string, rating: string | null) => void;
  onClose: () => void;
}

interface UseVideoModalActionsReturn {
  localVideo: VideoModalData;
  snackbar: SnackbarState;
  deleteDialogOpen: boolean;
  downloadDialogOpen: boolean;
  ratingDialogOpen: boolean;
  protectionLoading: boolean;
  markDeletedPending: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  setDownloadDialogOpen: (open: boolean) => void;
  setRatingDialogOpen: (open: boolean) => void;
  handleProtectionToggle: () => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
  handleIgnoreToggle: () => Promise<void>;
  handleMarkDeleted: () => Promise<void>;
  handleDownloadConfirm: (settings: DownloadSettings | null) => Promise<void>;
  handleRatingApply: (rating: string | null) => Promise<void>;
  handleSnackbarClose: () => void;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  return (
    (err as AxiosErrorShape)?.response?.data?.error ||
    (err instanceof Error ? err.message : fallback)
  );
}

export function useVideoModalActions({
  video,
  token,
  onVideoDeleted,
  onMarkedDeleted,
  onProtectionChanged,
  onIgnoreChanged,
  onDownloadQueued,
  onRatingChanged,
  onClose,
}: UseVideoModalActionsParams): UseVideoModalActionsReturn {
  const [localVideo, setLocalVideo] = useState<VideoModalData>(video);
  const { snapshot } = useVideoActivity();
  const statuses = useLocalVideoStatus([video.youtubeId], token);
  const activity = snapshot.videos[video.youtubeId]?.state;
  useEffect(() => {
    const current = statuses[video.youtubeId];
    if (!current) return;
    setLocalVideo(previous => previous.youtubeId !== current.youtubeId ? previous : ({
      ...previous,
      status: previous.isIgnored ? 'ignored' : current.status === 'never_downloaded' && previous.status === 'members_only' ? 'members_only' : current.status,
      isDownloaded: current.status === 'downloaded',
      inArchive: current.inArchive ?? false,
      databaseId: current.databaseId ?? null,
      filePath: current.filePath ?? null,
      fileSize: current.fileSize ?? null,
      audioFilePath: current.audioFilePath ?? null,
      audioFileSize: current.audioFileSize ?? null,
      addedAt: current.addedAt ?? null,
      removal: {
        reason: current.removedReason ?? null,
        at: current.removedAt ?? null,
        detail: current.removedDetail ?? null,
      },
    }));
  }, [statuses, video.youtubeId]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [markDeletedPending, setMarkDeletedPending] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const navigate = useNavigate();
  const protection = useVideoProtection(token);
  const deletion = useVideoDeletion();
  const { triggerDownloads } = useTriggerDownloads(token);

  // Reset local state when a different video is opened (not on every re-render).
  // The video prop is a new object on each parent render, so we track by youtubeId.
  useEffect(() => {
    setLocalVideo(video);
  }, [video.youtubeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleSnackbarClose = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const handleProtectionToggle = useCallback(async () => {
    if (!localVideo.databaseId) return;

    const newState = !localVideo.isProtected;

    // Optimistic update
    setLocalVideo((prev) => ({ ...prev, isProtected: newState }));

    const result = await protection.toggleProtection(
      localVideo.databaseId,
      localVideo.isProtected
    );

    if (result !== undefined) {
      setLocalVideo((prev) => ({ ...prev, isProtected: result }));
      showSnackbar(
        result ? 'Video protected from auto-deletion' : 'Video protection removed',
        'success'
      );
      onProtectionChanged?.(localVideo.youtubeId, result);
    } else {
      setLocalVideo((prev) => ({ ...prev, isProtected: !newState }));
      showSnackbar(protection.error || 'Failed to update protection', 'error');
    }
  }, [localVideo.databaseId, localVideo.isProtected, localVideo.youtubeId, protection, showSnackbar, onProtectionChanged]);

  const handleDeleteConfirm = useCallback(async () => {
    const result = await deletion.deleteVideosByYoutubeIds(
      [localVideo.youtubeId],
      token
    );

    if (result.success) {
      showSnackbar('Video deleted successfully', 'success');
      onVideoDeleted?.(localVideo.youtubeId);
      setDeleteDialogOpen(false);
      onClose();
    } else {
      const errorMsg = result.failed[0]?.error || 'Failed to delete video';
      showSnackbar(errorMsg, 'error');
      setDeleteDialogOpen(false);
    }
  }, [localVideo.youtubeId, token, deletion, showSnackbar, onVideoDeleted, onClose]);

  const handleIgnoreToggle = useCallback(async () => {
    if (!localVideo.channelId) {
      showSnackbar('Cannot ignore: video has no channel context', 'error');
      return;
    }
    const newIgnored = !localVideo.isIgnored;
    const action = newIgnored ? 'ignore' : 'unignore';

    try {
      await axios.post(
        `/api/channels/${localVideo.channelId}/videos/${localVideo.youtubeId}/${action}`,
        undefined,
        { headers: { 'x-access-token': token || '' } }
      );

      setLocalVideo((prev) => ({
        ...prev,
        isIgnored: newIgnored,
        status: newIgnored ? 'ignored' : 'never_downloaded',
      }));
      showSnackbar(
        newIgnored ? 'Video ignored' : 'Video unignored',
        'success'
      );
      onIgnoreChanged?.(localVideo.youtubeId, newIgnored);
    } catch (err: unknown) {
      showSnackbar(extractErrorMessage(err, 'Failed to update ignore status'), 'error');
    }
  }, [localVideo.isIgnored, localVideo.youtubeId, localVideo.channelId, token, showSnackbar, onIgnoreChanged]);

  // A missing video whose file is really gone becomes deleted; the record stays.
  const handleMarkDeleted = useCallback(async () => {
    if (!localVideo.databaseId) return;
    setMarkDeletedPending(true);
    try {
      const response = await axios.post<{ updated: number }>(
        '/api/videos/mark-deleted',
        { videoIds: [localVideo.databaseId] },
        { headers: { 'x-access-token': token || '' } }
      );
      // Zero rows: the file came back, or the video was marked elsewhere, while
      // the modal was open. Say so rather than claim a change that did not happen.
      if (response.data.updated === 0) {
        showSnackbar('Not marked: this video is no longer missing.', 'error');
        return;
      }
      setLocalVideo((prev) => ({
        ...prev,
        status: 'deleted',
        removal: { reason: 'marked_deleted', at: new Date().toISOString(), detail: null },
      }));
      onMarkedDeleted?.(localVideo.youtubeId);
      showSnackbar('Marked as deleted', 'success');
    } catch (err: unknown) {
      showSnackbar(extractErrorMessage(err, 'Failed to mark the video as deleted'), 'error');
    } finally {
      setMarkDeletedPending(false);
    }
  }, [localVideo.databaseId, localVideo.youtubeId, token, showSnackbar, onMarkedDeleted]);

  const handleDownloadConfirm = useCallback(async (settings: DownloadSettings | null) => {
    setDownloadDialogOpen(false);
    if (snapshot.videos[localVideo.youtubeId]?.state) {
      showSnackbar('This video is already queued or downloading', 'error');
      return;
    }

    const url = `https://www.youtube.com/watch?v=${localVideo.youtubeId}`;
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

    const success = await triggerDownloads({
      urls: [url],
      overrideSettings,
      channelId: localVideo.channelId,
    });

    if (success === null) return;
    if (success) {
      onDownloadQueued?.(localVideo.youtubeId);
      onClose();
      navigate('/downloads/activity');
    } else {
      showSnackbar('Failed to queue download', 'error');
    }
  }, [localVideo.youtubeId, localVideo.channelId, triggerDownloads, showSnackbar, onDownloadQueued, onClose, navigate, snapshot]);

  const handleRatingApply = useCallback(async (rating: string | null) => {
    if (!localVideo.databaseId) {
      showSnackbar('Cannot update rating: video not in database', 'error');
      return;
    }

    try {
      await axios.post(
        '/api/videos/rating',
        {
          videoIds: [localVideo.databaseId],
          rating,
        },
        { headers: { 'x-access-token': token || '' } }
      );

      setLocalVideo((prev) => ({
        ...prev,
        normalizedRating: rating,
      }));
      showSnackbar('Rating updated', 'success');
      onRatingChanged?.(localVideo.youtubeId, rating);
    } catch (err: unknown) {
      showSnackbar(extractErrorMessage(err, 'Failed to update rating'), 'error');
    }
  }, [localVideo.databaseId, localVideo.youtubeId, token, showSnackbar, onRatingChanged]);

  return {
    localVideo: activity ? { ...localVideo, status: activity } : localVideo,
    snackbar,
    deleteDialogOpen,
    downloadDialogOpen,
    ratingDialogOpen,
    protectionLoading: protection.loading,
    markDeletedPending,
    setDeleteDialogOpen,
    setDownloadDialogOpen,
    setRatingDialogOpen,
    handleProtectionToggle,
    handleDeleteConfirm,
    handleIgnoreToggle,
    handleMarkDeleted,
    handleDownloadConfirm,
    handleRatingApply,
    handleSnackbarClose,
  };
}
