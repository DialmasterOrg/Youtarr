import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Grid,
  Skeleton,
  Tabs,
  Tab,
  Button,
  FormControlLabel,
  Switch,
  LinearProgress,
  Tooltip,
  Chip,
} from '../ui';
import {
  Download as DownloadIcon,
  Trash2 as DeleteIcon,
  Ban as BlockIcon,
  RefreshCw as RefreshIcon,
  Info as InfoIcon,
} from '../../lib/icons';

import useMediaQuery from '../../hooks/useMediaQuery';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';
import { useVideoDeletion } from '../shared/useVideoDeletion';
import { useVideoProtection } from '../shared/useVideoProtection';
import { getVideoStatus } from '../../utils/videoStatus';
import VideoCard from './VideoCard';
import VideoListItem from './VideoListItem';
import VideoTableView from './VideoTableView';
import ChannelVideosDialogs from './ChannelVideosDialogs';
import { useChannelVideos } from './hooks/useChannelVideos';
import { useRefreshChannelVideos } from './hooks/useRefreshChannelVideos';
import { useChannelFetchStatus } from './hooks/useChannelFetchStatus';
import { useChannelVideoFilters } from './hooks/useChannelVideoFilters';
import { useConfig } from '../../hooks/useConfig';
import { useTriggerDownloads } from '../../hooks/useTriggerDownloads';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';
import { ChannelVideo } from '../../types/ChannelVideo';
import {
  VideoListContainer,
  VideoListPaginationBar,
  useListPageSize,
  useVideoListState,
  useVideoSelection,
  type FilterConfig,
  type PageSize,
  type SelectionAction,
  type VideoListViewMode,
} from '../shared/VideoList';
import { intentStyles } from '../../utils/intentStyles';

interface ChannelVideosProps {
  token: string | null;
  channelAutoDownloadTabs?: string;
  channelId?: string;
  channelName?: string;
  channelVideoQuality?: string | null;
  channelAudioFormat?: string | null;
  channelAvailableTabs?: string | null;
}

type SortBy = 'date' | 'title' | 'duration' | 'size';
type SortOrder = 'asc' | 'desc';

const VIEW_MODE_STORAGE_KEY = 'youtarr:channelVideosViewMode';

function channelVideoToModalData(
  video: ChannelVideo,
  channelName: string,
  channelId: string | undefined
): VideoModalData {
  const status = getVideoStatus(video);
  return {
    youtubeId: video.youtube_id,
    title: video.title,
    channelName,
    thumbnailUrl: video.thumbnail,
    duration: video.duration,
    publishedAt: video.publishedAt || null,
    addedAt: null,
    mediaType: video.media_type || 'video',
    status,
    isDownloaded: video.added && !video.removed,
    filePath: video.filePath || null,
    fileSize: video.fileSize || null,
    audioFilePath: video.audioFilePath || null,
    audioFileSize: video.audioFileSize || null,
    isProtected: video.protected || false,
    isIgnored: video.ignored || false,
    normalizedRating: video.normalized_rating || null,
    ratingSource: video.rating_source || null,
    databaseId: video.id || null,
    channelId: channelId || null,
  };
}

