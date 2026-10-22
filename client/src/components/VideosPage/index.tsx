import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVideoActivity } from '../../providers/VideoActivityProvider';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import { Alert, Box, Button, Grid, Snackbar, Typography } from '../ui';
import { Trash2 as DeleteIcon, Star as RatingIcon, Download as DownloadIcon } from '../../lib/icons';
import { FileX as MarkDeletedIcon } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useConfig } from '../../hooks/useConfig';
import { useDownloadListingsRefresh } from '../../hooks/useDownloadListingsRefresh';
import { useTriggerDownloads } from '../../hooks/useTriggerDownloads';
import { VideoData } from '../../types/VideoData';
import AddChannelDialog from '../shared/AddChannelDialog';
import DeleteVideosDialog from '../shared/DeleteVideosDialog';
import { useVideoDeletion } from '../shared/useVideoDeletion';
import ChangeRatingDialog from '../shared/ChangeRatingDialog';
import { useVideoProtection } from '../shared/useVideoProtection';
import VideoModal from '../shared/VideoModal';
import { VideoModalData } from '../shared/VideoModal/types';
import { getRemovalState, removalFromRow, removedState, type RemovalState } from '../../utils/videoRemoval';
import MarkDeletedDialog from './components/MarkDeletedDialog';
import LibraryCleanupHints from './components/LibraryCleanupHints';
import HiddenDeletedNote from './components/HiddenDeletedNote';
import { useMarkDeleted } from './hooks/useMarkDeleted';
import DownloadSettingsDialog from '../DownloadManager/ManualDownload/DownloadSettingsDialog';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';
import VideoCard from './components/VideoCard';
import VideosTable from './components/VideosTable';
import VideosListMobile from './components/VideosListMobile';
import { useVideosData } from './hooks/useVideosData';
import {
  INFINITE_SCROLL_FETCH_SIZE,
  VideoListContainer,
  VideoListPaginationBar,
  useListPageSize,
  usePersistedChipFilter,
  useVideoListState,
  useVideoSelection,
  type ChipFilterMode,
  type FilterConfig,
  type PageSize,
  type SelectionAction,
  type VideoListViewMode,
  type SortConfig,
} from '../shared/VideoList';

interface VideosPageProps {
  token: string | null;
}

const VIEW_MODE_STORAGE_KEY = 'youtarr:videosPageViewMode';
// Deleted videos are hidden by default; showing them is remembered in this browser.
const DELETED_FILTER_STORAGE_KEY = 'youtarr:videosPageDeletedFilter';
// Check results that can mean the user emptied the folder on purpose, the only
// ones Maintenance offers "Rescan anyway" for (a mix with an unreadable share is
// reported as unreadable, so it never qualifies).
const EMPTY_FOLDER_REASONS = ['empty', 'subfolder-empty'];

const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[a-zA-Z0-9_-]{22}$/;

interface VideoSelectionMeta {
  youtubeId: string;
  channelId: string | null;
  removed: boolean;
  removalState: RemovalState;
  youtubeRemoved: boolean;
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
    status: video.removed ? removedState(video.removed_reason) : 'downloaded',
    removal: removalFromRow(video),
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

  const listState = useVideoListState({
    initialViewMode: (isMobile ? 'list' : 'table') as VideoListViewMode,
    viewModeStorageKey: VIEW_MODE_STORAGE_KEY,
  });

  const [page, setPage] = useState(1);
  const [channelFilter, setChannelFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState<'published' | 'added'>('added');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [maxRatingFilter, setMaxRatingFilter] = useState('');
  const [protectedFilter, setProtectedFilter] = useState<ChipFilterMode>('off');
  const [missingFilter, setMissingFilter] = useState<ChipFilterMode>('off');
  const [deletedFilter, setDeletedFilter] = usePersistedChipFilter(DELETED_FILTER_STORAGE_KEY, 'exclude');
  const [watchedFilter, setWatchedFilter] = useState<ChipFilterMode>('off');

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [markDeletedDialogOpen, setMarkDeletedDialogOpen] = useState(false);
  // The message the user closed; a different one, or the same one after the
  // folder came back and failed again, shows the banner again.
  const [dismissedLibraryWarning, setDismissedLibraryWarning] = useState<string | null>(null);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modalVideo, setModalVideo] = useState<VideoData | null>(null);
  const [addChannelTarget, setAddChannelTarget] = useState<{ name: string; url: string } | null>(null);
  const handleAddChannel = useCallback(
    (name: string, url: string) => setAddChannelTarget({ name, url }),
    []
  );

