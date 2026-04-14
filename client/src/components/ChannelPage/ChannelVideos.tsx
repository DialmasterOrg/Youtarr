import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import {
  Card,
  Typography,
  Alert,
  Skeleton,
  Grid,
  Tabs,
  Tab,
  Button,
  Select,
  MenuItem,
} from '../ui';
import { Download as DownloadIcon, Trash2 as DeleteIcon, X as ClearIcon, Ban as BlockIcon } from '../../lib/icons';

import useMediaQuery from '../../hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';
import { useVideoDeletion } from '../shared/useVideoDeletion';
import { useVideoProtection } from '../shared/useVideoProtection';
import { getVideoStatus } from '../../utils/videoStatus';
import VideoCard from './VideoCard';
import VideoListItem from './VideoListItem';
import VideoTableView from './VideoTableView';
import ChannelVideosHeader from './ChannelVideosHeader';
import ChannelVideosDialogs from './ChannelVideosDialogs';
import { useChannelVideos } from './hooks/useChannelVideos';
import { useRefreshChannelVideos } from './hooks/useRefreshChannelVideos';
import { useChannelFetchStatus } from './hooks/useChannelFetchStatus';
import { useChannelVideoFilters } from './hooks/useChannelVideoFilters';
import { useChannelVideosPageSize, ALLOWED_PAGE_SIZES, type PageSize } from './hooks/useChannelVideosPageSize';
import ChannelVideosFilters from './components/ChannelVideosFilters';
import { useConfig } from '../../hooks/useConfig';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { useTriggerDownloads } from '../../hooks/useTriggerDownloads';
import PageControls from '../shared/PageControls';
import { ActionBar } from '../shared/ActionBar';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';
import { ChannelVideo } from '../../types/ChannelVideo';

interface ChannelVideosProps {
  token: string | null;
  channelAutoDownloadTabs?: string;
  channelId?: string;
  channelName?: string;
  channelVideoQuality?: string | null;
  channelAudioFormat?: string | null;
  /**
   * Effective available_tabs for the channel (comma-separated, already
   * filtered through hidden_tabs). When provided, takes precedence over
   * the tabs fetched from /api/channels/:channelId/tabs so the strip
   * updates immediately after the user changes hidden_tabs in settings.
   */
  channelAvailableTabs?: string | null;
}

type ViewMode = 'table' | 'grid' | 'list';
type SortBy = 'date' | 'title' | 'duration' | 'size';
type SortOrder = 'asc' | 'desc';

