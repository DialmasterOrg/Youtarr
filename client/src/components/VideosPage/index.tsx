import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { debounce } from 'lodash';
import { useSwipeable } from 'react-swipeable';
import {
  Alert,
  Box,
  Button,
  Grid,
  Snackbar,
  Stack,
  Typography,
} from '../ui';
import { Trash2 as DeleteIcon, X as ClearIcon } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useConfig } from '../../hooks/useConfig';
import { useThemeEngine } from '../../contexts/ThemeEngineContext';
import { VideoData } from '../../types/VideoData';
import DeleteVideosDialog from '../shared/DeleteVideosDialog';
import { useVideoDeletion } from '../shared/useVideoDeletion';
import ChangeRatingDialog from '../shared/ChangeRatingDialog';
import VideoActionsDropdown from '../shared/VideoActionsDropdown';
import PageControls from '../shared/PageControls';
import { ActionBar } from '../shared/ActionBar';
import { useVideoProtection } from '../shared/useVideoProtection';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';
import VideosHeader from './components/VideosHeader';
import VideosFilters from './components/VideosFilters';
import VideosResults from './components/VideosResults';
import { useVideosData } from './hooks/useVideosData';
import { useVideosViewMode } from './hooks/useVideosViewMode';

interface VideosPageProps {
  token: string | null;
}

function videoDataToModalData(video: VideoData): VideoModalData {
  return {
    youtubeId: video.youtubeId,
    title: video.youTubeVideoName,
    channelName: video.youTubeChannelName,
    thumbnailUrl: `/images/videothumb-${video.youtubeId}.jpg`,
    duration: video.duration,
    publishedAt: video.originalDate || null,
    addedAt: video.timeCreated || null,
    mediaType: video.media_type || 'video',
    status: video.removed ? 'missing' : 'downloaded',
    isDownloaded: !video.removed,
    filePath: video.filePath || null,
    fileSize: video.fileSize ? Number(video.fileSize) : null,
    audioFilePath: video.audioFilePath || null,
    audioFileSize: video.audioFileSize ? Number(video.audioFileSize) : null,
    isProtected: video.protected || false,
    isIgnored: false,
    normalizedRating: video.normalized_rating || null,
    ratingSource: video.rating_source || null,
    databaseId: video.id,
    channelId: video.channel_id || null,
  };
}

