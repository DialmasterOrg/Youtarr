import { useState, useCallback, useEffect, useMemo, useRef, SyntheticEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useConfig } from '../../../hooks/useConfig';
import { useDownloadListingsRefresh } from '../../../hooks/useDownloadListingsRefresh';
import { useVideoActivity } from '../../../providers/VideoActivityProvider';
import { ChannelTabType } from '../../../types/Channel';
import { useChannelListingActions } from './useChannelListingActions';
import { useChannelTabStats } from './useChannelTabStats';
import { useChannelTabs } from './useChannelTabs';
import { useChannelVideoBulkActions } from './useChannelVideoBulkActions';
import { useChannelVideoOverrides } from './useChannelVideoOverrides';
import { useChannelVideoQuery } from './useChannelVideoQuery';
import { useChannelVideoRowActions } from './useChannelVideoRowActions';
import { useChannelVideoSelection } from './useChannelVideoSelection';
import { useChannelVideos } from './useChannelVideos';
import { useInfiniteScrollTrigger } from '../../../hooks/useInfiniteScrollTrigger';
import { useNewVideosNotice } from './useNewVideosNotice';

interface UseChannelVideosControllerParams {
  token: string | null;
  // Overrides the channel in the route.
  channelId?: string;
  channelVideoQuality?: string | null;
  channelAudioFormat?: string | null;
  channelAvailableTabs?: string | null;
  onVideosLoaded?: (channelId: string) => void;
  // The debounced search text.
  search: string;
}

// Wires together the hooks behind the channel video list: which tab and
// query it shows, the rows, the selection and the actions on them.
export function useChannelVideosController({
  token,
  channelId: propChannelId,
  channelVideoQuality,
  channelAudioFormat,
  channelAvailableTabs,
  onVideosLoaded,
  search,
}: UseChannelVideosControllerParams) {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const notify = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    if (severity === 'error') {
      setErrorMessage(message);
    } else {
      setSuccessMessage(message);
    }
  }, []);

  const { channel_id: routeChannelId } = useParams();
  const channelId = propChannelId ?? routeChannelId ?? undefined;

  const { config } = useConfig(token);
  const useInfiniteScroll = config.channelVideosHotLoad ?? false;

  const { availableTabs, selectedTab, setSelectedTab, setAvailableTabs } = useChannelTabs({
    channelId,
    token,
    channelAvailableTabs,
  });

  const query = useChannelVideoQuery({ channelId, selectedTab, search, useInfiniteScroll });
  const { page, setPage, effectivePageSize, filters, resetKey } = query;

  const {
    videos,
    totalCount,
    oldestVideoDate,
    error: fetchError,
    availableTabs: listedTabs,
    loading,
    refreshSeq,
    awaitedListingFinishedAt,
    topLoadSeq,
    loadedView,
    refetch: refetchVideos,
  } = useChannelVideos({
    channelId,
    token,
    tabType: selectedTab,
    page,
    pageSize: effectivePageSize,
    searchQuery: search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    append: useInfiniteScroll,
    resetKey,
    onFirstLoad: onVideosLoaded,
    ...filters,
  });

  useDownloadListingsRefresh(refetchVideos);

  const { data: tabStats, refetch: refetchTabStats } = useChannelTabStats(channelId, token);
  useDownloadListingsRefresh(refetchTabStats);

  // A change in the listing size (an automatic or background fetch, Load More,
  // tabs detected for an imported channel) changes the loaded and ignored
  // counts, and can make a first count possible. The tab is part of the
  // comparison because a newly listed tab can hold as many videos as the
  // tab it was opened from.
  const listingKey = `${loadedView}:${totalCount}`;
  const previousListingKey = useRef(listingKey);
  useEffect(() => {
    if (previousListingKey.current === listingKey) return;
    previousListingKey.current = listingKey;
    void refetchTabStats();
  }, [listingKey, refetchTabStats]);

  useEffect(() => {
    if (listedTabs && listedTabs.length > 0) {
      setAvailableTabs(listedTabs);
    }
  }, [listedTabs, setAvailableTabs]);

  const overrides = useChannelVideoOverrides({
    videos,
    resetKey,
    page,
    appendsPages: useInfiniteScroll,
  });

  const { snapshot } = useVideoActivity();
  const displayedVideos = useMemo(
    () =>
      overrides.videos.map((video) => ({
        ...video,
        activity: snapshot.videos[video.youtube_id]?.state,
      })),
    [overrides.videos, snapshot]
  );

  const selection = useChannelVideoSelection({ videos: displayedVideos, filters, search });

  const rowActions = useChannelVideoRowActions({
    channelId,
    token,
    videos: displayedVideos,
    setIgnored: overrides.setIgnored,
    setProtected: overrides.setProtected,
    refetchTabStats,
    notify,
  });

  const bulkActions = useChannelVideoBulkActions({
    channelId,
    token,
    videos: displayedVideos,
    selection,
    setIgnored: overrides.setIgnored,
    refetchVideos,
    refetchTabStats,
    notify,
  });

  const listing = useChannelListingActions({
    channelId,
    token,
    selectedTab,
    page,
    pageSize: effectivePageSize,
    downloadedFilter: filters.downloadedFilter,
    refetchVideos,
    refetchTabStats,
  });

  const newVideosNotice = useNewVideosNotice({
    channelId,
    selectedTab,
    refreshSeq,
    awaitedListingFinishedAt,
    topLoadSeq,
    resetKey,
    videos,
    page,
    setPage,
    refetchVideos,
    trackRefresh: listing.trackRefresh,
    onFetchComplete: listing.onFetchComplete,
    onVideosLoaded,
  });

  const totalPages = Math.ceil(totalCount / effectivePageSize) || 1;
  const hasNextPage = page < totalPages;
  // A failed load leaves the page number on the page that failed, and loading
  // the one after it would skip its rows. Scrolling loads nothing more until
  // a retry reloads every page so far.
  const loadMoreRef = useInfiniteScrollTrigger({
    enabled: useInfiniteScroll && !fetchError,
    loading,
    hasNextPage,
    onLoadNextPage: () => setPage((prev) => prev + 1),
  });

  const changeTab = (_event: SyntheticEvent, newTab: string | number) => {
    if (loading) return;
    setSelectedTab(String(newTab));
    query.resetForTabChange();
    selection.clearAll();
  };

  return {
    channelId,
    useInfiniteScroll,
    availableTabs,
    selectedTab,
    changeTab,
    query,
    // The loaded rows as the server sent them, and as the list shows them:
    // with local changes and download activity.
    videos,
    displayedVideos,
    totalCount,
    totalPages,
    hasNextPage,
    oldestVideoDate,
    loading,
    fetchError,
    refetchVideos,
    tabStats,
    selectedTabStats: selectedTab ? tabStats?.[selectedTab as ChannelTabType] : undefined,
    overrides,
    selection,
    rowActions,
    bulkActions,
    listing,
    newVideosNotice,
    loadMoreRef,
    downloadDefaults: {
      defaultResolution: channelVideoQuality || config.preferredResolution || '1080',
      defaultResolutionSource: channelVideoQuality ? ('channel' as const) : ('global' as const),
      defaultAudioFormat: channelAudioFormat || null,
      defaultAudioFormatSource: channelAudioFormat ? ('channel' as const) : ('global' as const),
      defaultProtect: config.protectManualDownloads,
    },
    successMessage,
    errorMessage,
    clearSuccessMessage: () => setSuccessMessage(null),
    clearErrorMessage: () => setErrorMessage(null),
  };
}