function ChannelVideos({
  token,
  channelAutoDownloadTabs,
  channelId: propChannelId,
  channelName = '',
  channelVideoQuality,
  channelAudioFormat,
  channelAvailableTabs,
}: ChannelVideosProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const initialViewMode: VideoListViewMode = isMobile ? 'list' : 'table';

  const listState = useVideoListState({
    initialViewMode,
    viewModeStorageKey: VIEW_MODE_STORAGE_KEY,
  });

  // Legacy selection state: preserved so existing VideoCard/VideoListItem/VideoTableView
  // continue to receive the same props. We expose a synthesized selection object
  // to VideoListContainer based on whichever set is active.
  const [checkedBoxes, setCheckedBoxes] = useState<string[]>([]);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);

  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [maxRating, setMaxRating] = useState('');
  const [protectedFilter, setProtectedFilter] = useState(false);
  const [missingFilter, setMissingFilter] = useState(false);
  const [ignoredFilter, setIgnoredFilter] = useState(false);

  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [tabsLoading, setTabsLoading] = useState<boolean>(true);
  const [tabAutoDownloadStatus, setTabAutoDownloadStatus] = useState<Record<string, boolean>>({});

  const [pageSize, setPageSize] = useListPageSize('youtarr.channelVideos.pageSize');
  const [page, setPage] = useState(1);
  const [hideDownloaded, setHideDownloaded] = useState(false);
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const canTriggerNextRef = useRef<boolean>(true);

  const [modalVideo, setModalVideo] = useState<ChannelVideo | null>(null);
  const [localIgnoreStatus, setLocalIgnoreStatus] = useState<Record<string, boolean>>({});
  const [localProtectedStatus, setLocalProtectedStatus] = useState<Record<string, boolean>>({});

  const {
    filters,
    inputMinDuration,
    inputMaxDuration,
    setMinDuration,
    setMaxDuration,
    setDateFrom,
    setDateTo,
    clearAllFilters: clearBaseFilters,
  } = useChannelVideoFilters();

  const { deleteVideosByYoutubeIds, loading: deleteLoading } = useVideoDeletion();
  const {
    toggleProtection,
    successMessage: protectionSuccess,
    error: protectionError,
    clearMessages: clearProtectionMessages,
  } = useVideoProtection(token);

  const { channel_id: routeChannelId } = useParams();
  const channelId = propChannelId ?? routeChannelId ?? undefined;

  useEffect(() => {
    const fetchAvailableTabs = async () => {
      if (!channelId || !token) return;
      setTabsLoading(true);
      try {
        const response = await fetch(`/api/channels/${channelId}/tabs`, {
          headers: { 'x-access-token': token },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.availableTabs && data.availableTabs.length > 0) {
            setAvailableTabs(data.availableTabs);
            const defaultTab = data.availableTabs.includes('videos') ? 'videos' : data.availableTabs[0];
            setSelectedTab(defaultTab);
          } else {
            setAvailableTabs(['videos']);
            setSelectedTab('videos');
          }
          setTabsLoading(false);
        } else {
          setAvailableTabs(['videos']);
          setSelectedTab('videos');
          setTabsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching available tabs:', err);
        setAvailableTabs(['videos']);
        setSelectedTab('videos');
        setTabsLoading(false);
      }
    };
    fetchAvailableTabs();
  }, [channelId, token]);

  useEffect(() => {
    if (!channelId || !token || !tabsLoading) return;
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/channels/${channelId}/tabs`, {
          headers: { 'x-access-token': token },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.availableTabs && data.availableTabs.length > 0) {
            setAvailableTabs(data.availableTabs);
            const defaultTab = data.availableTabs.includes('videos') ? 'videos' : data.availableTabs[0];
            setSelectedTab(defaultTab);
          } else {
            setAvailableTabs(['videos']);
            setSelectedTab('videos');
          }
          setTabsLoading(false);
          clearInterval(pollInterval);
        }
      } catch {
        /* retry silently */
      }
    }, 2000);
    return () => clearInterval(pollInterval);
  }, [channelId, token, tabsLoading]);

  useEffect(() => {
    if (!channelAutoDownloadTabs) {
      setTabAutoDownloadStatus({});
      return;
    }
    const mediaTypeMap: Record<string, string> = {
      videos: 'video',
      shorts: 'short',
      streams: 'livestream',
    };
    const enabledTabs = channelAutoDownloadTabs.split(',').map((t) => t.trim());
    setTabAutoDownloadStatus((prevStatus) => {
      const newStatus: Record<string, boolean> = { ...prevStatus };
      availableTabs.forEach((tabType) => {
        if (!(tabType in newStatus)) {
          const mediaType = mediaTypeMap[tabType];
          newStatus[tabType] = mediaType ? enabledTabs.includes(mediaType) : false;
        }
      });
      return newStatus;
    });
  }, [channelAutoDownloadTabs, availableTabs]);

  const { config } = useConfig(token);
  const hasChannelOverride = Boolean(channelVideoQuality);
  const defaultResolution = channelVideoQuality || config.preferredResolution || '1080';
  const defaultResolutionSource: 'channel' | 'global' = hasChannelOverride ? 'channel' : 'global';
  const useInfiniteScroll = config.channelVideosHotLoad ?? false;

  const resetKey = useMemo(
    () =>
      [
        channelId || '',
        selectedTab || '',
        hideDownloaded,
        listState.search,
        sortBy,
        sortOrder,
        maxRating,
        filters.minDuration,
        filters.maxDuration,
        filters.dateFrom ? filters.dateFrom.toISOString() : '',
        filters.dateTo ? filters.dateTo.toISOString() : '',
        protectedFilter,
        missingFilter,
        ignoredFilter,
        useInfiniteScroll,
      ].join('|'),
    [
      channelId,
      selectedTab,
      hideDownloaded,
      listState.search,
      sortBy,
      sortOrder,
      maxRating,
      filters.minDuration,
      filters.maxDuration,
      filters.dateFrom,
      filters.dateTo,
      protectedFilter,
      missingFilter,
      ignoredFilter,
      useInfiniteScroll,
    ]
  );

  const {
    videos,
    totalCount,
    oldestVideoDate,
    videoFailed,
    availableTabs: availableTabsFromVideos,
    loading: videosLoading,
    refetch: refetchVideos,
  } = useChannelVideos({
    channelId,
    page,
    pageSize,
    hideDownloaded,
    searchQuery: listState.search,
    sortBy,
    sortOrder,
    maxRating,
    tabType: selectedTab,
    token,
    minDuration: filters.minDuration,
    maxDuration: filters.maxDuration,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    append: useInfiniteScroll,
    resetKey,
    protectedFilter,
    missingFilter,
    ignoredFilter,
  });

  useEffect(() => {
    if (availableTabsFromVideos && availableTabsFromVideos.length > 0) {
      setAvailableTabs(availableTabsFromVideos);
    }
  }, [availableTabsFromVideos]);

  useEffect(() => {
    if (channelAvailableTabs === undefined) return;
    const nextTabs = channelAvailableTabs
      ? channelAvailableTabs.split(',').map((tab) => tab.trim()).filter((tab) => tab.length > 0)
      : [];
    if (nextTabs.length === 0) return;
    setAvailableTabs(nextTabs);
    setSelectedTab((current) => {
      if (current && nextTabs.includes(current)) return current;
      return nextTabs.includes('videos') ? 'videos' : nextTabs[0];
    });
  }, [channelAvailableTabs]);

  useEffect(() => {
    setLocalIgnoreStatus({});
    setLocalProtectedStatus({});
  }, [page, selectedTab, hideDownloaded, listState.search, sortBy, sortOrder, filters]);

  useEffect(() => {
    setPage(1);
  }, [
    filters.minDuration,
    filters.maxDuration,
    filters.dateFrom,
    filters.dateTo,
    listState.search,
    maxRating,
    protectedFilter,
    missingFilter,
    ignoredFilter,
    hideDownloaded,
    sortBy,
    sortOrder,
    selectedTab,
  ]);

  useEffect(() => {
    setPage(1);
  }, [useInfiniteScroll]);

  const hasChannelAudioOverride = Boolean(channelAudioFormat);
  const defaultAudioFormat = channelAudioFormat || null;
  const defaultAudioFormatSource: 'channel' | 'global' = hasChannelAudioOverride ? 'channel' : 'global';

  const { triggerDownloads } = useTriggerDownloads(token);

  const {
    refreshVideos,
    loading: localFetchingAllVideos,
    error: fetchAllError,
    clearError: clearFetchAllError,
  } = useRefreshChannelVideos(channelId, page, pageSize, hideDownloaded, selectedTab, token);

  const {
    isFetching: backgroundFetching,
    onFetchComplete,
    startPolling,
  } = useChannelFetchStatus(channelId, selectedTab, token);

  const fetchingAllVideos = localFetchingAllVideos || backgroundFetching;

  useEffect(() => {
    onFetchComplete(() => {
      refetchVideos();
    });
  }, [onFetchComplete, refetchVideos]);

  const navigate = useNavigate();

  const videosWithOverrides = useMemo(() => {
    return videos.map((video) => {
      const hasIgnoreOverride = video.youtube_id in localIgnoreStatus;
      const hasProtectedOverride = video.youtube_id in localProtectedStatus;
      if (!hasIgnoreOverride && !hasProtectedOverride) return video;
      return {
        ...video,
        ...(hasIgnoreOverride
          ? {
              ignored: localIgnoreStatus[video.youtube_id],
              ignored_at: localIgnoreStatus[video.youtube_id] ? new Date().toISOString() : null,
            }
          : {}),
        ...(hasProtectedOverride
          ? { protected: localProtectedStatus[video.youtube_id] }
          : {}),
      };
    });
  }, [videos, localIgnoreStatus, localProtectedStatus]);

  const paginatedVideos = videosWithOverrides;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const hasNextPage = page < totalPages;

  const selectionMode: 'download' | 'delete' | null =
    checkedBoxes.length > 0 ? 'download' : selectedForDeletion.length > 0 ? 'delete' : null;

  const handleCheckChange = useCallback((videoId: string, isChecked: boolean) => {
    setCheckedBoxes((prev) => (isChecked ? [...prev, videoId] : prev.filter((id) => id !== videoId)));
  }, []);

  const handleDeletionChange = useCallback((videoId: string, isChecked: boolean) => {
    setSelectedForDeletion((prev) => (isChecked ? [...prev, videoId] : prev.filter((id) => id !== videoId)));
  }, []);

  const clearAllSelections = useCallback(() => {
    setCheckedBoxes([]);
    setSelectedForDeletion([]);
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectionMode === 'delete') {
      const deletable = paginatedVideos
        .filter((video) => video.added && !video.removed)
        .map((video) => video.youtube_id);
      setSelectedForDeletion((prev) => {
        const newIds = deletable.filter((id) => !prev.includes(id));
        return [...prev, ...newIds];
      });
      return;
    }
    const downloadable = paginatedVideos
      .filter((video) => {
        const status = getVideoStatus(video);
        return status === 'never_downloaded' || status === 'missing' || status === 'ignored';
      })
      .map((video) => video.youtube_id);
    setCheckedBoxes((prev) => {
      const newIds = downloadable.filter((id) => !prev.includes(id));
      return [...prev, ...newIds];
    });
  }, [paginatedVideos, selectionMode]);

  const handleSelectAllDownloaded = useCallback(() => {
    const ids = paginatedVideos
      .filter((video) => video.added && !video.removed)
      .map((video) => video.youtube_id);
    setSelectedForDeletion((prev) => {
      const newIds = ids.filter((id) => !prev.includes(id));
      return [...prev, ...newIds];
    });
  }, [paginatedVideos]);

  const handleSelectAllNotDownloaded = useCallback(() => {
    const ids = paginatedVideos
      .filter((video) => {
        const status = getVideoStatus(video);
        return status === 'never_downloaded' || status === 'missing' || status === 'ignored';
      })
      .map((video) => video.youtube_id);
    setCheckedBoxes((prev) => {
      const newIds = ids.filter((id) => !prev.includes(id));
      return [...prev, ...newIds];
    });
  }, [paginatedVideos]);

  const handleDownloadClick = useCallback(() => {
    setDownloadDialogOpen(true);
  }, []);

  const handleDownloadConfirm = async (settings: DownloadSettings | null) => {
    setDownloadDialogOpen(false);
    const urls = checkedBoxes.map((id) => `https://www.youtube.com/watch?v=${id}`);
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
    await triggerDownloads({ urls, overrideSettings, channelId });
    setCheckedBoxes([]);
    navigate('/downloads/activity');
  };

  const handleRefreshClick = () => setRefreshConfirmOpen(true);

  const handleRefreshConfirm = async () => {
    setRefreshConfirmOpen(false);
    startPolling();
    await refreshVideos();
    await refetchVideos();
  };

  const handleRefreshCancel = () => setRefreshConfirmOpen(false);

  useEffect(() => {
    if (protectionSuccess) {
      setSuccessMessage(protectionSuccess);
      clearProtectionMessages();
    }
  }, [protectionSuccess, clearProtectionMessages]);

  useEffect(() => {
    if (protectionError) {
      setErrorMessage(protectionError);
      clearProtectionMessages();
    }
  }, [protectionError, clearProtectionMessages]);

  const handleToggleProtection = async (youtubeId: string) => {
    const video = paginatedVideos.find((v) => v.youtube_id === youtubeId);
    if (!video || !video.id) return;
    const currentState = video.protected || false;
    const newState = await toggleProtection(video.id, currentState);
    if (newState !== undefined) {
      setLocalProtectedStatus((prev) => ({ ...prev, [youtubeId]: newState }));
    }
  };

  const handleDeleteClick = () => {
    if (selectedForDeletion.length === 0) {
      setErrorMessage('No videos selected for deletion');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);
    const result = await deleteVideosByYoutubeIds(selectedForDeletion, token);
    if (result.success) {
      setSuccessMessage(
        `Successfully deleted ${result.deleted.length} video${result.deleted.length !== 1 ? 's' : ''}`
      );
      setSelectedForDeletion([]);
      await refetchVideos();
    } else {
      const deletedCount = result.deleted.length;
      const failedCount = result.failed.length;
      if (deletedCount > 0) {
        setSuccessMessage(
          `Deleted ${deletedCount} video${deletedCount !== 1 ? 's' : ''}, but ${failedCount} failed`
        );
        setSelectedForDeletion((prev) => prev.filter((id) => !result.deleted.includes(id)));
        await refetchVideos();
      } else {
        setErrorMessage(`Failed to delete videos: ${result.failed[0]?.error || 'Unknown error'}`);
      }
    }
  };

  const handleDeleteCancel = () => setDeleteDialogOpen(false);

  const toggleIgnore = async (youtubeId: string) => {
    if (!channelId || !token) return;
    const video = paginatedVideos.find((v) => v.youtube_id === youtubeId);
    const isCurrentlyIgnored = video?.ignored;
    const endpoint = isCurrentlyIgnored ? 'unignore' : 'ignore';
    const newIgnoreStatus = !isCurrentlyIgnored;
    const originalIgnoreStatus = isCurrentlyIgnored ?? false;

    setLocalIgnoreStatus((prev) => ({ ...prev, [youtubeId]: newIgnoreStatus }));
    try {
      const response = await fetch(
        `/api/channels/${channelId}/videos/${youtubeId}/${endpoint}`,
        { method: 'POST', headers: { 'x-access-token': token } }
      );
      if (!response.ok) throw new Error(`Failed to ${endpoint} video`);
      setSuccessMessage(
        isCurrentlyIgnored
          ? 'Video unignored. Channel downloads will include this video'
          : 'Video ignored. Channel downloads will exclude this video'
      );
    } catch (error) {
      setLocalIgnoreStatus((prev) => ({ ...prev, [youtubeId]: originalIgnoreStatus }));
      console.error('Error toggling ignore:', error);
      setErrorMessage(`Failed to ${endpoint} video`);
    }
  };

  const handleBulkIgnore = async () => {
    if (!channelId || !token || checkedBoxes.length === 0) {
      setErrorMessage('No videos selected to ignore');
      return;
    }
    const originalIgnoreStates: Record<string, boolean> = {};
    checkedBoxes.forEach((youtubeId) => {
      const video = paginatedVideos.find((v) => v.youtube_id === youtubeId);
      originalIgnoreStates[youtubeId] = video?.ignored ?? false;
    });
    const bulkIgnoreUpdates: Record<string, boolean> = {};
    checkedBoxes.forEach((youtubeId) => {
      bulkIgnoreUpdates[youtubeId] = true;
    });
    setLocalIgnoreStatus((prev) => ({ ...prev, ...bulkIgnoreUpdates }));
    try {
      const response = await fetch(`/api/channels/${channelId}/videos/bulk-ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-access-token': token },
        body: JSON.stringify({ youtubeIds: checkedBoxes }),
      });
      if (!response.ok) throw new Error('Failed to bulk ignore videos');
      const result = await response.json();
      setSuccessMessage(result.message || `Successfully ignored ${checkedBoxes.length} videos`);
      setCheckedBoxes([]);
    } catch (error) {
      setLocalIgnoreStatus((prev) => ({ ...prev, ...originalIgnoreStates }));
      console.error('Error bulk ignoring:', error);
      setErrorMessage('Failed to bulk ignore videos');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newTab: string | number) => {
    if (videosLoading) return;
    setSelectedTab(String(newTab));
    setPage(1);
    clearAllSelections();
    clearBaseFilters();
    setProtectedFilter(false);
    setMissingFilter(false);
    setIgnoredFilter(false);
  };

  const handleAutoDownloadChange = async (enabled: boolean) => {
    if (!channelId || !token || !selectedTab) return;
    const currentTab = selectedTab;
    try {
      const response = await fetch(
        `/api/channels/${channelId}/tabs/${currentTab}/auto-download`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-access-token': token },
          body: JSON.stringify({ enabled }),
        }
      );
      if (!response.ok) throw new Error('Failed to update auto download setting');
      setTabAutoDownloadStatus((prev) => ({ ...prev, [currentTab]: enabled }));
    } catch (error) {
      console.error('Error updating auto download setting:', error);
      setErrorMessage('Failed to update auto download setting');
    }
  };

  const handlePageChange = (value: number) => setPage(value);

  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  const handleSortChange = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const getMissingVideoCount = () => {
    return checkedBoxes.reduce((count, videoId) => {
      const video = videos.find((v) => v.youtube_id === videoId);
      if (video && video.added && video.removed) return count + 1;
      return count;
    }, 0);
  };

  const getTabLabel = (tabType: string) => {
    switch (tabType) {
      case 'videos':
        return 'Videos';
      case 'shorts':
        return 'Shorts';
      case 'streams':
        return 'Live';
      default:
        return tabType;
    }
  };

  const isTabAutoDownloadEnabled = (tabType: string): boolean => tabAutoDownloadStatus[tabType] || false;

  useEffect(() => {
    if (!loadMoreRef.current) return;
    if (videosLoading || !hasNextPage) return;
    if (!useInfiniteScroll) return;

    let didTrigger = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const now = Date.now();
        const viewportHeight =
          entry.rootBounds?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
        const sentinelBottom = entry.boundingClientRect.bottom;
        const nearBottom = viewportHeight === 0 || sentinelBottom >= viewportHeight - 120;

        if (!entry.isIntersecting) {
          canTriggerNextRef.current = true;
          return;
        }
        if (
          entry.isIntersecting &&
          nearBottom &&
          canTriggerNextRef.current &&
          !didTrigger &&
          now - lastTriggerTimeRef.current > 500
        ) {
          didTrigger = true;
          canTriggerNextRef.current = false;
          lastTriggerTimeRef.current = now;
          setPage((prev) => prev + 1);
        }
      },
      { root: null, rootMargin: '0px 0px 200px 0px', threshold: 0 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [videosLoading, hasNextPage, useInfiniteScroll, page]);

  // Assemble filter config
  const filterConfigs = useMemo<FilterConfig[]>(() => {
    const configs: FilterConfig[] = [
      {
        id: 'duration',
        min: filters.minDuration,
        max: filters.maxDuration,
        inputMin: inputMinDuration,
        inputMax: inputMaxDuration,
        onMinChange: setMinDuration,
        onMaxChange: setMaxDuration,
      },
      {
        id: 'dateRange',
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        onFromChange: setDateFrom,
        onToChange: setDateTo,
        hidden: selectedTab === 'shorts',
        hiddenReason: selectedTab === 'shorts' ? 'Shorts do not have date information' : undefined,
      },
      { id: 'maxRating', value: maxRating, onChange: setMaxRating },
      { id: 'protected', value: protectedFilter, onChange: setProtectedFilter },
      { id: 'missing', value: missingFilter, onChange: setMissingFilter },
      { id: 'ignored', value: ignoredFilter, onChange: setIgnoredFilter },
    ];
    return configs;
  }, [
    filters.minDuration,
    filters.maxDuration,
    filters.dateFrom,
    filters.dateTo,
    inputMinDuration,
    inputMaxDuration,
    setMinDuration,
    setMaxDuration,
    setDateFrom,
    setDateTo,
    maxRating,
    protectedFilter,
    missingFilter,
    ignoredFilter,
    selectedTab,
  ]);

  // Build selection actions per render. Memoizing here is a lie because the
  // closures capture handleBulkIgnore / handleDeleteClick, which are created
  // fresh each render; the useMemo cache would just hand back a stale closure.
  const downloadActions: SelectionAction<string>[] = [
    {
      id: 'download',
      label: 'Download',
      icon: <DownloadIcon size={14} />,
      intent: 'success',
      onClick: handleDownloadClick,
    },
    {
      id: 'ignore',
      label: 'Ignore',
      icon: <BlockIcon size={14} />,
      intent: 'warning',
      onClick: () => handleBulkIgnore(),
    },
  ];

  const deleteActions: SelectionAction<string>[] = [
    {
      id: 'delete',
      label: 'Delete',
      icon: <DeleteIcon size={14} />,
      intent: 'danger',
      disabled: () => deleteLoading,
      onClick: () => handleDeleteClick(),
    },
  ];

  const downloadSelection = useVideoSelection<string>({ actions: downloadActions });
  const deleteSelection = useVideoSelection<string>({ actions: deleteActions });

  // Sync external state arrays into the hook's selectedIds so the SelectionPill shows correct count.
  useEffect(() => {
    downloadSelection.set(checkedBoxes);
  }, [checkedBoxes]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    deleteSelection.set(selectedForDeletion);
  }, [selectedForDeletion]); // eslint-disable-line react-hooks/exhaustive-deps

  // When user clears via the pill, keep the external arrays in sync.
  const syncedDownloadSelection = useMemo(
    () => ({
      ...downloadSelection,
      clear: () => {
        setCheckedBoxes([]);
        setSelectedForDeletion([]);
        downloadSelection.clear();
      },
    }),
    [downloadSelection]
  );

  const syncedDeleteSelection = useMemo(
    () => ({
      ...deleteSelection,
      clear: () => {
        setCheckedBoxes([]);
        setSelectedForDeletion([]);
        deleteSelection.clear();
      },
    }),
    [deleteSelection]
  );

  const activeSelection =
    selectionMode === 'download'
      ? syncedDownloadSelection
      : selectionMode === 'delete'
      ? syncedDeleteSelection
      : undefined;

  const renderPaginationBar = (placement: 'top' | 'bottom') => (
    <VideoListPaginationBar
      placement={placement}
      hasContent={totalCount > 0}
      useInfiniteScroll={useInfiniteScroll}
      page={page}
      totalPages={totalPages}
      onPageChange={handlePageChange}
      pageSize={pageSize}
      onPageSizeChange={handlePageSizeChange}
      isMobile={isMobile}
    />
  );

  const paginationTopNode = renderPaginationBar('top');
  const paginationNode = renderPaginationBar('bottom');

  const infiniteSentinel = useInfiniteScroll ? (
    <>
      <div
        ref={loadMoreRef}
        style={{ height: 24, width: '100%', marginTop: 32, marginBottom: 32 }}
      />
      {videosLoading && videos.length > 0 && hasNextPage && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
          <div className="playful-loading-dots" aria-label="Loading more videos">
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
      {!hasNextPage && videos.length > 0 && (
        <Typography
          variant="caption"
          color="text.secondary"
          align="center"
          style={{ display: 'block', padding: '16px 0' }}
        >
          {"You're all caught up."}
        </Typography>
      )}
    </>
  ) : null;

  // Render loading skeleton for the content area
  const loadingSkeleton = (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Loading and fetching/indexing new videos for this channel tab...
      </Typography>
      <Grid container spacing={2} style={{ marginTop: 16 }}>
        {[...Array(pageSize)].map((_, index) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={`skeleton-${index}`}>
            <Skeleton variant="rectangular" height={200} />
            <Skeleton variant="text" style={{ marginTop: 8 }} />
            <Skeleton variant="text" width="60%" />
          </Grid>
        ))}
      </Grid>
    </div>
  );

  const renderTabLabel = (tabType: string) => {
    const label = getTabLabel(tabType);
    const isEnabled = isTabAutoDownloadEnabled(tabType);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Typography variant="caption" style={{ fontWeight: 700, color: 'inherit' }}>
          {label}
        </Typography>
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: isEnabled ? 'var(--success)' : 'rgba(0,0,0,0.08)',
            border: isEnabled ? '2px solid var(--success)' : '1px solid rgba(0,0,0,0.25)',
            transition: 'all 200ms ease',
            display: 'inline-block',
            boxShadow: isEnabled ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
          }}
          title={isEnabled ? 'Auto-download enabled' : 'Auto-download disabled'}
        />
      </div>
    );
  };

  const dateTooltipBase =
    'Publish dates come from yt-dlp and may be approximate when YouTube only provides relative times. Videos remain sorted to match YouTube.';
  const dateTooltipText =
    selectedTab === 'shorts'
      ? 'Shorts do not expose publish dates via yt-dlp, so dates are hidden. ' + dateTooltipBase
      : dateTooltipBase;

  const headerSlot = (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 16px 8px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}
        data-testid="channel-videos-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {totalCount > 0 && (
            <Chip
              label={totalCount + ' ' + (totalCount === 1 ? 'item' : 'items')}
              size="small"
              color="primary"
            />
          )}
          {oldestVideoDate && selectedTab !== 'shorts' && !isMobile && (
            <Typography variant="caption" color="text.secondary">
              Oldest: {new Date(oldestVideoDate).toLocaleDateString()}
            </Typography>
          )}
          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileTooltip(dateTooltipText)}
              style={{
                marginLeft: 4,
                padding: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--foreground)',
              }}
              aria-label="Date info"
            >
              <InfoIcon size={16} data-testid="InfoIcon" />
            </button>
          ) : (
            <Tooltip title={dateTooltipText} arrow placement="top">
              <button
                type="button"
                style={{
                  marginLeft: 4,
                  padding: 4,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'var(--foreground)',
                }}
                aria-label="Date info"
              >
                <InfoIcon size={16} data-testid="InfoIcon" />
              </button>
            </Tooltip>
          )}
        </div>
        <Button
          onClick={handleRefreshClick}
          variant="outlined"
          size="small"
          color="inherit"
          disabled={fetchingAllVideos}
          startIcon={<RefreshIcon size={16} />}
          className={intentStyles.base}
          data-testid="channel-refresh-button"
        >
          {fetchingAllVideos ? 'Loading...' : 'Load More'}
        </Button>
      </div>
      {fetchingAllVideos && <LinearProgress style={{ marginTop: 8 }} />}
    </div>
  );

  const toolbarExtras = (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <FormControlLabel
        control={
          <Switch
            checked={hideDownloaded}
            onChange={(e) => setHideDownloaded(e.target.checked)}
            size="small"
          />
        }
        label="Hide Downloaded"
      />
      <FormControlLabel
        control={
          <Switch
            checked={isTabAutoDownloadEnabled(selectedTab || 'videos')}
            onChange={(e) => handleAutoDownloadChange(e.target.checked)}
            size="small"
            aria-label="Enable Channel Downloads"
          />
        }
        label="Auto-download"
      />
    </div>
  );

  const tabsSlot =
    availableTabs.length > 0 ? (
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          padding: isMobile ? '0 10px' : '0 16px',
        }}
      >
        <Tabs
          value={selectedTab || 'videos'}
          onChange={handleTabChange}
          variant={isMobile ? 'fullWidth' : 'standard'}
          centered={!isMobile}
          aria-label="channel video tabs"
        >
          {availableTabs.map((tab) => (
            <Tab key={tab} label={renderTabLabel(tab)} value={tab} />
          ))}
        </Tabs>
      </div>
    ) : null;

  const renderContent = (mode: VideoListViewMode) => {
    if (mode === 'grid') {
      return (
        <Grid container spacing={2}>
          {paginatedVideos.map((video) => (
            <VideoCard
              key={video.youtube_id}
              video={video}
              isMobile={isMobile}
              checkedBoxes={checkedBoxes}
              hoveredVideo={hoveredVideo}
              selectedForDeletion={selectedForDeletion}
              selectionMode={selectionMode}
              onCheckChange={handleCheckChange}
              onHoverChange={setHoveredVideo}
              onDeletionChange={handleDeletionChange}
              onToggleIgnore={toggleIgnore}
              onToggleProtection={handleToggleProtection}
              onMobileTooltip={setMobileTooltip}
              onVideoClick={setModalVideo}
            />
          ))}
        </Grid>
      );
    }
    if (mode === 'list') {
      return (
        <div>
          {paginatedVideos.map((video) => (
            <VideoListItem
              key={video.youtube_id}
              video={video}
              checkedBoxes={checkedBoxes}
              selectedForDeletion={selectedForDeletion}
              selectionMode={selectionMode}
              onCheckChange={handleCheckChange}
              onDeletionChange={handleDeletionChange}
              onToggleIgnore={toggleIgnore}
              onToggleProtection={handleToggleProtection}
              onMobileTooltip={setMobileTooltip}
              onVideoClick={setModalVideo}
            />
          ))}
        </div>
      );
    }
    return (
      <VideoTableView
        videos={paginatedVideos}
        checkedBoxes={checkedBoxes}
        selectedForDeletion={selectedForDeletion}
        selectionMode={selectionMode}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onCheckChange={handleCheckChange}
        onSelectAll={handleSelectAll}
        onClearSelection={clearAllSelections}
        onSortChange={handleSortChange}
        onDeletionChange={handleDeletionChange}
        onToggleIgnore={toggleIgnore}
        onToggleProtection={handleToggleProtection}
        onMobileTooltip={setMobileTooltip}
        onVideoClick={setModalVideo}
      />
    );
  };

  const toolbarRightActions = !isMobile ? (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button
        size="small"
        variant="outlined"
        onClick={handleSelectAllNotDownloaded}
        disabled={
          paginatedVideos.filter((video) => {
            const status = getVideoStatus(video);
            return status === 'never_downloaded' || status === 'missing' || status === 'ignored';
          }).length === 0
        }
        className="intent-warning"
      >
        Select pending
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={handleSelectAllDownloaded}
        disabled={
          paginatedVideos.filter((video) => video.added && !video.removed).length === 0
        }
        className="intent-base"
      >
        Select downloaded
      </Button>
    </div>
  ) : null;

  const itemCount = videoFailed && videos.length === 0 ? 0 : paginatedVideos.length;
  const customEmptyMessage =
    videoFailed && videos.length === 0
      ? 'Failed to fetch channel videos. Please try again later.'
      : undefined;

  const availableViewModes: VideoListViewMode[] = isMobile
    ? ['grid', 'list']
    : ['grid', 'table'];

  useEffect(() => {
    if (!availableViewModes.includes(listState.viewMode)) {
      listState.setViewMode(isMobile ? 'list' : 'table');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, listState.viewMode]);

  return (
    <>
      <Card
        elevation={3}
        style={{ marginBottom: 16, borderRadius: 'var(--radius-ui)', overflow: 'hidden' }}
      >
        <VideoListContainer
          state={listState}
          selection={activeSelection}
          viewModes={availableViewModes}
          filters={filterConfigs}
          searchPlaceholder="Search videos..."
          headerSlot={headerSlot}
          toolbarExtras={toolbarExtras}
          toolbarRightActions={toolbarRightActions}
          tabsSlot={tabsSlot}
          itemCount={itemCount}
          isLoading={videosLoading && videos.length === 0}
          isError={Boolean(customEmptyMessage)}
          errorMessage={customEmptyMessage}
          renderContent={renderContent}
          loadingSkeleton={videosLoading && videos.length === 0 ? loadingSkeleton : undefined}
          pagination={paginationNode}
          paginationTop={paginationTopNode}
          paginationMode={useInfiniteScroll ? 'infinite' : 'pages'}
          infiniteScrollSentinel={infiniteSentinel}
          isMobile={isMobile}
        />
      </Card>

      <ChannelVideosDialogs
        token={token}
        downloadDialogOpen={downloadDialogOpen}
        refreshConfirmOpen={refreshConfirmOpen}
        deleteDialogOpen={deleteDialogOpen}
        fetchAllError={fetchAllError}
        mobileTooltip={mobileTooltip}
        successMessage={successMessage}
        errorMessage={errorMessage}
        videoCount={checkedBoxes.length}
        missingVideoCount={getMissingVideoCount()}
        selectedForDeletion={selectedForDeletion.length}
        defaultResolution={defaultResolution}
        defaultResolutionSource={defaultResolutionSource}
        defaultAudioFormat={defaultAudioFormat}
        defaultAudioFormatSource={defaultAudioFormatSource}
        selectedTab={selectedTab || 'videos'}
        tabLabel={getTabLabel(selectedTab || 'videos')}
        onDownloadDialogClose={() => setDownloadDialogOpen(false)}
        onDownloadConfirm={handleDownloadConfirm}
        onRefreshCancel={handleRefreshCancel}
        onRefreshConfirm={handleRefreshConfirm}
        onDeleteCancel={handleDeleteCancel}
        onDeleteConfirm={handleDeleteConfirm}
        onFetchAllErrorClose={clearFetchAllError}
        onMobileTooltipClose={() => setMobileTooltip(null)}
        onSuccessMessageClose={() => setSuccessMessage(null)}
        onErrorMessageClose={() => setErrorMessage(null)}
      />

      {modalVideo && (
        <VideoModal
          open
          onClose={() => setModalVideo(null)}
          video={channelVideoToModalData(modalVideo, channelName, channelId)}
          token={token}
          onVideoDeleted={() => {
            setModalVideo(null);
            refetchVideos();
          }}
          onProtectionChanged={(youtubeId, isProtected) => {
            setLocalProtectedStatus((prev) => ({ ...prev, [youtubeId]: isProtected }));
          }}
          onIgnoreChanged={(youtubeId, isIgnored) => {
            setLocalIgnoreStatus((prev) => ({ ...prev, [youtubeId]: isIgnored }));
          }}
          onDownloadQueued={() => setModalVideo(null)}
          onRatingChanged={() => refetchVideos()}
        />
      )}
    </>
  );
}

export default ChannelVideos;
