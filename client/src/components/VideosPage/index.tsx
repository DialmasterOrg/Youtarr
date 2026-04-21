import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useSwipeable } from 'react-swipeable';
import { Alert, Box, Grid, Snackbar, Typography } from '../ui';
import { Trash2 as DeleteIcon, Star as RatingIcon } from '../../lib/icons';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useConfig } from '../../hooks/useConfig';
import { VideoData } from '../../types/VideoData';
import DeleteVideosDialog from '../shared/DeleteVideosDialog';
import { useVideoDeletion } from '../shared/useVideoDeletion';
import ChangeRatingDialog from '../shared/ChangeRatingDialog';
import PageControls from '../shared/PageControls';
import { useVideoProtection } from '../shared/useVideoProtection';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';
import VideoCard from './components/VideoCard';
import VideosTable from './components/VideosTable';
import VideosListMobile from './components/VideosListMobile';
import { useVideosData } from './hooks/useVideosData';
import { useVideosViewMode, type VideosViewMode } from './hooks/useVideosViewMode';
import {
  VideoListContainer,
  useVideoListState,
  useVideoSelection,
  type FilterConfig,
  type SelectionAction,
  type VideoListViewMode,
  type SortConfig,
} from '../shared/VideoList';

interface VideosPageProps {
  token: string | null;
}

