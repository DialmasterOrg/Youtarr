import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Box,
  Typography,
  Alert,
  Skeleton,
  Grid,
  Zoom,
  Fab,
  Badge,
  Tabs,
  Tab,
  Pagination,
  Portal,
} from '@mui/material';

import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import AlarmOnIcon from '@mui/icons-material/AlarmOn';

import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
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
import { useConfig } from '../../hooks/useConfig';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { useTriggerDownloads } from '../../hooks/useTriggerDownloads';

interface ChannelVideosProps {
  token: string | null;
  channelAutoDownloadTabs?: string;
  channelId?: string;
  channelVideoQuality?: string | null;
}

type ViewMode = 'table' | 'grid' | 'list';
type SortBy = 'date' | 'title' | 'duration' | 'size';
type SortOrder = 'asc' | 'desc';

function ChannelVideos({ token, channelAutoDownloadTabs, channelId: propChannelId, channelVideoQuality }: ChannelVideosProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { themeMode } = useThemeEngine();

  // View and display states
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'list' : 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [maxRating, setMaxRating] = useState('');

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
    maxRating,
    token,
    append: useInfiniteScroll && page > 1,
    resetKey: JSON.stringify({ channelId, hideDownloaded, searchQuery, sortBy, sortOrder, selectedTab, maxRating, pageSize }),
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
  }, [page, selectedTab, hideDownloaded, searchQuery, sortBy, sortOrder, maxRating]);

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

  const { triggerDownloads } = useTriggerDownloads(token);

  const {
    refreshVideos,
    loading: fetchingAllVideos,
    error: fetchAllError,
    clearError: clearFetchAllError,
  } = useRefreshChannelVideos(channelId, page, pageSize, hideDownloaded, selectedTab, token);
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

    if (!isEnabled) return label;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {label}
        <AlarmOnIcon sx={{ fontSize: '1rem', color: 'error.main' }} />
      </Box>
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

    if (typeof window !== 'undefined' && themeMode === 'playful') {
      console.debug('[Playful Sentinel]', {
        top: loadMoreRef.current?.getBoundingClientRect().top,
        bottom: loadMoreRef.current?.getBoundingClientRect().bottom,
        height: loadMoreRef.current?.getBoundingClientRect().height,
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
        page,
      });
    }

    return () => {
      observer.disconnect();
    };
  }, [videosLoading, hasNextPage, useInfiniteScroll, page, themeMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || themeMode !== 'playful') return;
    const rect = loadMoreRef.current?.getBoundingClientRect();
    console.debug('[Playful Sentinel Ping]', {
      top: rect?.top,
      bottom: rect?.bottom,
      height: rect?.height,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      videosLoading,
    });
  }, [videosLoading, page, themeMode]);

  const renderSelectionAction = () => {
    if (!selectionMode) return null;

    const isDownloadAction = selectionMode === 'download';
    const count = isDownloadAction ? checkedBoxes.length : selectedForDeletion.length;
    const icon = isDownloadAction ? <DownloadIcon /> : <DeleteIcon />;
    const handleActionClick = isDownloadAction ? handleDownloadClick : handleDeleteClick;

    return (
      <Portal container={typeof window !== 'undefined' ? document.body : undefined}>
        <Zoom in>
          <Badge
            badgeContent={count}
            color={isDownloadAction ? 'primary' : 'error'}
            overlap="circular"
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={(theme) => ({
              position: 'fixed',
              bottom: isMobile ? 84 : 56,
              right: isMobile ? 20 : 56,
              transform: 'translateY(-50%)',
              zIndex: theme.zIndex.snackbar - 1,
              '& .MuiBadge-badge': {
                border: `2px solid ${theme.palette.background.paper}`,
                fontWeight: 800,
                minWidth: 22,
                height: 22,
                fontSize: '0.75rem',
                zIndex: theme.zIndex.snackbar + 1,
                boxShadow: 'var(--shadow-hard)',
              },
            })}
            slotProps={{
              badge: {
                sx: (theme) => ({
                  zIndex: theme.zIndex.snackbar + 1,
                }),
              },
            }}
          >
            <Fab
              onClick={handleActionClick}
              sx={(theme) => {
                const paletteKey = isDownloadAction ? 'primary' : 'error';
                const palette = theme.palette[paletteKey];
                return {
                  bgcolor: palette.main,
                  color: palette.contrastText,
                  border: '2px solid',
                  borderColor: palette.main,
                  boxShadow: 'var(--shadow-hard)',
                  '&:hover': {
                    bgcolor: palette.dark,
                    borderColor: palette.dark,
                    color: palette.contrastText,
                  },
                  '&:focus-visible': {
                    outline: `3px solid ${theme.palette.primary.main}`,
                    outlineOffset: 3,
                  },
                };
              }}
            >
              {icon}
            </Fab>
          </Badge>
        </Zoom>
      </Portal>
    );
  };

  return (
    <>
      <Card elevation={3} sx={{ mb: 2 }}>
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
        />

        {/* Tabs */}
          { availableTabs.length > 0 && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
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
          </Box>
        )}

        {/* Content area */}
        <Box sx={{ p: 2, position: 'relative', minHeight: '100vh' }}>
          {videoFailed && videos.length === 0 ? (
            <Alert severity="error">
              Failed to fetch channel videos. Please try again later.
            </Alert>
          ) : videosLoading && videos.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Loading and fetching/indexing new videos for this channel tab...
              </Typography>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                {[...Array(pageSize)].map((_, index) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={`skeleton-${index}`}>
                    <Skeleton variant="rectangular" height={200} />
                    <Skeleton variant="text" sx={{ mt: 1 }} />
                    <Skeleton variant="text" width="60%" />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : videos.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No videos found
              </Typography>
            </Box>
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
                <Box>
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
                </Box>
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
              <Box
                ref={loadMoreRef}
                sx={{
                  height: 24,
                  width: '100%',
                  mt: 4,
                  mb: 4,
                }}
              />
              {videosLoading && videos.length > 0 && hasNextPage && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <Box className="playful-loading-dots" aria-label="Loading more videos">
                    <span />
                    <span />
                    <span />
                  </Box>
                </Box>
              )}
              {!hasNextPage && videos.length > 0 && (
                <Typography variant="caption" color="text.secondary" align="center" sx={{ display: 'block', py: 2 }}>
                  You're all caught up.
                </Typography>
              )}
            </>
          )}

          {!useInfiniteScroll && totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                color="primary"
                onChange={(_, value) => {
                  setPage(value);
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </Box>
      </Card>

      {/* Dialogs and Snackbars */}
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
