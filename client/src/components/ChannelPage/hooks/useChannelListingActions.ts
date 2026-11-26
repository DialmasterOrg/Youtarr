import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChipFilterMode } from '../../shared/VideoList';
import { useRefreshChannelVideos } from './useRefreshChannelVideos';
import { useChannelFetchStatus, FetchCompletion, FetchProgress } from './useChannelFetchStatus';

interface UseChannelListingActionsParams {
  channelId: string | undefined;
  token: string | null;
  selectedTab: string | null;
  page: number;
  pageSize: number;
  downloadedFilter: ChipFilterMode;
  refetchVideos: () => Promise<void>;
  refetchTabStats: () => Promise<void>;
}

interface UseChannelListingActionsResult {
  loadMoreConfirmOpen: boolean;
  requestLoadMore: () => void;
  cancelLoadMore: () => void;
  confirmLoadMore: () => Promise<void>;
  loadMoreError: string | null;
  clearLoadMoreError: () => void;
  downloadAllOpen: boolean;
  openDownloadAll: () => void;
  closeDownloadAll: () => void;
  onDownloadAllStarted: () => void;
  // Loads the tab's full listing from YouTube, for Download All.
  runMetadataFetch: ReturnType<typeof useRefreshChannelVideos>['refreshVideos'];
  // Any fetch of the tab is running; it blocks Load More and Download All.
  isFetching: boolean;
  // A Load More fetch is running. A background refresh takes a second or
  // two, so it does not show as loading.
  showLoadMoreProgress: boolean;
  fetchProgress: FetchProgress | null;
  onFetchComplete: (callback: (completion: FetchCompletion) => void) => void;
  trackRefresh: () => void;
}

// Load More and Download All: the two header actions that list the tab's
// videos from YouTube, and the status of that listing.
export function useChannelListingActions({
  channelId,
  token,
  selectedTab,
  page,
  pageSize,
  downloadedFilter,
  refetchVideos,
  refetchTabStats,
}: UseChannelListingActionsParams): UseChannelListingActionsResult {
  const [loadMoreConfirmOpen, setLoadMoreConfirmOpen] = useState(false);
  const [downloadAllOpen, setDownloadAllOpen] = useState(false);
  const navigate = useNavigate();

  const {
    refreshVideos,
    loading: loadMoreRunning,
    error: loadMoreError,
    clearError: clearLoadMoreError,
  } = useRefreshChannelVideos(channelId, page, pageSize, downloadedFilter, selectedTab, token);

  const {
    isFetching: serverFetching,
    fetchType,
    progress: fetchProgress,
    onFetchComplete,
    startPolling,
    trackRefresh,
  } = useChannelFetchStatus(channelId, selectedTab, token);

  const requestLoadMore = useCallback(() => setLoadMoreConfirmOpen(true), []);
  const cancelLoadMore = useCallback(() => setLoadMoreConfirmOpen(false), []);
  const closeDownloadAll = useCallback(() => setDownloadAllOpen(false), []);

  // Load More can outlive the channel or tab it started on. Its refetches come
  // from that render, so running them after a switch would load the old view's
  // list or stats over the current one.
  const currentViewRef = useRef({ channelId, selectedTab });
  currentViewRef.current = { channelId, selectedTab };

  const confirmLoadMore = async () => {
    setLoadMoreConfirmOpen(false);
    startPolling();
    await refreshVideos();
    const view = currentViewRef.current;
    if (view.channelId !== channelId) return;
    if (view.selectedTab === selectedTab) await refetchVideos();
    await refetchTabStats();
  };

  const openDownloadAll = useCallback(() => {
    // Start fetch-status polling so the header progress bar tracks the
    // metadata fetch the dialog kicks off, and the list refetches when done.
    startPolling();
    setDownloadAllOpen(true);
  }, [startPolling]);

  const onDownloadAllStarted = useCallback(() => {
    setDownloadAllOpen(false);
    navigate('/downloads/activity');
  }, [navigate]);

  return {
    loadMoreConfirmOpen,
    requestLoadMore,
    cancelLoadMore,
    confirmLoadMore,
    loadMoreError,
    clearLoadMoreError,
    downloadAllOpen,
    openDownloadAll,
    closeDownloadAll,
    onDownloadAllStarted,
    runMetadataFetch: refreshVideos,
    isFetching: loadMoreRunning || serverFetching,
    showLoadMoreProgress: loadMoreRunning || (serverFetching && fetchType === 'fetchAll'),
    fetchProgress,
    onFetchComplete,
    trackRefresh,
  };
}