const VIEW_MODE_STORAGE_KEY = 'youtarr:videosPageViewMode';

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
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [viewMode, setViewModeLegacy] = useVideosViewMode(isMobile);

  const listState = useVideoListState({
    initialViewMode: (isMobile ? 'list' : 'table') as VideoListViewMode,
    viewModeStorageKey: VIEW_MODE_STORAGE_KEY,
  });

  // Sync shared list state to the legacy hook (so persistence and viewMode stay aligned).
  useEffect(() => {
    if (listState.viewMode !== viewMode) {
      setViewModeLegacy(listState.viewMode as VideosViewMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listState.viewMode]);

  const [page, setPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState<'published' | 'added'>('added');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [maxRatingFilter, setMaxRatingFilter] = useState('');
  const [protectedFilter, setProtectedFilter] = useState(false);

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
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
    search: listState.search,
    channelFilter,
    dateFrom,
    dateTo,
    maxRatingFilter,
    protectedFilter,
    useInfiniteScroll,
  });

  useEffect(() => {
    setVideos([]);
    setPage(1);
  }, [useInfiniteScroll, setVideos]);

  useEffect(() => {
    setPage(1);
  }, [listState.search, orderBy, sortOrder]);

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
      { root: null, rootMargin: '0px 0px 160px 0px', threshold: 0 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [useInfiniteScroll, loading, page, totalPages]);

  const handleImageError = (youtubeId: string) => {
    setImageErrors((prev) => ({ ...prev, [youtubeId]: true }));
  };

  const handleSortChange = (newOrderBy: 'published' | 'added') => {
    if (orderBy === newOrderBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(newOrderBy);
      setSortOrder('desc');
    }
  };

  const handleDeleteConfirm = async (selectedIds: number[]) => {
    setDeleteDialogOpen(false);
    const result = await deleteVideos(selectedIds, token);
    if (result.success) {
      setSuccessMessage(
        `Successfully deleted ${result.deleted.length} video${result.deleted.length !== 1 ? 's' : ''}`
      );
      selection.clear();
      refetch();
    } else {
      const deletedCount = result.deleted.length;
      const failedCount = result.failed.length;
      if (deletedCount > 0) {
        setSuccessMessage(
          `Deleted ${deletedCount} video${deletedCount !== 1 ? 's' : ''}, but ${failedCount} failed`
        );
        selection.clear();
        refetch();
      } else {
        setErrorMessage(
          `Failed to delete videos: ${result.failed[0]?.error || 'Unknown error'}`
        );
      }
    }
  };

  const handleApplyRating = async (rating: string | null, selectedIds: number[]) => {
    if (!token) return;
    try {
      await axios.post(
        '/api/videos/rating',
        { videoIds: selectedIds, rating },
        { headers: { 'x-access-token': token } }
      );
      setSuccessMessage(
        `Successfully updated content rating for ${selectedIds.length} video(s)`
      );
      selection.clear();
      refetch();
    } catch (error: unknown) {
      console.error('Failed to update ratings:', error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || 'Failed to update content ratings'
        : 'Failed to update content ratings';
      setErrorMessage(message);
    }
  };

  const selectionActions = useMemo<SelectionAction<number>[]>(
    () => [
      {
        id: 'rating',
        label: 'Rating',
        icon: <RatingIcon size={14} />,
        intent: 'warning',
        onClick: () => setRatingDialogOpen(true),
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: <DeleteIcon size={14} />,
        intent: 'danger',
        disabled: () => deleteLoading,
        onClick: () => setDeleteDialogOpen(true),
      },
    ],
    [deleteLoading]
  );

  const selection = useVideoSelection<number>({ actions: selectionActions });

  const handleToggleSelect = (videoId: number) => {
    selection.toggle(videoId);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectable = videos.filter((v) => !v.removed).map((v) => v.id);
      selection.set(selectable);
    } else {
      selection.clear();
    }
  };

  const handleDeleteSingleVideo = (videoId: number) => {
    selection.set([videoId]);
    setDeleteDialogOpen(true);
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

  const handleOpenModal = (video: VideoData) => setModalVideo(video);

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

  const withPageReset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const filterConfigs = useMemo<FilterConfig[]>(() => {
    return [
      {
        id: 'dateRangeString',
        dateFrom,
        dateTo,
        onFromChange: withPageReset(setDateFrom),
        onToChange: withPageReset(setDateTo),
      },
      { id: 'maxRating', value: maxRatingFilter, onChange: withPageReset(setMaxRatingFilter) },
      { id: 'protected', value: protectedFilter, onChange: withPageReset(setProtectedFilter) },
      {
        id: 'channel',
        value: channelFilter,
        options: uniqueChannels,
        onChange: withPageReset(setChannelFilter),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, maxRatingFilter, protectedFilter, channelFilter, uniqueChannels]);

  const sortConfig: SortConfig = useMemo(
    () => ({
      options: [
        { key: 'published', label: 'Published' },
        { key: 'added', label: 'Downloaded' },
      ],
      activeKey: orderBy,
      direction: sortOrder,
      onChange: (key, direction) => {
        setOrderBy(key as 'published' | 'added');
        setSortOrder(direction);
      },
    }),
    [orderBy, sortOrder]
  );

  const headerSlot = (
    <div style={{ padding: '12px 16px 0 16px' }}>
      <Typography variant={isMobile ? 'h6' : 'h5'} component="h2" gutterBottom align="center">
        Library ({totalVideos} total)
      </Typography>
    </div>
  );

  const paginationNode = !useInfiniteScroll && totalPages > 1 ? (
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
  ) : null;

  const infiniteSentinel = useInfiniteScroll ? (
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
  ) : null;

  const renderContent = (mode: VideoListViewMode) => {
    if (mode === 'grid') {
      return (
        <Grid container spacing={2}>
          {videos.map((video) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={video.id}>
              <VideoCard
                video={video}
                selected={selection.isSelected(video.id)}
                enabledChannels={enabledChannels}
                imageErrored={Boolean(imageErrors[video.youtubeId])}
                deleteDisabled={deleteLoading}
                onToggleSelect={handleToggleSelect}
                onOpenModal={handleOpenModal}
                onToggleProtection={handleToggleProtection}
                onDeleteSingle={handleDeleteSingleVideo}
                onImageError={handleImageError}
              />
            </Grid>
          ))}
        </Grid>
      );
    }
    if (mode === 'list') {
      return (
        <VideosListMobile
          videos={videos}
          selectedVideos={selection.selectedIds}
          enabledChannels={enabledChannels}
          imageErrors={imageErrors}
          onToggleSelect={handleToggleSelect}
          onOpenModal={handleOpenModal}
          onToggleProtection={handleToggleProtection}
          onImageError={handleImageError}
        />
      );
    }
    return (
      <VideosTable
        videos={videos}
        selectedVideos={selection.selectedIds}
        enabledChannels={enabledChannels}
        imageErrors={imageErrors}
        orderBy={orderBy}
        sortOrder={sortOrder}
        deleteDisabled={deleteLoading}
        onSelectAll={handleSelectAll}
        onToggleSelect={handleToggleSelect}
        onSortChange={handleSortChange}
        onOpenModal={handleOpenModal}
        onToggleProtection={handleToggleProtection}
        onDeleteSingle={handleDeleteSingleVideo}
        onImageError={handleImageError}
      />
    );
  };

  // Hide Sort in table view (table has column sort)
  const activeSort = listState.viewMode === 'table' && !isMobile ? undefined : sortConfig;

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
    <Box>
      <VideoListContainer
        state={listState}
        selection={selection}
        viewModes={availableViewModes}
        filters={filterConfigs}
        sort={activeSort}
        searchPlaceholder="Search videos by name or channel..."
        headerSlot={headerSlot}
        itemCount={videos.length}
        isLoading={loading}
        isError={Boolean(loadError)}
        errorMessage={loadError}
        renderContent={(mode) => <div {...swipeHandlers}>{renderContent(mode)}</div>}
        pagination={paginationNode}
        paginationMode={useInfiniteScroll ? 'infinite' : 'pages'}
        infiniteScrollSentinel={infiniteSentinel}
        isMobile={isMobile}
      />

      <DeleteVideosDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => handleDeleteConfirm(selection.selectedIds)}
        videoCount={selection.count}
      />

      <ChangeRatingDialog
        open={ratingDialogOpen}
        onClose={() => setRatingDialogOpen(false)}
        onApply={(rating) => handleApplyRating(rating, selection.selectedIds)}
        selectedCount={selection.count}
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
