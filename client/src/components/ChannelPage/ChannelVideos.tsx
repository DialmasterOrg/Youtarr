import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Pagination,
  Tabs,
  Tab,
} from '@mui/material';

import DownloadIcon from '@mui/icons-material/Download';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import AlarmOnIcon from '@mui/icons-material/AlarmOn';

import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
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
import { useConfig } from '../../hooks/useConfig';
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

  // View and display states
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'list' : 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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
  }, [page, selectedTab, hideDownloaded, searchQuery, sortBy, sortOrder]);

  const { config } = useConfig(token);
  const hasChannelOverride = Boolean(channelVideoQuality);
  const defaultResolution = channelVideoQuality || config.preferredResolution || '1080';
  const defaultResolutionSource: 'channel' | 'global' = hasChannelOverride ? 'channel' : 'global';

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

  // Use server-provided total count for pagination
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

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

  const handleSelectAll = useCallback(() => {
    const selectableVideos = paginatedVideos.filter((video) => {
      const status = getVideoStatus(video);
      return status === 'never_downloaded' || status === 'missing' || status === 'ignored';
    });
    const videoIds = selectableVideos.map((video) => video.youtube_id);
    setCheckedBoxes((prevState) => {
      const newIds = videoIds.filter((id) => !prevState.includes(id));
      return [...prevState, ...newIds];
    });
  }, [paginatedVideos]);

  const handleClearSelection = useCallback(() => {
    setCheckedBoxes([]);
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
    navigate('/downloads');
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
    setSelectedForDeletion(prev => {
      if (prev.includes(youtubeId)) {
        return prev.filter(id => id !== youtubeId);
      } else {
        return [...prev, youtubeId];
      }
    });
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

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
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

  // Swipe handlers for mobile
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (page < totalPages) {
        setPage(page + 1);
      }
    },
    onSwipedRight: () => {
      if (page > 1) {
        setPage(page - 1);
      }
    },
    trackMouse: false,
  });

  // Mobile drawer render
  const renderDrawer = () => (
    <Drawer
      anchor="bottom"
      open={mobileDrawerOpen}
      onClose={() => setMobileDrawerOpen(false)}
      sx={{
        '& .MuiDrawer-paper': {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '70vh',
        },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Batch Actions</Typography>
          <IconButton onClick={() => setMobileDrawerOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>

        <List>
          <ListItem button onClick={handleSelectAll}>
            <ListItemIcon><SelectAllIcon /></ListItemIcon>
            <ListItemText primary="Select All This Page" secondary={`Select videos that can be downloaded`} />
          </ListItem>

          <ListItem button onClick={handleClearSelection}>
            <ListItemIcon><ClearIcon /></ListItemIcon>
            <ListItemText primary="Clear Selection" secondary={`${checkedBoxes.length} selected`} />
          </ListItem>

          <Divider sx={{ my: 1 }} />

          <ListItem button onClick={handleDownloadClick} disabled={checkedBoxes.length === 0}>
            <ListItemIcon><DownloadIcon /></ListItemIcon>
            <ListItemText
              primary={`Download ${checkedBoxes.length} ${checkedBoxes.length === 1 ? 'Video' : 'Videos'}`}
              secondary={getMissingVideoCount() > 0 ? `${getMissingVideoCount()} missing files will be re-downloaded` : undefined}
            />
          </ListItem>

          <ListItem button onClick={handleDeleteClick} disabled={selectedForDeletion.length === 0 || deleteLoading}>
            <ListItemIcon><DeleteIcon color={selectedForDeletion.length > 0 ? "error" : "disabled"} /></ListItemIcon>
            <ListItemText
              primary={`Delete ${selectedForDeletion.length} ${selectedForDeletion.length === 1 ? 'Video' : 'Videos'}`}
              secondary={selectedForDeletion.length > 0 ? `Remove videos from disk` : 'No videos selected for deletion'}
            />
          </ListItem>
        </List>
      </Box>
    </Drawer>
  );

  // Mobile floating action buttons
  const renderFAB = () => {
    // if (!isMobile) return null;

    const hasDownloadSelection = checkedBoxes.length > 0;
    const hasDeletionSelection = selectedForDeletion.length > 0;

    if (!hasDownloadSelection && !hasDeletionSelection) return null;

    return (
      <>
        {/* Download FAB */}
        {hasDownloadSelection && (
          <Zoom in={hasDownloadSelection}>
            <Fab
              color="primary"
              sx={{
                position: 'fixed',
                bottom: hasDeletionSelection ? 88 : 16,
                right: 16,
                zIndex: theme.zIndex.fab,
              }}
              onClick={() => setMobileDrawerOpen(true)}
            >
              <Badge badgeContent={checkedBoxes.length} color="error">
                <DownloadIcon />
              </Badge>
            </Fab>
          </Zoom>
        )}

        {/* Delete FAB */}
        {hasDeletionSelection && (
          <Zoom in={hasDeletionSelection}>
            <Fab
              color="error"
              sx={{
                position: 'fixed',
                bottom: 16,
                right: 16,
                zIndex: theme.zIndex.fab,
              }}
              onClick={handleDeleteClick}
            >
              <Badge badgeContent={selectedForDeletion.length} color="primary">
                <DeleteIcon />
              </Badge>
            </Fab>
          </Zoom>
        )}
      </>
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
          deleteLoading={deleteLoading}
          paginatedVideos={paginatedVideos}
          autoDownloadsEnabled={selectedTab ? (tabAutoDownloadStatus[selectedTab] ?? autoDownloadsEnabled) : autoDownloadsEnabled}
          selectedTab={selectedTab || 'videos'}
          onViewModeChange={handleViewModeChange}
          onSearchChange={(query) => {
            setSearchQuery(query);
            setPage(1);
          }}
          onHideDownloadedChange={(hide) => {
            setHideDownloaded(hide);
            setPage(1);
          }}
          onAutoDownloadChange={handleAutoDownloadChange}
          onRefreshClick={handleRefreshClick}
          onDownloadClick={handleDownloadClick}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onDeleteClick={handleDeleteClick}
          onBulkIgnoreClick={handleBulkIgnore}
          onInfoIconClick={(tooltip) => setMobileTooltip(tooltip)}
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

        {/* Pagination - directly under tabs */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size={isMobile ? 'small' : 'medium'}
              siblingCount={isMobile ? 0 : 1}
            />
          </Box>
        )}

        {/* Content area */}
        <Box sx={{ p: 2 }} {...(isMobile ? handlers : {})}>
          {videoFailed && videos.length === 0 ? (
            <Alert severity="error">
              Failed to fetch channel videos. Please try again later.
            </Alert>
          ) : videosLoading ? (
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
                      onCheckChange={handleCheckChange}
                      onHoverChange={setHoveredVideo}
                      onToggleDeletion={toggleDeletionSelection}
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
                      onCheckChange={handleCheckChange}
                      onToggleDeletion={toggleDeletionSelection}
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
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onCheckChange={handleCheckChange}
                  onSelectAll={handleSelectAll}
                  onClearSelection={handleClearSelection}
                  onSortChange={handleSortChange}
                  onToggleDeletion={toggleDeletionSelection}
                  onToggleIgnore={toggleIgnore}
                  onMobileTooltip={setMobileTooltip}
                />
              )}

              {/* Pagination */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={handlePageChange}
                  color="primary"
                  size={isMobile ? 'small' : 'medium'}
                  siblingCount={isMobile ? 0 : 1}
                />
              </Box>
            </>
          )}
        </Box>
      </Card>

      {/* Mobile components */}
      {renderFAB()}
      {renderDrawer()}

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
