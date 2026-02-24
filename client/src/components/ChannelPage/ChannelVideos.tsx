import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import {
  Card,
  Typography,
  Alert,
  Skeleton,
  Grid,
  Grow,
  Badge,
  Tabs,
  Tab,
} from '../ui';

import { Download as DownloadIcon, Trash2 as DeleteIcon } from '../../lib/icons';

import useMediaQuery from '../../hooks/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';
import { useVideoDeletion } from '../shared/useVideoDeletion';
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
import ChannelVideosFilters from './components/ChannelVideosFilters';
import { useConfig } from '../../hooks/useConfig';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { useTriggerDownloads } from '../../hooks/useTriggerDownloads';

interface ChannelVideosProps {
  token: string | null;
  channelAutoDownloadTabs?: string;
  channelId?: string;
  channelVideoQuality?: string | null;
  channelAudioFormat?: string | null;
}

type ViewMode = 'table' | 'grid' | 'list';
type SortBy = 'date' | 'title' | 'duration' | 'size';
type SortOrder = 'asc' | 'desc';

function ChannelVideos({ token, channelAutoDownloadTabs, channelId: propChannelId, channelVideoQuality, channelAudioFormat }: ChannelVideosProps) {
  const isMobile = useMediaQuery('(max-width: 599px)');
  const { themeMode } = useThemeEngine();

  // View and display states
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'list' : 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [maxRating, setMaxRating] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Tab states
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [tabsLoading, setTabsLoading] = useState<boolean>(true);
  const [tabAutoDownloadStatus, setTabAutoDownloadStatus] = useState<Record<string, boolean>>({});

  // Data states
  const pageSize = isMobile ? 8 : 16;
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

  // Local state to track ignore status changes without refetching
  const [localIgnoreStatus, setLocalIgnoreStatus] = useState<Record<string, boolean>>({});

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
    activeFilterCount,
  } = useChannelVideoFilters();

  const { deleteVideosByYoutubeIds, loading: deleteLoading } = useVideoDeletion();

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
  const useInfiniteScroll = config.channelVideosHotLoad ?? true;

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
    tabType: selectedTab,
    token,
    minDuration: filters.minDuration,
    maxDuration: filters.maxDuration,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  // Update available tabs from video fetch response if available
  useEffect(() => {
    if (availableTabsFromVideos && availableTabsFromVideos.length > 0) {
      setAvailableTabs(availableTabsFromVideos);
    }
  }, [availableTabsFromVideos]);

  // Clear local ignore status overrides when videos are refetched (page change, tab change, etc)
  useEffect(() => {
    setLocalIgnoreStatus({});
  }, [page, selectedTab, hideDownloaded, searchQuery, sortBy, sortOrder, maxRating, filters.minDuration, filters.maxDuration, filters.dateFrom, filters.dateTo]);

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

  // Apply local ignore status overrides to videos (for optimistic updates)
  const videosWithOverrides = useMemo(() => {
    return videos.map(video => {
      // If we have a local override for this video, use it
      if (video.youtube_id in localIgnoreStatus) {
        return {
          ...video,
          ignored: localIgnoreStatus[video.youtube_id],
          ignored_at: localIgnoreStatus[video.youtube_id] ? new Date().toISOString() : null,
        };
      }
      return video;
    });
  }, [videos, localIgnoreStatus]);

  // Videos are already filtered, sorted, and paginated by the server
  const paginatedVideos = videosWithOverrides;

  // Use server-provided total count for pagination/infinite scroll
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const hasNextPage = page < totalPages;
  const selectionMode = checkedBoxes.length > 0 ? 'download' : selectedForDeletion.length > 0 ? 'delete' : null;
  const canSelectDownload = selectionMode !== 'delete';
  const canSelectDeletion = selectionMode !== 'download';

  // Event handlers
  const handleCheckChange = useCallback((videoId: string, isChecked: boolean) => {
    if (selectedForDeletion.length > 0 && isChecked) {
      setErrorMessage('Clear delete selections before choosing videos to download.');
      return;
    }
    setCheckedBoxes((prevState) => {
      if (isChecked) {
        return [...prevState, videoId];
      } else {
        return prevState.filter((id) => id !== videoId);
      }
    });
  }, [selectedForDeletion.length]);

  const handleDeletionChange = useCallback((videoId: string, isChecked: boolean) => {
    if (checkedBoxes.length > 0 && isChecked) {
      setErrorMessage('Clear download selections before choosing videos to delete.');
      return;
    }
    setSelectedForDeletion((prevState) => {
      if (isChecked) {
        return [...prevState, videoId];
      }
      return prevState.filter((id) => id !== videoId);
    });
  }, [checkedBoxes.length]);

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

  const handleTabChange = (event: React.SyntheticEvent, newTab: string) => {
    // Prevent tab changes while videos are still loading
    if (videosLoading) {
      return;
    }

    setSelectedTab(newTab);
    setPage(1); // Reset to first page when changing tabs
    setCheckedBoxes([]); // Clear selections when changing tabs
    setSelectedForDeletion([]); // Clear deletion selections when changing tabs
    clearAllFilters(); // Clear filters when changing tabs
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
    if (!selectionMode) return null;

    const isDownloadAction = selectionMode === 'download';
    const count = isDownloadAction ? checkedBoxes.length : selectedForDeletion.length;
    const icon = isDownloadAction ? <DownloadIcon size={24} /> : <DeleteIcon size={24} />;
    const handleActionClick = isDownloadAction ? handleDownloadClick : handleDeleteClick;

    if (typeof window === 'undefined') return null;

    return createPortal(
      <Grow in>
        <div style={{ position: 'fixed', bottom: isMobile ? 84 : 56, right: isMobile ? 20 : 56, transform: 'translateY(-50%)', zIndex: 1399 }}>
          <Badge
            badgeContent={count}
            color={isDownloadAction ? 'primary' : 'error'}
            overlap="circular"
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <button
              onClick={handleActionClick}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: isDownloadAction ? 'var(--fab-primary-bg)' : 'var(--fab-error-bg)',
                color: isDownloadAction ? 'var(--fab-primary-fg)' : 'var(--fab-error-fg)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-hard)',
              }}
            >
              {icon}
            </button>
          </Badge>
        </div>
      </Grow>,
      document.body
    );
  };

  return (
    <>
      <Card elevation={3} style={{ marginBottom: 16 }}>
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
          autoDownloadsEnabled={selectedTab ? (tabAutoDownloadStatus[selectedTab] ?? autoDownloadsEnabled) : autoDownloadsEnabled}
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
          onSelectAll={handleSelectAll}
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
          onClearAll={clearAllFilters}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          hideDateFilter={selectedTab === 'shorts'}
          filtersExpanded={filtersExpanded}
        />

        {/* Tabs */}
          { availableTabs.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
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

        {/* Content area */}
        <div style={{ padding: 16, position: 'relative', minHeight: '100vh' }}>
          {videoFailed && videos.length === 0 && !hasActiveFilters && !searchQuery ? (
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
                {hasActiveFilters || searchQuery
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
                      onMobileTooltip={setMobileTooltip}
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
                      onMobileTooltip={setMobileTooltip}
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
                  onMobileTooltip={setMobileTooltip}
                />
              )}

            </>
          )}

          {renderSelectionAction()}

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

          {totalPages > 1 && (
            <nav role="navigation" aria-label="pagination" style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button aria-label="go to first page" onClick={() => { setPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page <= 1} style={{ padding: '4px 8px', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'inherit' }}>«</button>
              <button aria-label="go to previous page" onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page <= 1} style={{ padding: '4px 8px', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'inherit' }}>‹</button>
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 3, totalPages - 6));
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <button aria-label={`go to page ${p}`} key={p} onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ padding: '4px 10px', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 4, background: p === page ? 'var(--primary)' : 'transparent', color: p === page ? 'white' : 'inherit' }}>{p}</button>
                );
              })}
              <button aria-label="go to next page" onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page >= totalPages} style={{ padding: '4px 8px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'inherit' }}>›</button>
              <button aria-label="go to last page" onClick={() => { setPage(totalPages); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={page >= totalPages} style={{ padding: '4px 8px', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'inherit' }}>»</button>
            </nav>
          )}
        </div>
      </Card>
      <ChannelVideosDialogs
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
    </>
  );
}

export default ChannelVideos;
