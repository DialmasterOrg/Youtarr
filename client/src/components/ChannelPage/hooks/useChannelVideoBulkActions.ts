import { useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toDownloadOverrideSettings } from '../../../utils/downloadOverrideSettings';
import { describeRequestError } from '../../../utils/requestError';
import { youtubeVideoUrl } from '../../../utils/youtubeUrls';
import { ChannelVideo } from '../../../types/ChannelVideo';
import { DownloadSettings } from '../../DownloadManager/ManualDownload/types';
import { useVideoActivity } from '../../../providers/VideoActivityProvider';
import { useTriggerDownloads } from '../../../hooks/useTriggerDownloads';
import { useVideoDeletion } from '../../shared/useVideoDeletion';
import { ChannelVideoSelection } from './useChannelVideoSelection';

const pluralS = (count: number): string => (count !== 1 ? 's' : '');

interface UseChannelVideoBulkActionsParams {
  channelId: string | undefined;
  token: string | null;
  // The rows on screen, with local changes applied.
  videos: ChannelVideo[];
  selection: Pick<
    ChannelVideoSelection,
    'checkedBoxes' | 'selectedForDeletion' | 'clearChecked' | 'clearDeletion' | 'removeFromDeletion'
  >;
  setIgnored: (ignoredById: Record<string, boolean>) => void;
  refetchVideos: () => Promise<void>;
  refetchTabStats: () => Promise<void>;
  notify: (message: string, severity?: 'success' | 'error') => void;
}

interface UseChannelVideoBulkActionsResult {
  downloadDialogOpen: boolean;
  openDownloadDialog: () => void;
  closeDownloadDialog: () => void;
  confirmDownload: (settings: DownloadSettings | null) => Promise<void>;
  deleteDialogOpen: boolean;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  deleteLoading: boolean;
  ignoreSelected: () => Promise<void>;
}

// The actions on the selected videos: download, delete and ignore.
export function useChannelVideoBulkActions({
  channelId,
  token,
  videos,
  selection,
  setIgnored,
  refetchVideos,
  refetchTabStats,
  notify,
}: UseChannelVideoBulkActionsParams): UseChannelVideoBulkActionsResult {
  const { checkedBoxes, selectedForDeletion, clearChecked, clearDeletion, removeFromDeletion } = selection;
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { snapshot } = useVideoActivity();
  const { triggerDownloads } = useTriggerDownloads(token);
  const { deleteVideosByYoutubeIds, loading: deleteLoading } = useVideoDeletion();

  const openDownloadDialog = useCallback(() => setDownloadDialogOpen(true), []);
  const closeDownloadDialog = useCallback(() => setDownloadDialogOpen(false), []);
  const cancelDelete = useCallback(() => setDeleteDialogOpen(false), []);

  const confirmDownload = async (settings: DownloadSettings | null) => {
    setDownloadDialogOpen(false);
    const eligibleIds = checkedBoxes.filter((id) => !snapshot.videos[id]?.state);
    if (!eligibleIds.length) return;
    const urls = eligibleIds.map(youtubeVideoUrl);
    const result = await triggerDownloads({
      urls,
      overrideSettings: toDownloadOverrideSettings(settings),
      channelId,
    });
    if (!result) return;
    if (!result.ok) {
      notify(result.message, 'error');
      return;
    }
    clearChecked();
    navigate('/downloads/activity');
  };

  const requestDelete = () => {
    if (selectedForDeletion.length === 0) {
      notify('No videos selected for deletion', 'error');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteDialogOpen(false);
    const result = await deleteVideosByYoutubeIds(selectedForDeletion, token);
    const deletedCount = result.deleted.length;
    if (result.success) {
      notify(`Successfully deleted ${deletedCount} video${pluralS(deletedCount)}`);
      clearDeletion();
      await refetchVideos();
      return;
    }
    if (deletedCount === 0) {
      notify(`Failed to delete videos: ${result.failed[0]?.error || 'Unknown error'}`, 'error');
      return;
    }
    notify(`Deleted ${deletedCount} video${pluralS(deletedCount)}, but ${result.failed.length} failed`);
    removeFromDeletion(result.deleted);
    await refetchVideos();
  };

  // The rows change at once and go back if the request fails.
  const ignoreSelected = async () => {
    if (!channelId || !token || checkedBoxes.length === 0) {
      notify('No videos selected to ignore', 'error');
      return;
    }
    const previouslyIgnored: Record<string, boolean> = {};
    const nowIgnored: Record<string, boolean> = {};
    checkedBoxes.forEach((youtubeId) => {
      previouslyIgnored[youtubeId] = videos.find((v) => v.youtube_id === youtubeId)?.ignored ?? false;
      nowIgnored[youtubeId] = true;
    });
    setIgnored(nowIgnored);
    try {
      const response = await axios.post<{ message?: string }>(
        `/api/channels/${channelId}/videos/bulk-ignore`,
        { youtubeIds: checkedBoxes },
        { headers: { 'x-access-token': token } }
      );
      notify(response.data.message || `Successfully ignored ${checkedBoxes.length} videos`);
      clearChecked();
      void refetchTabStats();
    } catch (error: unknown) {
      setIgnored(previouslyIgnored);
      console.error('Error bulk ignoring:', describeRequestError(error));
      notify('Failed to bulk ignore videos', 'error');
    }
  };

  return {
    downloadDialogOpen,
    openDownloadDialog,
    closeDownloadDialog,
    confirmDownload,
    deleteDialogOpen,
    requestDelete,
    cancelDelete,
    confirmDelete,
    deleteLoading,
    ignoreSelected,
  };
}
