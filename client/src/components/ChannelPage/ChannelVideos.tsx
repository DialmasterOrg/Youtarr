import React, { useState, useCallback } from 'react';
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
} from '@mui/material';

import DownloadIcon from '@mui/icons-material/Download';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';

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
import { useConfig } from '../../hooks/useConfig';
import { useTriggerDownloads } from '../../hooks/useTriggerDownloads';

interface ChannelVideosProps {
  token: string | null;
}

type ViewMode = 'table' | 'grid' | 'list';
type SortBy = 'date' | 'title' | 'duration' | 'size';
type SortOrder = 'asc' | 'desc';

function ChannelVideos({ token }: ChannelVideosProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // View and display states
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'list' : 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

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

  const { deleteVideosByYoutubeIds, loading: deleteLoading } = useVideoDeletion();

  const { channel_id } = useParams();

  // Use custom hooks for data fetching
  const {
    videos,
    totalCount,
    oldestVideoDate,
    videoFailed,
    refetch: refetchVideos,
  } = useChannelVideos({
    channelId: channel_id,
    page,
    pageSize,
    hideDownloaded,
    searchQuery,
    sortBy,
    sortOrder,
    token,
  });

  const { config } = useConfig(token);
  const defaultResolution = config.preferredResolution || '1080';

  const { triggerDownloads } = useTriggerDownloads(token);

  const {
    refreshVideos,
    loading: fetchingAllVideos,
    error: fetchAllError,
    clearError: clearFetchAllError,
  } = useRefreshChannelVideos(channel_id, page, pageSize, hideDownloaded, token);
  const navigate = useNavigate();

  // Videos are already filtered, sorted, and paginated by the server
  const paginatedVideos = videos;

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
      return status === 'never_downloaded' || status === 'missing';
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
        }
      : undefined;

    await triggerDownloads({ urls, overrideSettings });

    setCheckedBoxes([]);
    navigate('/downloads');
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
  const renderMobileDrawer = () => (
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
  const renderMobileFAB = () => {
    if (!isMobile) return null;

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
          page={page}
          totalPages={totalPages}
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
          onPageChange={handlePageChange}
        />

        {/* Content area */}
        <Box sx={{ p: 2 }} {...(isMobile ? handlers : {})}>
          {videoFailed && videos.length === 0 ? (
            <Alert severity="error">
              Failed to fetch channel videos. Please try again later.
            </Alert>
          ) : videos.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Loading channel videos...
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
      {renderMobileFAB()}
      {renderMobileDrawer()}

      {/* Dialogs and Snackbars */}
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