function VideosPage({ token }: VideosPageProps) {
  const isMobile = useMediaQuery('(max-width: 599px)');
  const { themeMode } = useThemeEngine();
  const [viewMode, setViewMode] = useVideosViewMode(isMobile);

  const [page, setPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState<'published' | 'added'>('added');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [maxRatingFilter, setMaxRatingFilter] = useState('');
  const [protectedFilter, setProtectedFilter] = useState(false);

  const [selectedVideos, setSelectedVideos] = useState<number[]>([]);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalVideo, setModalVideo] = useState<VideoData | null>(null);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { deleteVideos, loading: deleteLoading } = useVideoDeletion();
  const configState = useConfig(token);
  const useInfiniteScroll = configState?.config?.channelVideosHotLoad ?? false;
  const {
    toggleProtection,
    successMessage: protectionSuccess,
    error: protectionError,
    clearMessages: clearProtectionMessages,
  } = useVideoProtection(token);

  const videosPerPage = isMobile ? 6 : 12;

  const {
    videos,
    setVideos,
    totalVideos,
    totalPages,
    uniqueChannels,
    enabledChannels,
    loading,
    loadError,
    refetch,
  } = useVideosData({
    token,
    page,
    videosPerPage,
    orderBy,
    sortOrder,
    search,
    channelFilter,
    dateFrom,
    dateTo,
    maxRatingFilter,
    protectedFilter,
    useInfiniteScroll,
  });

  const debouncedSearch = useMemo(
    () =>
      debounce((searchValue: string) => {
        setSearch(searchValue);
        setPage(1);
      }, 500),
    []
  );

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  useEffect(() => {
    setVideos([]);
    setPage(1);
  }, [useInfiniteScroll, setVideos]);

  useEffect(() => {
    if (!useInfiniteScroll) return;
    if (!loadMoreRef.current) return;
    if (loading || page >= totalPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setPage((prev) => (prev < totalPages ? prev + 1 : prev));
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 160px 0px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [useInfiniteScroll, loading, page, totalPages]);

  const handleImageError = (youtubeId: string) => {
    setImageErrors((prev) => ({ ...prev, [youtubeId]: true }));
  };

  const handleChannelFilterChange = (value: string) => {
    setChannelFilter(value);
    setPage(1);
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    setPage(1);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    setPage(1);
  };

  const handleClearDates = () => {
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleMaxRatingChange = (value: string) => {
    setMaxRatingFilter(value);
    setPage(1);
  };

  const handleProtectedFilterChange = (value: boolean) => {
    setProtectedFilter(value);
    setPage(1);
  };

  const handleSortChange = (newOrderBy: 'published' | 'added') => {
    if (orderBy === newOrderBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(newOrderBy);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableVideos = videos.filter((v) => !v.removed);
      setSelectedVideos(selectableVideos.map((v) => v.id));
    } else {
      setSelectedVideos([]);
    }
  };

  const handleSelectVideo = (videoId: number) => {
    setSelectedVideos((prev) =>
      prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [...prev, videoId]
    );
  };

  const handleDeleteClick = () => setDeleteDialogOpen(true);
  const handleDeleteCancel = () => setDeleteDialogOpen(false);

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);
    const videosToDelete = selectedVideos;
    const result = await deleteVideos(videosToDelete, token);

    if (result.success) {
      setSuccessMessage(
        `Successfully deleted ${result.deleted.length} video${
          result.deleted.length !== 1 ? 's' : ''
        }`
      );
      setSelectedVideos([]);
      refetch();
    } else {
      const deletedCount = result.deleted.length;
      const failedCount = result.failed.length;
      if (deletedCount > 0) {
        setSuccessMessage(
          `Deleted ${deletedCount} video${deletedCount !== 1 ? 's' : ''}, but ${failedCount} failed`
        );
        setSelectedVideos([]);
        refetch();
      } else {
        setErrorMessage(
          `Failed to delete videos: ${result.failed[0]?.error || 'Unknown error'}`
        );
      }
    }
  };

  const handleDeleteSingleVideo = (videoId: number) => {
    setSelectedVideos([videoId]);
    setDeleteDialogOpen(true);
  };

  const handleChangeRatingClick = () => setRatingDialogOpen(true);

  const handleApplyRating = async (rating: string | null) => {
    if (!token) return;
    const videoIdsToUpdate = selectedVideos;
    try {
      await axios.post(
        '/api/videos/rating',
        { videoIds: videoIdsToUpdate, rating },
        { headers: { 'x-access-token': token } }
      );
      setSuccessMessage(
        `Successfully updated content rating for ${videoIdsToUpdate.length} video(s)`
      );
      setSelectedVideos([]);
      refetch();
    } catch (error: unknown) {
      console.error('Failed to update ratings:', error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || 'Failed to update content ratings'
        : 'Failed to update content ratings';
      setErrorMessage(message);
    }
  };

  const handleToggleProtection = async (videoId: number) => {
    const video = videos.find((v) => v.id === videoId);
    if (!video) return;
    const currentState = video.protected || false;
    const newState = await toggleProtection(video.id, currentState);
    if (newState !== undefined) {
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, protected: newState } : v))
      );
    }
  };

  const handleOpenModal = (video: VideoData) => {
    setModalVideo(video);
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (useInfiniteScroll) return;
      if (page < totalPages) setPage(page + 1);
    },
    onSwipedRight: () => {
      if (useInfiniteScroll) return;
      if (page > 1) setPage(page - 1);
    },
    trackMouse: true,
  });

  const renderMobileSelectionBar = () => {
    if (!isMobile || selectedVideos.length === 0 || typeof window === 'undefined') {
      return null;
    }

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
            {selectedVideos.length} video{selectedVideos.length !== 1 ? 's' : ''} selected
          </Typography>
          <Box className="flex gap-2 flex-wrap justify-end" style={{ marginLeft: 'auto' }}>
            <Button size="small" onClick={handleChangeRatingClick} className="intent-warning">
              Rating
            </Button>
            <Button
              size="small"
              onClick={handleDeleteClick}
              className="intent-danger"
              startIcon={<DeleteIcon size={14} />}
            >
              Delete
            </Button>
            <Button
              size="small"
              onClick={() => setSelectedVideos([])}
              className="intent-base"
              startIcon={<ClearIcon size={14} />}
            >
              Clear
            </Button>
          </Box>
        </ActionBar>
      </div>,
      document.body
    );
  };

  return (
    <Box className="mb-4">
      <VideosHeader
        totalVideos={totalVideos}
        isMobile={isMobile}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearchChange={debouncedSearch}
      />

      {loadError && (
        <Alert severity="error" className="mb-4">
          {loadError}
        </Alert>
      )}

      <VideosFilters
        isMobile={isMobile}
        showSortControls={!(viewMode === 'table' && !isMobile)}
        channelFilter={channelFilter}
        uniqueChannels={uniqueChannels}
        dateFrom={dateFrom}
        dateTo={dateTo}
        maxRatingFilter={maxRatingFilter}
        protectedFilter={protectedFilter}
        orderBy={orderBy}
        sortOrder={sortOrder}
        onChannelFilterChange={handleChannelFilterChange}
        onDateFromChange={handleDateFromChange}
        onDateToChange={handleDateToChange}
        onClearDates={handleClearDates}
        onMaxRatingChange={handleMaxRatingChange}
        onProtectedFilterChange={handleProtectedFilterChange}
        onSortChange={handleSortChange}
      />

      {selectedVideos.length > 0 && !isMobile && (
        <Stack direction="row" spacing={2} alignItems="center" className="mb-4">
          <Typography variant="body2" color="text.secondary">
            {selectedVideos.length} video{selectedVideos.length !== 1 ? 's' : ''} selected
          </Typography>
          <VideoActionsDropdown
            selectedVideosCount={selectedVideos.length}
            onContentRating={handleChangeRatingClick}
            onDelete={handleDeleteClick}
            disabled={deleteLoading}
          />
          <Button
            variant="outlined"
            onClick={() => setSelectedVideos([])}
            className="text-foreground border-border hover:bg-muted hover:border-foreground"
          >
            Clear Selection
          </Button>
        </Stack>
      )}

      {!useInfiniteScroll && totalPages > 1 && (
        <Grid
          container
          spacing={2}
          style={{
            marginTop: 8,
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <PageControls
            page={page}
            totalPages={totalPages}
            onPageChange={(newPage) => setPage(newPage)}
            compact={isMobile}
          />
        </Grid>
      )}

      <div {...swipeHandlers}>
        <VideosResults
          videos={videos}
          loading={loading}
          viewMode={viewMode}
          isMobile={isMobile}
          placeholderCount={videosPerPage}
          selectedVideos={selectedVideos}
          enabledChannels={enabledChannels}
          imageErrors={imageErrors}
          orderBy={orderBy}
          sortOrder={sortOrder}
          deleteDisabled={deleteLoading}
          onSelectAll={handleSelectAll}
          onToggleSelect={handleSelectVideo}
          onSortChange={handleSortChange}
          onOpenModal={handleOpenModal}
          onToggleProtection={handleToggleProtection}
          onDeleteSingle={handleDeleteSingleVideo}
          onImageError={handleImageError}
        />
      </div>

      {useInfiniteScroll && (
        <>
          <div
            ref={loadMoreRef}
            style={{ height: 24, width: '100%', marginTop: 12, marginBottom: 16 }}
          />
          {loading && videos.length > 0 && page < totalPages && (
            <Box style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px 0' }}>
              <Typography variant="caption" color="text.secondary">
                Loading more videos...
              </Typography>
            </Box>
          )}
          {!loading && page >= totalPages && videos.length > 0 && (
            <Typography
              variant="caption"
              color="text.secondary"
              align="center"
              style={{ display: 'block', paddingBottom: 12 }}
            >
              You&apos;re all caught up.
            </Typography>
          )}
        </>
      )}

      {renderMobileSelectionBar()}

      <DeleteVideosDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        videoCount={selectedVideos.length}
      />

      <ChangeRatingDialog
        open={ratingDialogOpen}
        onClose={() => setRatingDialogOpen(false)}
        onApply={handleApplyRating}
        selectedCount={selectedVideos.length}
      />

      <Snackbar
        open={successMessage !== null}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert onClose={() => setSuccessMessage(null)} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={errorMessage !== null}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
      >
        <Alert onClose={() => setErrorMessage(null)} severity="error">
          {errorMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={protectionSuccess !== null}
        autoHideDuration={4000}
        onClose={clearProtectionMessages}
      >
        <Alert onClose={clearProtectionMessages} severity="success">
          {protectionSuccess}
        </Alert>
      </Snackbar>
      <Snackbar
        open={protectionError !== null}
        autoHideDuration={4000}
        onClose={clearProtectionMessages}
      >
        <Alert onClose={clearProtectionMessages} severity="error">
          {protectionError}
        </Alert>
      </Snackbar>

      {modalVideo && (
        <VideoModal
          open
          onClose={() => setModalVideo(null)}
          video={videoDataToModalData(modalVideo)}
          token={token}
          onVideoDeleted={() => {
            setModalVideo(null);
            refetch();
          }}
          onProtectionChanged={(youtubeId, isProtected) => {
            setVideos((prev) =>
              prev.map((v) =>
                v.youtubeId === youtubeId ? { ...v, protected: isProtected } : v
              )
            );
          }}
          onRatingChanged={(youtubeId, rating) => {
            setVideos((prev) =>
              prev.map((v) =>
                v.youtubeId === youtubeId
                  ? {
                      ...v,
                      normalized_rating: rating,
                      rating_source: rating ? 'Manual Override' : null,
                    }
                  : v
              )
            );
          }}
        />
      )}
    </Box>
  );
}

export default VideosPage;