function channelVideoToModalData(video: ChannelVideo, channelName: string, channelId: string | undefined): VideoModalData {
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

function ChannelVideos({ token, channelAutoDownloadTabs, channelId: propChannelId, channelName = '', channelVideoQuality, channelAudioFormat, channelAvailableTabs }: ChannelVideosProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const { themeMode } = useThemeEngine();

  // View and display states
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'list' : 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [maxRating, setMaxRating] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  // Tab states
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [tabsLoading, setTabsLoading] = useState<boolean>(true);
  const [tabAutoDownloadStatus, setTabAutoDownloadStatus] = useState<Record<string, boolean>>({});

  // Data states
  const [pageSize, setPageSize] = useChannelVideosPageSize();
  const [page, setPage] = useState(1);
  const [checkedBoxes, setCheckedBoxes] = useState<string[]>([]);
  const [hideDownloaded, setHideDownloaded] = useState(false);
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollRestoreRef = useRef<{ top: number | null; armed: boolean }>({ top: null, armed: false });
  const lastVideosCountRef = useRef<number>(0);
  const lastTriggerTimeRef = useRef<number>(0);
  const lastTriggerScrollTopRef = useRef<number>(0);
  const canTriggerNextRef = useRef<boolean>(true);

  // Modal state
  const [modalVideo, setModalVideo] = useState<ChannelVideo | null>(null);

  // Local state to track ignore status changes without refetching
  const [localIgnoreStatus, setLocalIgnoreStatus] = useState<Record<string, boolean>>({});

  // Local state to track protection status changes without refetching
  const [localProtectedStatus, setLocalProtectedStatus] = useState<Record<string, boolean>>({});

  // Protected filter state
  const [protectedFilter, setProtectedFilter] = useState(false);

  // Filter state
  const {
    filters,
    inputMinDuration,
    inputMaxDuration,
    setMinDuration,
    setMaxDuration,
    setDateFrom,
    setDateTo,
    clearAllFilters,
    hasActiveFilters,
    activeFilterCount: baseActiveFilterCount,
  } = useChannelVideoFilters();

  // Include protectedFilter in the active filter count and hasActiveFilters
  const activeFilterCount = baseActiveFilterCount + (protectedFilter ? 1 : 0);
  const hasAnyActiveFilter = hasActiveFilters || protectedFilter;

  const { deleteVideosByYoutubeIds, loading: deleteLoading } = useVideoDeletion();
  const { toggleProtection, successMessage: protectionSuccess, error: protectionError, clearMessages: clearProtectionMessages } = useVideoProtection(token);

  const { channel_id: routeChannelId } = useParams();
  const channelId = propChannelId ?? routeChannelId ?? undefined;

  // Fetch available tabs on mount
  useEffect(() => {
    const fetchAvailableTabs = async () => {
      if (!channelId || !token) return;

      setTabsLoading(true);
      try {
        const response = await fetch(`/api/channels/${channelId}/tabs`, {
          headers: {
            'x-access-token': token,
          },
        });

        if (response.ok) {
          const data = await response.json();

          if (data.availableTabs && data.availableTabs.length > 0) {
            setAvailableTabs(data.availableTabs);

            // Set default tab: prefer 'videos' if it exists, otherwise use first available
            const defaultTab = data.availableTabs.includes('videos')
              ? 'videos'
              : data.availableTabs[0];

            setSelectedTab(defaultTab);
            setTabsLoading(false);
          } else {
            // Detection complete but no tabs found - fallback to 'videos'
            setAvailableTabs(['videos']);
            setSelectedTab('videos');
            setTabsLoading(false);
          }
        } else {
          // Fallback on error
          setAvailableTabs(['videos']);
          setSelectedTab('videos');
          setTabsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching available tabs:', err);
        // Fallback on error
        setAvailableTabs(['videos']);
        setSelectedTab('videos');
        setTabsLoading(false);
      }
    };

    fetchAvailableTabs();
  }, [channelId, token]);

  // Poll for tabs while detection is in progress
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
              const defaultTab = data.availableTabs.includes('videos')
              ? 'videos'
              : data.availableTabs[0];
              setSelectedTab(defaultTab);
          } else {
              setAvailableTabs(['videos']);
              setSelectedTab('videos');
          }
          setTabsLoading(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        // Ignore polling errors, will retry
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [channelId, token, tabsLoading]);

  // Initialize tab auto-download status from prop
  useEffect(() => {
    if (!channelAutoDownloadTabs) {
      setTabAutoDownloadStatus({});
      return;
    }

    const mediaTypeMap: Record<string, string> = {
      'videos': 'video',
      'shorts': 'short',
      'streams': 'livestream',
    };

    const enabledTabs = channelAutoDownloadTabs.split(',').map(t => t.trim());

    // Only update tabs that don't already have a value in the state
    // This preserves local changes made via handleAutoDownloadChange
    setTabAutoDownloadStatus(prevStatus => {
      const newStatus: Record<string, boolean> = { ...prevStatus };

      availableTabs.forEach(tabType => {
        // Only initialize tabs that haven't been set yet
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
    () => [
      channelId || '',
      selectedTab || '',
      hideDownloaded,
      searchQuery,
      sortBy,
      sortOrder,
      maxRating,
      filters.minDuration,
      filters.maxDuration,
      filters.dateFrom ? filters.dateFrom.toISOString() : '',
      filters.dateTo ? filters.dateTo.toISOString() : '',
      useInfiniteScroll,
    ].join('|'),
    [
      channelId,
      selectedTab,
      hideDownloaded,
      searchQuery,
      sortBy,
      sortOrder,
      maxRating,
      filters.minDuration,
      filters.maxDuration,
      filters.dateFrom,
      filters.dateTo,
      useInfiniteScroll,
    ]
  );

  // Use custom hooks for data fetching
  const {
    videos,
    totalCount,
    oldestVideoDate,
    videoFailed,
    autoDownloadsEnabled,
    availableTabs: availableTabsFromVideos,
    loading: videosLoading,
    refetch: refetchVideos,
  } = useChannelVideos({
    channelId,
    page,
    pageSize,
    hideDownloaded,
    searchQuery,
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
  });

  // Update available tabs from video fetch response if available
  useEffect(() => {
    if (availableTabsFromVideos && availableTabsFromVideos.length > 0) {
      setAvailableTabs(availableTabsFromVideos);
    }
  }, [availableTabsFromVideos]);

  // Sync from the parent-supplied channel.available_tabs when it changes
  // (e.g. right after the user saves a hidden_tabs change in settings).
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

  // Clear local status overrides when videos are refetched (page change, tab change, etc)
  useEffect(() => {
    setLocalIgnoreStatus({});
    setLocalProtectedStatus({});
  }, [page, selectedTab, hideDownloaded, searchQuery, sortBy, sortOrder, filters]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.minDuration, filters.maxDuration, filters.dateFrom, filters.dateTo]);

  useEffect(() => {
    setPage(1);
  }, [useInfiniteScroll]);

  useEffect(() => {
    if (!useInfiniteScroll) {
      scrollRestoreRef.current = { top: null, armed: false };
      lastVideosCountRef.current = videos.length;
      return;
    }

    if (videosLoading) {
      return;
    }

    const previousCount = lastVideosCountRef.current;
    if (
      scrollRestoreRef.current.armed &&
      scrollRestoreRef.current.top !== null &&
      videos.length > previousCount
    ) {
      // Disabled scroll restore as it conflicts with infinite scroll behavior
      /*
      if (typeof window !== 'undefined') {
        const currentTop = window.scrollY || 0;
        if (Math.abs(currentTop - scrollRestoreRef.current.top) < 24) {
          window.scrollTo({ top: scrollRestoreRef.current.top, behavior: 'auto' });
        }
      }
      */
      scrollRestoreRef.current = { top: null, armed: false };
    }

    lastVideosCountRef.current = videos.length;
  }, [videos.length, videosLoading, useInfiniteScroll]);

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

  // Poll for background fetch status (persists across navigation)
  const {
    isFetching: backgroundFetching,
    onFetchComplete,
    startPolling,
  } = useChannelFetchStatus(channelId, selectedTab, token);

  // Combine local and background fetch states
  const fetchingAllVideos = localFetchingAllVideos || backgroundFetching;

  // When a background fetch completes, refetch the videos
  useEffect(() => {
    onFetchComplete(() => {
      refetchVideos();
    });
  }, [onFetchComplete, refetchVideos]);

  const navigate = useNavigate();

  // Apply local ignore and protection status overrides to videos (for optimistic updates)
  const videosWithOverrides = useMemo(() => {
    return videos.map(video => {
      const hasIgnoreOverride = video.youtube_id in localIgnoreStatus;
      const hasProtectedOverride = video.youtube_id in localProtectedStatus;

      if (!hasIgnoreOverride && !hasProtectedOverride) return video;

      return {
        ...video,
        ...(hasIgnoreOverride ? {
          ignored: localIgnoreStatus[video.youtube_id],
          ignored_at: localIgnoreStatus[video.youtube_id] ? new Date().toISOString() : null,
        } : {}),
        ...(hasProtectedOverride ? {
          protected: localProtectedStatus[video.youtube_id],
        } : {}),
      };
    });
  }, [videos, localIgnoreStatus, localProtectedStatus]);

  const paginatedVideos = videosWithOverrides;

  // Use server-provided total count for pagination/infinite scroll
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const hasNextPage = page < totalPages;
  const selectionMode = checkedBoxes.length > 0 ? 'download' : selectedForDeletion.length > 0 ? 'delete' : null;
  const canSelectDownload = selectionMode !== 'delete';
  const canSelectDeletion = selectionMode !== 'download';

  useEffect(() => {
    if (!isMobile) {
      setMobileFiltersOpen(false);
      setMobileActionsOpen(false);
      return;
    }

    if (selectionMode) {
      setMobileActionsOpen(false);
    }
  }, [isMobile, selectionMode]);

  // Event handlers
  const handleCheckChange = useCallback((videoId: string, isChecked: boolean) => {
    setCheckedBoxes((prevState) => {
      if (isChecked) {
        return [...prevState, videoId];
      } else {
        return prevState.filter((id) => id !== videoId);
      }
    });
  }, []);

  const handleDeletionChange = useCallback((videoId: string, isChecked: boolean) => {
    setSelectedForDeletion((prevState) => {
      if (isChecked) {
        return [...prevState, videoId];
      }
      return prevState.filter((id) => id !== videoId);
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!canSelectDownload && !canSelectDeletion) {
      return;
    }

    if (selectionMode === 'delete') {
      const deletableVideos = paginatedVideos.filter((video) => video.added && !video.removed);
      const videoIds = deletableVideos.map((video) => video.youtube_id);
      setSelectedForDeletion((prevState) => {
        const newIds = videoIds.filter((id) => !prevState.includes(id));
        return [...prevState, ...newIds];
      });
      return;
    }

    const selectableVideos = paginatedVideos.filter((video) => {
      const status = getVideoStatus(video);
      return status === 'never_downloaded' || status === 'missing' || status === 'ignored';
    });
    const videoIds = selectableVideos.map((video) => video.youtube_id);
    setCheckedBoxes((prevState) => {
      const newIds = videoIds.filter((id) => !prevState.includes(id));
      return [...prevState, ...newIds];
    });
  }, [canSelectDeletion, canSelectDownload, paginatedVideos, selectionMode]);

  const handleSelectAllDownloaded = useCallback(() => {
    const downloadedVideoIds = paginatedVideos
      .filter((video) => video.added && !video.removed)
      .map((video) => video.youtube_id);

    setSelectedForDeletion((prevState) => {
      const newIds = downloadedVideoIds.filter((id) => !prevState.includes(id));
      return [...prevState, ...newIds];
    });
  }, [paginatedVideos]);

  const handleSelectAllNotDownloaded = useCallback(() => {
    const downloadableVideoIds = paginatedVideos
      .filter((video) => {
        const status = getVideoStatus(video);
        return status === 'never_downloaded' || status === 'missing' || status === 'ignored';
      })
      .map((video) => video.youtube_id);

    setCheckedBoxes((prevState) => {
      const newIds = downloadableVideoIds.filter((id) => !prevState.includes(id));
      return [...prevState, ...newIds];
    });
  }, [paginatedVideos]);

  const handleClearSelection = useCallback(() => {
    setCheckedBoxes([]);
    setSelectedForDeletion([]);
  }, []);

  const handleDownloadClick = useCallback(() => {
    setDownloadDialogOpen(true);
  }, []);

  const handleDownloadConfirm = async (settings: DownloadSettings | null) => {
    setDownloadDialogOpen(false);

    const urls = checkedBoxes.map(id => `https://www.youtube.com/watch?v=${id}`);
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

  const handleRefreshClick = () => {
    setRefreshConfirmOpen(true);
  };

  const handleRefreshConfirm = async () => {
    setRefreshConfirmOpen(false);
    // Start polling for fetch status since we're initiating a fetch
    startPolling();
    await refreshVideos();
    // The hook handles loading and error states
    // After refresh completes, refetch the videos to update the list
    await refetchVideos();
  };

  const handleRefreshCancel = () => {
    setRefreshConfirmOpen(false);
  };

  // Forward protection hook messages to the shared success/error state
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
    const video = paginatedVideos.find(v => v.youtube_id === youtubeId);
    if (!video || !video.id) return;

    const currentState = video.protected || false;
    const newState = await toggleProtection(video.id, currentState);
    if (newState !== undefined) {
      setLocalProtectedStatus(prev => ({
        ...prev,
        [youtubeId]: newState,
      }));
    }
  };

  const toggleDeletionSelection = (youtubeId: string) => {
    handleDeletionChange(youtubeId, !selectedForDeletion.includes(youtubeId));
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
      setSuccessMessage(`Successfully deleted ${result.deleted.length} video${result.deleted.length !== 1 ? 's' : ''}`);
      setSelectedForDeletion([]);
      // Refresh the videos list
      await refetchVideos();
    } else {
      const deletedCount = result.deleted.length;
      const failedCount = result.failed.length;

      if (deletedCount > 0) {
        setSuccessMessage(`Deleted ${deletedCount} video${deletedCount !== 1 ? 's' : ''}, but ${failedCount} failed`);
        setSelectedForDeletion(prev => prev.filter(id => !result.deleted.includes(id)));
        // Refresh list
        await refetchVideos();
      } else {
        setErrorMessage(`Failed to delete videos: ${result.failed[0]?.error || 'Unknown error'}`);
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  // Ignore/unignore handlers
  const toggleIgnore = async (youtubeId: string) => {
    if (!channelId || !token) return;

    const video = paginatedVideos.find(v => v.youtube_id === youtubeId);
    const isCurrentlyIgnored = video?.ignored;
    const endpoint = isCurrentlyIgnored ? 'unignore' : 'ignore';
    const newIgnoreStatus = !isCurrentlyIgnored;

    // Capture original state BEFORE optimistic update (for potential rollback)
    const originalIgnoreStatus = isCurrentlyIgnored ?? false;

    // Optimistically update local state immediately
    setLocalIgnoreStatus(prev => ({
      ...prev,
      [youtubeId]: newIgnoreStatus
    }));

    try {
      const response = await fetch(`/api/channels/${channelId}/videos/${youtubeId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'x-access-token': token,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} video`);
      }

      let successMessage;
      if (isCurrentlyIgnored) {
        successMessage = `Video unignored. Channel downloads will include this video`;
      } else {
        successMessage = `Video ignored. Channel downloads will exclude this video`;
      }
      setSuccessMessage(successMessage);
    } catch (error) {
      // Revert optimistic update on ANY error (network failure, non-OK response, etc.)
      setLocalIgnoreStatus(prev => ({
        ...prev,
        [youtubeId]: originalIgnoreStatus
      }));
      console.error('Error toggling ignore:', error);
      setErrorMessage(`Failed to ${endpoint} video`);
    }
  };

  const handleBulkIgnore = async () => {
    if (!channelId || !token || checkedBoxes.length === 0) {
      setErrorMessage('No videos selected to ignore');
      return;
    }

    // Capture original state BEFORE optimistic update (for potential rollback)
    const originalIgnoreStates: Record<string, boolean> = {};
    checkedBoxes.forEach(youtubeId => {
      const video = paginatedVideos.find(v => v.youtube_id === youtubeId);
      originalIgnoreStates[youtubeId] = video?.ignored ?? false;
    });

    // Optimistically update local state for all selected videos
    const bulkIgnoreUpdates: Record<string, boolean> = {};
    checkedBoxes.forEach(youtubeId => {
      bulkIgnoreUpdates[youtubeId] = true;
    });
    setLocalIgnoreStatus(prev => ({
      ...prev,
      ...bulkIgnoreUpdates
    }));

    try {
      const response = await fetch(`/api/channels/${channelId}/videos/bulk-ignore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token,
        },
        body: JSON.stringify({ youtubeIds: checkedBoxes }),
      });

      if (!response.ok) {
        throw new Error('Failed to bulk ignore videos');
      }

      const result = await response.json();
      setSuccessMessage(result.message || `Successfully ignored ${checkedBoxes.length} videos`);
      setCheckedBoxes([]);
    } catch (error) {
      // Revert optimistic updates on ANY error (network failure, non-OK response, etc.)
      setLocalIgnoreStatus(prev => ({
        ...prev,
        ...originalIgnoreStates
      }));
      console.error('Error bulk ignoring:', error);
      setErrorMessage('Failed to bulk ignore videos');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newTab: string | number) => {
    // Prevent tab changes while videos are still loading
    if (videosLoading) {
      return;
    }

    setSelectedTab(String(newTab));
    setPage(1); // Reset to first page when changing tabs
    setCheckedBoxes([]); // Clear selections when changing tabs
    setSelectedForDeletion([]); // Clear deletion selections when changing tabs
    clearAllFilters(); // Clear filters when changing tabs
    setProtectedFilter(false); // Clear protected filter when changing tabs
  };

  const handleClearAllFilters = useCallback(() => {
    clearAllFilters();
    setProtectedFilter(false);
  }, [clearAllFilters]);

  const handleAutoDownloadChange = async (enabled: boolean) => {
    if (!channelId || !token || !selectedTab) return;

    // Store selectedTab in a const so TypeScript knows it's not null
    const currentTab = selectedTab;

    try {
      const response = await fetch(`/api/channels/${channelId}/tabs/${currentTab}/auto-download`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token,
        },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to update auto download setting');
      }

      // Update local state to reflect the change immediately
      setTabAutoDownloadStatus(prev => ({
        ...prev,
        [currentTab]: enabled,
      }));
    } catch (error) {
      console.error('Error updating auto download setting:', error);
      setErrorMessage('Failed to update auto download setting');
    }
  };

  const handlePageChange = (value: number) => {
    setPage(value);
  };

  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize);
    setPage(1);
  };

  const handleViewModeChange = (event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
      setPage(1);
    }
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
      const video = videos.find(v => v.youtube_id === videoId);
      if (video && video.added && video.removed) {
        return count + 1;
      }
      return count;
    }, 0);
  };

  // Helper function to get tab label
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

  // Helper function to check if a tab has auto-downloads enabled
  const isTabAutoDownloadEnabled = (tabType: string): boolean => {
    return tabAutoDownloadStatus[tabType] || false;
  };

  // Helper function to render tab label with optional alarm icon
  const renderTabLabel = (tabType: string) => {
    const label = getTabLabel(tabType);
    const isEnabled = isTabAutoDownloadEnabled(tabType);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Typography
          variant="caption"
          style={{
            fontWeight: 700,
            color: 'inherit',
          }}
        >
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

  useEffect(() => {
    if (!loadMoreRef.current) return;
    if (videosLoading || !hasNextPage) return;
    if (!useInfiniteScroll) return;

    let didTrigger = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        const now = Date.now();
        const currentTop = typeof window !== 'undefined' ? window.scrollY || 0 : 0;
        const viewportHeight = entry.rootBounds?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
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
          lastTriggerScrollTopRef.current = currentTop;
          if (typeof window !== 'undefined') {
            // scrollRestoreRef.current = { top: window.scrollY || 0, armed: true };
          }
          setPage((prev) => prev + 1);
        }

      },
      {
        root: null,
        rootMargin: '0px 0px 200px 0px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      observer.disconnect();
    };
  }, [videosLoading, hasNextPage, useInfiniteScroll, page, themeMode]);

  const renderSelectionAction = () => {
    if (!isMobile || !selectionMode || typeof window === 'undefined') return null;

    const isDownloadAction = selectionMode === 'download';
    const count = isDownloadAction ? checkedBoxes.length : selectedForDeletion.length;

    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: 8,
          right: 8,
          bottom: 'calc(var(--mobile-nav-total-offset, 0px) + 8px)',
          zIndex: 1399,
        }}
      >
        <ActionBar
          variant={themeMode}
          compact
          style={{
            justifyContent: 'space-between',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 'var(--radius-ui)',
            border: 'var(--nav-border)',
            backgroundColor: 'var(--card)',
            boxShadow: 'var(--shadow-hard)',
          }}
        >
          <Typography variant="body2" style={{ fontWeight: 700 }}>
            {count} selected
          </Typography>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
            {isDownloadAction ? (
              <>
                <Button size="small" onClick={handleDownloadClick} className="intent-success">
                  Download
                </Button>
                <Button size="small" onClick={handleBulkIgnore} className="intent-warning" startIcon={<BlockIcon size={14} />}>
                  Ignore
                </Button>
              </>
            ) : (
              <Button size="small" onClick={handleDeleteClick} className="intent-danger" startIcon={<DeleteIcon size={14} />}>
                Delete
              </Button>
            )}
            <Button size="small" onClick={handleClearSelection} className="intent-base" startIcon={<ClearIcon size={14} />}>
              Clear
            </Button>
          </div>
        </ActionBar>
      </div>,
      document.body
    );
  };

  const renderMobileActionsTray = () => {
    if (!isMobile || selectionMode || !mobileActionsOpen || typeof window === 'undefined') return null;

    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: 8,
          right: 8,
          bottom: 'calc(var(--mobile-nav-total-offset, 0px) + 8px)',
          zIndex: 1399,
        }}
      >
        <ActionBar
          variant={themeMode}
          compact
          style={{
            justifyContent: 'space-between',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 'var(--radius-ui)',
            border: 'var(--nav-border)',
            backgroundColor: 'var(--card)',
            boxShadow: 'var(--shadow-hard)',
          }}
        >
          <Typography variant="body2" style={{ fontWeight: 700 }}>
            Channel actions
          </Typography>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
            <Button
              size="small"
              className="intent-base"
              onClick={() => {
                handleSelectAllDownloaded();
                setMobileActionsOpen(false);
              }}
              disabled={paginatedVideos.filter((video) => video.added && !video.removed).length === 0}
            >
              Select downloaded
            </Button>
            <Button
              size="small"
              className="intent-warning"
              onClick={() => {
                handleSelectAllNotDownloaded();
                setMobileActionsOpen(false);
              }}
              disabled={paginatedVideos.filter((video) => {
                const status = getVideoStatus(video);
                return status === 'never_downloaded' || status === 'missing' || status === 'ignored';
              }).length === 0}
            >
              Select pending
            </Button>
            <Button size="small" onClick={() => setMobileActionsOpen(false)} className="intent-base" startIcon={<ClearIcon size={14} />}>
              Close
            </Button>
          </div>
        </ActionBar>
      </div>,
      document.body
    );
  };

  return (
    <>
      <Card elevation={3} style={{ marginBottom: 16, borderRadius: 'var(--radius-ui)', overflow: 'hidden' }}>
        <ChannelVideosHeader
          isMobile={isMobile}
          viewMode={viewMode}
          searchQuery={searchQuery}
          hideDownloaded={hideDownloaded}
          totalCount={totalCount}
          oldestVideoDate={oldestVideoDate}
          fetchingAllVideos={fetchingAllVideos}
          checkedBoxes={checkedBoxes}
          selectedForDeletion={selectedForDeletion}
          selectionMode={selectionMode}
          deleteLoading={deleteLoading}
          paginatedVideos={paginatedVideos}
          selectedTab={selectedTab || 'videos'}
          maxRating={maxRating}
          onViewModeChange={handleViewModeChange}
          onSearchChange={(query) => {
            setSearchQuery(query);
            setPage(1);
          }}
          onHideDownloadedChange={(hide) => {
            setHideDownloaded(hide);
            setPage(1);
          }}
          onRefreshClick={handleRefreshClick}
          onDownloadClick={handleDownloadClick}
          onSelectAllDownloaded={handleSelectAllDownloaded}
          onSelectAllNotDownloaded={handleSelectAllNotDownloaded}
          onClearSelection={handleClearSelection}
          onDeleteClick={handleDeleteClick}
          onBulkIgnoreClick={handleBulkIgnore}
          onInfoIconClick={(tooltip) => setMobileTooltip(tooltip)}
          onMaxRatingChange={(value) => {
            setMaxRating(value);
            setPage(1);
          }}
          activeFilterCount={activeFilterCount}
          filtersExpanded={filtersExpanded}
          onFiltersExpandedChange={setFiltersExpanded}
          mobileFiltersOpen={mobileFiltersOpen}
          onMobileFiltersOpenChange={setMobileFiltersOpen}
          mobileActionsOpen={mobileActionsOpen}
          onMobileActionsOpenChange={setMobileActionsOpen}
        />

        {/* Filters */}
        <ChannelVideosFilters
          isMobile={isMobile}
          filters={filters}
          inputMinDuration={inputMinDuration}
          inputMaxDuration={inputMaxDuration}
          onMinDurationChange={setMinDuration}
          onMaxDurationChange={setMaxDuration}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearAll={handleClearAllFilters}
          hasActiveFilters={hasAnyActiveFilter}
          activeFilterCount={activeFilterCount}
          hideDateFilter={selectedTab === 'shorts'}
          filtersExpanded={filtersExpanded}
          mobileDrawerOpen={mobileFiltersOpen}
          onMobileDrawerClose={() => setMobileFiltersOpen(false)}
          protectedFilter={protectedFilter}
          onProtectedFilterChange={setProtectedFilter}
        />

        {/* Tabs */}
          { availableTabs.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--border)', padding: isMobile ? '0 10px' : '0 16px' }}>
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
        )}

        {/* Pagination and page size selector */}
        {!videosLoading && totalCount > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              position: 'relative',
              minHeight: 48,
            }}
          >
            {totalPages > 1 && (
              <PageControls
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                compact={isMobile}
              />
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                position: isMobile ? undefined : 'absolute',
                right: isMobile ? undefined : 16,
              }}
            >
              {!isMobile && (
                <Typography variant="body2" style={{ color: 'var(--muted-foreground)' }}>
                  Per page:
                </Typography>
              )}
              <Select
                size="small"
                value={pageSize}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if ((ALLOWED_PAGE_SIZES as readonly number[]).includes(val)) {
                    handlePageSizeChange(val as PageSize);
                  }
                }}
                aria-label="videos per page"
                sx={{
                  minWidth: 64,
                  '& .MuiSelect-select': {
                    py: 0.5,
                    fontSize: '0.875rem',
                  },
                }}
              >
                {ALLOWED_PAGE_SIZES.map((size) => (
                  <MenuItem key={size} value={size}>
                    {size}
                  </MenuItem>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Content area */}
        <div
          style={{
            padding: isMobile ? 10 : 12,
            paddingBottom: isMobile ? 'calc(var(--mobile-nav-total-offset, 0px) + 96px)' : 16,
            position: 'relative',
            minHeight: '100vh',
            overflowX: 'clip',
          }}
          {...{}}
        >
          {videoFailed && videos.length === 0 && !hasAnyActiveFilter && !searchQuery ? (
            <Alert severity="error">
              Failed to fetch channel videos. Please try again later.
            </Alert>
          ) : videosLoading && videos.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>
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
          ) : videos.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>
              <Typography variant="body1" color="text.secondary">
                {hasAnyActiveFilter || searchQuery
                  ? 'No videos found matching your search and filter criteria'
                  : 'No videos found'}
              </Typography>
            </div>
          ) : (
            <>
              {/* View mode content */}
              {viewMode === 'grid' && (
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
              )}

              {viewMode === 'list' && (
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
              )}

              {viewMode === 'table' && (
                <VideoTableView
                  videos={paginatedVideos}
                  checkedBoxes={checkedBoxes}
                  selectedForDeletion={selectedForDeletion}
                  selectionMode={selectionMode}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onCheckChange={handleCheckChange}
                  onSelectAll={handleSelectAll}
                  onClearSelection={handleClearSelection}
                  onSortChange={handleSortChange}
                  onDeletionChange={handleDeletionChange}
                  onToggleIgnore={toggleIgnore}
                  onToggleProtection={handleToggleProtection}
                  onMobileTooltip={setMobileTooltip}
                  onVideoClick={setModalVideo}
                />
              )}

            </>
          )}

          {renderSelectionAction()}
          {renderMobileActionsTray()}

          {useInfiniteScroll && (
            <>
              {/* Sentinel for infinite scroll - needs height and safe padding to ensure intersection triggers */}
              <div
                ref={loadMoreRef}
                style={{
                  height: 24,
                  width: '100%',
                  marginTop: 32,
                  marginBottom: 32,
                }}
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
                <Typography variant="caption" color="text.secondary" align="center" style={{ display: 'block', padding: '16px 0' }}>
                  {"You're all caught up."}
                </Typography>
              )}
            </>
          )}

          {!useInfiniteScroll && totalPages > 1 && (
            <Grid
              container
              spacing={2}
              style={{ marginTop: '8px', marginBottom: isMobile ? '0px' : '8px', display: 'flex', justifyContent: 'center' }}
            >
              <PageControls
                page={page}
                totalPages={totalPages}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                compact={isMobile}
              />
            </Grid>
          )}
        </div>
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
            setLocalProtectedStatus(prev => ({ ...prev, [youtubeId]: isProtected }));
          }}
          onIgnoreChanged={(youtubeId, isIgnored) => {
            setLocalIgnoreStatus(prev => ({ ...prev, [youtubeId]: isIgnored }));
          }}
          onDownloadQueued={() => {
            setModalVideo(null);
          }}
          onRatingChanged={() => {
            refetchVideos();
          }}
        />
      )}
    </>
  );
}

export default ChannelVideos;