  const navigate = useNavigate();
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const { triggerDownloads } = useTriggerDownloads(token);
  const { snapshot } = useVideoActivity();

  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const { deleteVideos, loading: deleteLoading } = useVideoDeletion();
  const { markDeleted, loading: markDeletedLoading } = useMarkDeleted(token);
  const configState = useConfig(token);
  const useInfiniteScroll = configState?.config?.channelVideosHotLoad ?? false;
  const {
    toggleProtection,
    successMessage: protectionSuccess,
    error: protectionError,
    clearMessages: clearProtectionMessages,
  } = useVideoProtection(token);

  const [videosPerPage, setVideosPerPage] = useListPageSize('youtarr.videosPage.pageSize');
  const effectivePageSize = useInfiniteScroll ? INFINITE_SCROLL_FETCH_SIZE : videosPerPage;

  const handlePageSizeChange = (newSize: PageSize) => {
    setVideosPerPage(newSize);
    setPage(1);
  };

  const {
    videos,
    setVideos,
    totalVideos,
    totalPages,
    uniqueChannels,
    enabledChannels,
    hiddenDeletedCount,
    libraryWarning,
    loading,
    loadError,
    refetch,
  } = useVideosData({
    token,
    page,
    videosPerPage: effectivePageSize,
    orderBy,
    sortOrder,
    search: listState.search,
    channelFilter,
    dateFrom,
    dateTo,
    maxRatingFilter,
    protectedFilter,
    missingFilter,
    deletedFilter,
    watchedFilter,
    useInfiniteScroll,
  });

  useEffect(() => {
    if (!libraryWarning) setDismissedLibraryWarning(null);
  }, [libraryWarning]);

  const videoMetaRef = useRef<Map<number, VideoSelectionMeta>>(new Map());

  useEffect(() => {
    for (const video of videos) {
      videoMetaRef.current.set(video.id, {
        youtubeId: video.youtubeId,
        channelId: video.channel_id || null,
        removed: Boolean(video.removed),
        removalState: getRemovalState(video.removed, video.removed_reason),
        youtubeRemoved: Boolean(video.youtube_removed),
      });
    }
  }, [videos]);

  useDownloadListingsRefresh(refetch);

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

  // Reload after rows leave the listing (deleted, marked deleted). In hot-load
  // mode a refetch of a later page merges into the rows already shown, so the
  // removed rows would stay: go back to page one, which the hook fetches on the
  // page change. Classic pagination replaces the page in place, so it stays put.
  const reloadFromFirstPage = () => {
    if (useInfiniteScroll && page !== 1) {
      setPage(1);
    } else {
      void refetch();
    }
  };

  const handleDeleteConfirm = async (selectedIds: number[]) => {
    setDeleteDialogOpen(false);
    const deletableIds = selectedIds.filter((id) => {
      const meta = videoMetaRef.current.get(id);
      return Boolean(meta && !meta.removed);
    });
    if (deletableIds.length === 0) return;
    const result = await deleteVideos(deletableIds, token);
    if (result.success) {
      setSuccessMessage(
        `Successfully deleted ${result.deleted.length} video${result.deleted.length !== 1 ? 's' : ''}`
      );
      selection.clear();
      reloadFromFirstPage();
    } else {
      const deletedCount = result.deleted.length;
      const failedCount = result.failed.length;
      if (deletedCount > 0) {
        setSuccessMessage(
          `Deleted ${deletedCount} video${deletedCount !== 1 ? 's' : ''}, but ${failedCount} failed`
        );
        selection.clear();
        reloadFromFirstPage();
      } else {
        setErrorMessage(
          `Failed to delete videos: ${result.failed[0]?.error || 'Unknown error'}`
        );
      }
    }
  };

  // Mark as deleted applies to the missing videos in the selection only.
  const missingSelectedIds = (selectedIds: number[]) =>
    selectedIds.filter((id) => videoMetaRef.current.get(id)?.removalState === 'missing');

  const handleMarkDeletedConfirm = async (selectedIds: number[]) => {
    const ids = missingSelectedIds(selectedIds);
    if (ids.length === 0) {
      setMarkDeletedDialogOpen(false);
      return;
    }
    const result = await markDeleted(ids);
    setMarkDeletedDialogOpen(false);
    const marked = `${result.updated} video${result.updated !== 1 ? 's' : ''}`;
    if (result.error) {
      // A later batch may have failed after earlier ones went through.
      setErrorMessage(result.updated > 0 ? `Marked ${marked} as deleted, then failed: ${result.error}` : result.error);
    } else {
      setSuccessMessage(`Marked ${marked} as deleted`);
    }
    if (result.updated === 0) return;
    selection.clear();
    reloadFromFirstPage();
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
        id: 'download',
        label: 'Download',
        icon: <DownloadIcon size={14} />,
        intent: 'success',
        disabled: (ids) =>
          !ids.some((id) => {
            const meta = videoMetaRef.current.get(id);
            return Boolean(meta && !meta.youtubeRemoved && !snapshot.videos[meta.youtubeId]?.state);
          }),
        onClick: () => setDownloadDialogOpen(true),
      },
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
        disabled: (ids) =>
          deleteLoading ||
          !ids.some((id) => {
            const meta = videoMetaRef.current.get(id);
            return Boolean(meta && !meta.removed);
          }),
        onClick: () => setDeleteDialogOpen(true),
      },
      {
        id: 'mark-deleted',
        label: 'Mark as deleted',
        icon: <MarkDeletedIcon size={14} />,
        intent: 'warning',
        disabled: (ids) =>
          markDeletedLoading ||
          !ids.some((id) => videoMetaRef.current.get(id)?.removalState === 'missing'),
        onClick: () => setMarkDeletedDialogOpen(true),
      },
    ],
    [deleteLoading, markDeletedLoading, snapshot]
  );

  const selection = useVideoSelection<number>({ actions: selectionActions });

  // Clear selection when a filter changes so bulk actions can't fire on IDs that
  // are no longer in the filtered dataset. Sort and pagination are deliberately
  // excluded: they do not remove videos from the selection's eligible set.
  useEffect(() => {
    selection.clear();
  }, [
    listState.search,
    channelFilter,
    dateFrom,
    dateTo,
    maxRatingFilter,
    protectedFilter,
    missingFilter,
    deletedFilter,
    watchedFilter,
    selection.clear,
  ]);

  const handleToggleSelect = (videoId: number) => {
    selection.toggle(videoId);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selection.set(videos.map((v) => v.id));
    } else {
      selection.clear();
    }
  };

  const getDownloadCounts = () => {
    let missing = 0;
    let replace = 0;
    let unavailable = 0;
    for (const id of selection.selectedIds) {
      const meta = videoMetaRef.current.get(id);
      if (!meta || snapshot.videos[meta.youtubeId]?.state) continue;
      if (meta.youtubeRemoved) {
        unavailable += 1;
      } else if (meta.removed) {
        missing += 1;
      } else {
        replace += 1;
      }
    }
    return { missing, replace, unavailable, eligible: missing + replace };
  };

  const downloadCounts = downloadDialogOpen
    ? getDownloadCounts()
    : { missing: 0, replace: 0, unavailable: 0, eligible: 0 };

  const getDeleteCounts = () => {
    let deletable = 0;
    let skipped = 0;
    for (const id of selection.selectedIds) {
      const meta = videoMetaRef.current.get(id);
      if (meta && !meta.removed) {
        deletable += 1;
      } else {
        skipped += 1;
      }
    }
    return { deletable, skipped };
  };
  const deleteCounts = getDeleteCounts();

  const markDeletedCounts = markDeletedDialogOpen
    ? {
        eligible: missingSelectedIds(selection.selectedIds).length,
        skipped: selection.selectedIds.length - missingSelectedIds(selection.selectedIds).length,
      }
    : { eligible: 0, skipped: 0 };

  const handleDownloadConfirm = async (settings: DownloadSettings | null) => {
    setDownloadDialogOpen(false);
    const eligible = selection.selectedIds
      .map((id) => videoMetaRef.current.get(id))
      .filter((meta): meta is VideoSelectionMeta => Boolean(meta && !meta.youtubeRemoved && !snapshot.videos[meta.youtubeId]?.state));
    if (eligible.length === 0) return;

    const urls = eligible.map((meta) => `https://www.youtube.com/watch?v=${meta.youtubeId}`);
    const videoChannelMap: Record<string, string> = {};
    for (const meta of eligible) {
      if (meta.channelId && YOUTUBE_CHANNEL_ID_PATTERN.test(meta.channelId)) {
        videoChannelMap[meta.youtubeId] = meta.channelId;
      }
    }
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

    const success = await triggerDownloads({ urls, overrideSettings, videoChannelMap });
    if (success === null) return;
    if (!success) {
      setErrorMessage('Failed to queue selected videos for download. Please try again.');
      return;
    }
    selection.clear();
    navigate('/downloads/activity');
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
      { id: 'missing', value: missingFilter, onChange: withPageReset(setMissingFilter) },
      { id: 'deleted', value: deletedFilter, onChange: withPageReset(setDeletedFilter), defaultValue: 'exclude' },
      { id: 'watched', value: watchedFilter, onChange: withPageReset(setWatchedFilter) },
      {
        id: 'channel',
        value: channelFilter,
        options: uniqueChannels,
        onChange: withPageReset(setChannelFilter),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, maxRatingFilter, protectedFilter, missingFilter, deletedFilter, watchedFilter, channelFilter, uniqueChannels]);

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

  const showDeleted = () => {
    setDeletedFilter('off');
    setPage(1);
  };

  const headerSlot = (
    <div style={{ padding: '12px 16px 0 16px' }}>
      {/* Wide screens put the hidden-deleted note on the heading's line; phones stack it. */}
      <div className={isMobile ? undefined : 'flex flex-wrap items-baseline justify-center gap-x-4'}>
        <Typography variant={isMobile ? 'h6' : 'h5'} component="h2" gutterBottom align="center">
          Library ({totalVideos} total)
        </Typography>
        <HiddenDeletedNote hiddenDeletedCount={hiddenDeletedCount} onShowDeleted={showDeleted} />
      </div>
      <LibraryCleanupHints
        missingFilter={missingFilter}
        deletedFilter={deletedFilter}
        hasVideos={totalVideos > 0}
      />
      {libraryWarning && libraryWarning.message !== dismissedLibraryWarning && (
        <Alert severity="warning" className="mt-2 break-words" onClose={() => setDismissedLibraryWarning(libraryWarning.message)}>
          {libraryWarning.message} Until that changes, videos stored there are not being marked missing; check
          that the drive or share is mounted.
          {EMPTY_FOLDER_REASONS.includes(libraryWarning.reason) && (
            <>
              {' '}If you removed the files yourself, you can rescan anyway from{' '}
              <Button
                variant="link"
                className="h-auto p-0 align-baseline text-sm"
                onClick={() => navigate('/settings/maintenance')}
              >
                Maintenance
              </Button>
              .
            </>
          )}
        </Alert>
      )}
    </div>
  );

  const renderPageControls = (placement: 'top' | 'bottom') => (
    <VideoListPaginationBar
      placement={placement}
      hasContent={totalVideos > 0}
      useInfiniteScroll={useInfiniteScroll}
      page={page}
      totalPages={totalPages}
      onPageChange={(newPage) => setPage(newPage)}
      pageSize={videosPerPage}
      onPageSizeChange={handlePageSizeChange}
      isMobile={isMobile}
    />
  );

  const paginationNode = renderPageControls('bottom');
  const paginationTopNode = renderPageControls('top');

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
                onAddChannel={handleAddChannel}
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
          onAddChannel={handleAddChannel}
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
        onAddChannel={handleAddChannel}
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
        paginationTop={paginationTopNode}
        paginationMode={useInfiniteScroll ? 'infinite' : 'pages'}
        infiniteScrollSentinel={infiniteSentinel}
        isMobile={isMobile}
      />

      <DeleteVideosDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => handleDeleteConfirm(selection.selectedIds)}
        videoCount={deleteCounts.deletable}
        skippedCount={deleteCounts.skipped}
      />

      <MarkDeletedDialog
        open={markDeletedDialogOpen}
        onClose={() => setMarkDeletedDialogOpen(false)}
        onConfirm={() => handleMarkDeletedConfirm(selection.selectedIds)}
        count={markDeletedCounts.eligible}
        skippedCount={markDeletedCounts.skipped}
        pending={markDeletedLoading}
      />

      <ChangeRatingDialog
        open={ratingDialogOpen}
        onClose={() => setRatingDialogOpen(false)}
        onApply={(rating) => handleApplyRating(rating, selection.selectedIds)}
        selectedCount={selection.count}
      />

      <DownloadSettingsDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        onConfirm={handleDownloadConfirm}
        videoCount={downloadCounts.eligible}
        missingVideoCount={downloadCounts.missing}
        replaceVideoCount={downloadCounts.replace}
        unavailableVideoCount={downloadCounts.unavailable}
        defaultResolution={configState?.config?.preferredResolution || '1080'}
        defaultResolutionSource="global"
        mode="manual"
        token={token}
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
            reloadFromFirstPage();
          }}
          onMarkedDeleted={reloadFromFirstPage}
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

      {addChannelTarget && (
        <AddChannelDialog
          open
          onClose={() => setAddChannelTarget(null)}
          channelName={addChannelTarget.name}
          channelUrl={addChannelTarget.url}
        />
      )}
    </Box>
  );
}

export default VideosPage;
