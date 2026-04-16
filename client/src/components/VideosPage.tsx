import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Box,
  IconButton,
  Button,
  Alert,
  TextField,
  Stack,
  Chip,
  Tooltip,
  Checkbox,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
} from './ui';
import { Filter as FilterListIcon, AlertCircle as ErrorOutlineIcon, CheckCircle as CheckCircleIcon, HardDrive as StorageIcon, Trash2 as DeleteIcon, Download as DownloadIcon, Clock as ScheduleIcon, AlarmCheck as AlarmOnIcon, Search as SearchIcon, Video as VideoLibraryIcon, X as ClearIcon } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { EighteenUpRating as EighteenUpRatingIcon, Shield as ShieldIcon } from '../lib/icons';
import { formatDuration, formatYTDate } from '../utils';
import { formatFileSize } from '../utils/formatters';
import { VideoData, PaginatedVideosResponse, EnabledChannel } from '../types/VideoData';
import { useSwipeable } from 'react-swipeable';
import FilterMenu from './VideosPage/FilterMenu';
import { debounce } from 'lodash';
import { Link as RouterLink } from 'react-router-dom';
import DeleteVideosDialog from './shared/DeleteVideosDialog';
import { useVideoDeletion } from './shared/useVideoDeletion';
import RatingBadge from './shared/RatingBadge';
import ChangeRatingDialog from './shared/ChangeRatingDialog';
import VideoActionsDropdown from './shared/VideoActionsDropdown';
import { RATING_OPTIONS } from '../utils/ratings';
import DownloadFormatIndicator from './shared/DownloadFormatIndicator';
import { useConfig } from '../hooks/useConfig';
import PageControls from './shared/PageControls';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_THEMED_CHIP_SMALL_STYLE } from './shared/chipStyles';
import { ActionBar } from './shared/ActionBar';
import { useThemeEngine } from '../contexts/ThemeEngineContext';
import { useVideoProtection } from './shared/useVideoProtection';
import ProtectionShieldButton from './shared/ProtectionShieldButton';
import VideoModal from './shared/VideoModal';
import ThumbnailClickOverlay from './shared/ThumbnailClickOverlay';
import { VideoModalData } from './shared/VideoModal/types';

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

interface VideosPageProps {
  token: string | null;
}

function VideosPage({ token }: VideosPageProps) {
  const isMobile = useMediaQuery('(max-width: 599px)');
  const { themeMode } = useThemeEngine();
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [totalVideos, setTotalVideos] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [imageErrors, setImageErrors] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [orderBy, setOrderBy] = useState<'published' | 'added'>('added');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [uniqueChannels, setUniqueChannels] = useState<string[]>([]);
  const [enabledChannels, setEnabledChannels] = useState<EnabledChannel[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<number[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [maxRatingFilter, setMaxRatingFilter] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const videosContainerRef = useRef<HTMLDivElement | null>(null);

  const { deleteVideos, loading: deleteLoading } = useVideoDeletion();
  const configState = useConfig(token);
  const useInfiniteScroll = configState?.config?.channelVideosHotLoad ?? false;
  const { toggleProtection, successMessage: protectionSuccess, error: protectionError, clearMessages: clearProtectionMessages } = useVideoProtection(token);
  const [protectedFilter, setProtectedFilter] = useState(false);
  const [modalVideo, setModalVideo] = useState<VideoData | null>(null);

  const videosPerPage = isMobile ? 6 : 12;

  const videoAvailabilityChipStyle = {
    available: {
      ...SHARED_THEMED_CHIP_SMALL_STYLE,
      backgroundColor: 'var(--success)',
      color: 'var(--success-foreground)',
    } as React.CSSProperties,
    missing: {
      ...SHARED_THEMED_CHIP_SMALL_STYLE,
      backgroundColor: 'var(--destructive)',
      color: 'var(--destructive-foreground)',
    } as React.CSSProperties,
  };

  const handleImageError = (youtubeId: string) => {
    setImageErrors((prevState) => ({ ...prevState, [youtubeId]: true }));
  };

  // Debounced search function
  const debouncedSearch = React.useMemo(
    () => debounce((searchValue: string) => {
      setSearch(searchValue);
      setPage(1);
    }, 500),
    []
  );

  // Fetch videos with pagination and filters
  const fetchVideos = React.useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setLoadError(null);

    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', videosPerPage.toString());
    params.append('sortBy', orderBy === 'published' ? 'published' : 'added');
    params.append('sortOrder', sortOrder);

    if (search) params.append('search', search);
    if (filter) params.append('channelFilter', filter);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (maxRatingFilter) params.append('maxRating', maxRatingFilter);
    if (protectedFilter) params.append('protectedFilter', 'true');

    try {
      const response = await axios.get<PaginatedVideosResponse>(`/getVideos?${params.toString()}`, {
        headers: {
          'x-access-token': token,
        },
      });

      const incomingVideos = response.data.videos || [];
      setVideos((prev) => {
        if (!useInfiniteScroll || page <= 1) {
          return incomingVideos;
        }

        const merged = [...prev, ...incomingVideos];
        const seen = new Set<number>();
        return merged.filter((video) => {
          if (seen.has(video.id)) return false;
          seen.add(video.id);
          return true;
        });
      });
      setTotalVideos(response.data.total);
      setTotalPages(response.data.totalPages);

      // Use channels list from API response (includes all channels, not just current page)
      setUniqueChannels(response.data.channels || []);
      setEnabledChannels(response.data.enabledChannels || []);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      setLoadError('Failed to load videos. Please try refreshing the page. If this error persists, the Youtarr backend may be down.');
    } finally {
      setLoading(false);
    }
  }, [token, page, videosPerPage, orderBy, sortOrder, search, filter, dateFrom, dateTo, maxRatingFilter, useInfiniteScroll, protectedFilter]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    setVideos([]);
    setPage(1);
  }, [useInfiniteScroll]);

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

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = (
    event: React.MouseEvent<HTMLElement>,
    value: string
  ) => {
    setFilter(value);
    setPage(1);
    setAnchorEl(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
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

  const getMediaTypeInfo = (mediaType?: string) => {
    switch (mediaType) {
      case 'short':
        return { label: 'Short', color: 'secondary' as const, icon: <ScheduleIcon /> };
      case 'livestream':
        return { label: 'Live', color: 'error' as const, icon: <VideoLibraryIcon /> };
      case 'video':
      default:
        return null; // Don't show chip for regular videos
    }
  };

  const getEnabledChannelId = (channelName: string, videoChannelId?: string | null): string | null => {
    // First try to match by the video's channel_id
    if (videoChannelId) {
      const match = enabledChannels.find(ch => ch.channel_id === videoChannelId);
      if (match) return match.channel_id;
    }

    // Fall back to matching by uploader name
    const match = enabledChannels.find(ch => ch.uploader === channelName);
    return match ? match.channel_id : null;
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      // Select all videos that are not already removed
      const selectableVideos = videos.filter(v => !v.removed).map(v => v.id);
      setSelectedVideos(selectableVideos);
    } else {
      setSelectedVideos([]);
    }
  };

  const handleSelectVideo = (videoId: number) => {
    setSelectedVideos(prev => {
      if (prev.includes(videoId)) {
        return prev.filter(id => id !== videoId);
      } else {
        return [...prev, videoId];
      }
    });
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleChangeRatingClick = () => {
    setRatingDialogOpen(true);
  };

  const handleApplyRating = async (rating: string | null) => {
    if (!token) return;

    const videoIdsToUpdate = selectedVideos;

    try {
      await axios.post('/api/videos/rating', {
        videoIds: videoIdsToUpdate,
        rating,
      }, {
        headers: {
          'x-access-token': token,
        },
      });

      setSuccessMessage(`Successfully updated content rating for ${videoIdsToUpdate.length} video(s)`);
      setSelectedVideos([]);
      fetchVideos();
    } catch (error: unknown) {
      console.error('Failed to update ratings:', error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || 'Failed to update content ratings'
        : 'Failed to update content ratings';
      setErrorMessage(message);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);

    const videosToDelete = selectedVideos;
    const result = await deleteVideos(videosToDelete, token);

    if (result.success) {
      setSuccessMessage(`Successfully deleted ${result.deleted.length} video${result.deleted.length !== 1 ? 's' : ''}`);
      setSelectedVideos([]);
      // Refresh the videos list
      fetchVideos();
    } else {
      const deletedCount = result.deleted.length;
      const failedCount = result.failed.length;

      if (deletedCount > 0) {
        setSuccessMessage(`Deleted ${deletedCount} video${deletedCount !== 1 ? 's' : ''}, but ${failedCount} failed`);
        setSelectedVideos([]);
        fetchVideos();
      } else {
        setErrorMessage(`Failed to delete videos: ${result.failed[0]?.error || 'Unknown error'}`);
      }
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleDeleteSingleVideo = (videoId: number) => {
    setSelectedVideos([videoId]);
    setDeleteDialogOpen(true);
  };

  const handleOpenVideoModal = (event: React.MouseEvent, video: VideoData) => {
    event.stopPropagation();
    setModalVideo(video);
  };

  const renderMobileActionBar = () => {
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
            <Button size="small" onClick={handleDeleteClick} className="intent-danger" startIcon={<DeleteIcon size={14} />}>
              Delete
            </Button>
            <Button size="small" onClick={() => setSelectedVideos([])} className="intent-base" startIcon={<ClearIcon size={14} />}>
              Clear
            </Button>
          </Box>
        </ActionBar>
      </div>,
      document.body
    );
  };

  const handleToggleProtection = async (videoId: number) => {
    const video = videos.find((v: VideoData) => v.id === videoId);
    if (!video) return;

    const currentState = video.protected || false;
    const newState = await toggleProtection(video.id, currentState);
    if (newState !== undefined) {
      setVideos((prev: VideoData[]) =>
        prev.map((v: VideoData) =>
          v.id === videoId ? { ...v, protected: newState } : v
        )
      );
    }
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (useInfiniteScroll) return;
      if (page < totalPages) {
        setPage(page + 1);
      }
    },
    onSwipedRight: () => {
      if (useInfiniteScroll) return;
      if (page > 1) {
        setPage(page - 1);
      }
    },
    trackMouse: true,
  });

  return (
    <Box className="mb-4">
      <Box>
        <Typography
          variant={isMobile ? 'h6' : 'h5'}
          component='h2'
          gutterBottom
          align='center'
        >
          Library ({totalVideos} total)
        </Typography>

        {loadError && (
          <Alert severity="error" className="mb-4">
            {loadError}
          </Alert>
        )}

        {/* Search and Filter Controls */}
        <Stack spacing={2} className="mb-6">
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search videos by name or channel..."
            onChange={(e) => debouncedSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon size={16} className="text-muted-foreground" />,
            }}
          />

          {!isMobile && (
            <Stack direction="row" spacing={2}>
              <TextField
                label="From Date"
                type="date"
                value={dateFrom}
                size="small"
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                InputLabelProps={{ shrink: true }}
                variant="outlined"
                fullWidth
              />
              <TextField
                label="To Date"
                type="date"
                value={dateTo}
                size="small"
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                InputLabelProps={{ shrink: true }}
                variant="outlined"
                fullWidth
              />
              <Chip
                icon={<ShieldIcon size={16} />}
                label={protectedFilter ? 'Protected Only' : 'Protected'}
                variant={protectedFilter ? 'filled' : 'outlined'}
                color={protectedFilter ? 'primary' : 'default'}
                onClick={() => setProtectedFilter(!protectedFilter)}
                onDelete={protectedFilter ? () => setProtectedFilter(false) : undefined}
                style={{ cursor: 'pointer', height: 36 }}
              />
              {(dateFrom || dateTo) && (
                <Button
                  variant="outlined"
                  onClick={() => {
                    setDateFrom('');
                    setDateTo('');
                    setPage(1);
                  }}
                >
                  Clear Dates
                </Button>
              )}
            </Stack>
          )}

          <FormControl fullWidth>
            <InputLabel>Max Rating</InputLabel>
            <Select
              value={maxRatingFilter}
              label="Max Rating"
              size="small"
              onChange={(event) => {
                setMaxRatingFilter(event.target.value);
                setPage(1);
              }}
            >
              {RATING_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedVideos.length > 0 && !isMobile && (
            <Box className="flex gap-2 items-center">
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
            </Box>
          )}
        </Stack>

        {isMobile && (
          <Box className="flex justify-center mb-2 gap-2">
            <Button
              variant='outlined'
              startIcon={<FilterListIcon data-testid="FilterListIcon" />}
              onClick={handleFilterClick}
              className="text-foreground border-border hover:bg-muted hover:border-foreground"
            >
              Filter by Channel
            </Button>
            <Chip
              icon={<ShieldIcon size={16} />}
              label={protectedFilter ? 'Protected Only' : 'Protected'}
              variant={protectedFilter ? 'filled' : 'outlined'}
              color={protectedFilter ? 'primary' : 'default'}
              onClick={() => setProtectedFilter(!protectedFilter)}
              onDelete={protectedFilter ? () => setProtectedFilter(false) : undefined}
              style={{ cursor: 'pointer', height: 36 }}
            />
            <FilterMenu
              anchorEl={anchorEl}
              handleClose={handleClose}
              handleMenuItemClick={handleMenuItemClick}
              filter={filter}
              uniqueChannels={uniqueChannels}
            />
          </Box>
        )}

        {!useInfiniteScroll && totalPages > 1 && (
          <Grid
            container
            spacing={2}
            style={{ marginTop: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'center' }}
          >
            <PageControls
              page={page}
              totalPages={totalPages}
              onPageChange={(newPage) => setPage(newPage)}
              compact={isMobile}
            />
          </Grid>
        )}

        <Paper style={{ overflow: 'hidden' }}>
          <div ref={videosContainerRef}>
            <TableContainer>
              <div {...handlers}>
                <Table style={isMobile ? { tableLayout: 'fixed' } : undefined}>
              {isMobile ? null : (
                <TableHead>
                  <TableRow>
                    <TableCell colSpan={1} className="py-3">
                      <Box className="flex items-center justify-between gap-4">
                        <Box className="flex items-center gap-2">
                          <Checkbox
                            indeterminate={selectedVideos.length > 0 && selectedVideos.length < videos.filter(v => !v.removed).length}
                            checked={videos.filter(v => !v.removed).length > 0 && selectedVideos.length === videos.filter(v => !v.removed).length}
                            onChange={handleSelectAll}
                          />
                          <Typography variant="subtitle2" className="font-bold">
                            Downloaded Videos
                          </Typography>
                          <IconButton onClick={handleFilterClick} size="small" aria-label="Filter videos">
                            <FilterListIcon size={16} data-testid="FilterListIcon" />
                          </IconButton>
                          <FilterMenu
                            anchorEl={anchorEl}
                            handleClose={handleClose}
                            handleMenuItemClick={handleMenuItemClick}
                            filter={filter}
                            uniqueChannels={uniqueChannels}
                          />
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            Sort:
                          </Typography>
                          <TableSortLabel
                            active={orderBy === 'published'}
                            direction={orderBy === 'published' ? sortOrder : 'asc'}
                            onClick={() => handleSortChange('published')}
                          >
                            Published
                          </TableSortLabel>
                          <TableSortLabel
                            active={orderBy === 'added'}
                            direction={orderBy === 'added' ? sortOrder : 'asc'}
                            onClick={() => handleSortChange('added')}
                          >
                            Added
                          </TableSortLabel>
                        </Stack>
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
              )}
              <TableBody>
                {loading ? (
                  [...Array(videosPerPage)].map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {isMobile ? (
                        <TableCell style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12 }}>
                          <Box className="flex flex-col gap-3">
                            <Skeleton variant="text" width="80%" height={22} />
                            <Skeleton variant="rectangular" width="100%" height={200} />
                            <Stack direction="row" spacing={1}>
                              <Skeleton variant="rounded" width={72} height={22} />
                              <Skeleton variant="rounded" width={72} height={22} />
                              <Skeleton variant="rounded" width={88} height={22} />
                            </Stack>
                            <Skeleton variant="text" width="60%" />
                          </Box>
                        </TableCell>
                      ) : (
                        <TableCell colSpan={1} className="p-0">
                          <Box className="flex items-stretch gap-4 py-3 px-4">
                            <Skeleton variant="rectangular" width={42} height={42} style={{ marginTop: 4, flexShrink: 0 }} />
                            <Skeleton variant="rectangular" width={256} height={144} style={{ flexShrink: 0 }} />
                            <Box className="flex-1 min-w-0 flex flex-col gap-4">
                              <Box>
                                <Skeleton variant="text" width="70%" height={28} />
                                <Skeleton variant="text" width="25%" />
                              </Box>
                              <Stack direction="row" spacing={1}>
                                <Skeleton variant="rounded" width={80} height={24} />
                                <Skeleton variant="rounded" width={80} height={24} />
                                <Skeleton variant="rounded" width={100} height={24} />
                              </Stack>
                              <Stack direction="row" spacing={2}>
                                <Skeleton variant="text" width={160} />
                                <Skeleton variant="text" width={220} />
                              </Stack>
                            </Box>
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : videos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={1} align="center">
                      <Typography>No videos found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  videos.map((video) => {
                    const isSelectable = isMobile && !video.removed && Boolean(video.fileSize);
                    const isRowSelected = selectedVideos.includes(video.id);
                    return (
                    <TableRow
                      key={video.id}
                      onClick={() => {
                        if (isSelectable) handleSelectVideo(video.id);
                      }}
                      style={{
                        cursor: isSelectable ? 'pointer' : 'default',
                        backgroundColor: isRowSelected ? 'var(--muted)' : undefined,
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {isMobile ? (
                        <TableCell style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12 }}>
                          <Box className="flex flex-col items-stretch justify-start gap-4">

                            {/* Title at the top */}
                            <Box className="flex-grow">
                              <Typography 
                                variant='subtitle2' 
                                className="font-semibold mb-1"
                                style={{ lineHeight: 1.3, cursor: 'pointer' }}
                                onClick={(event) => handleOpenVideoModal(event, video)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setModalVideo(video);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                {video.youTubeVideoName}
                              </Typography>
                              {(() => {
                                const channelId = getEnabledChannelId(video.youTubeChannelName, video.channel_id);
                                return channelId ? (
                                  <Typography
                                    component={RouterLink}
                                    to={`/channel/${channelId}`}
                                    variant='caption'
                                    className="text-primary no-underline hover:underline block"
                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                  >
                                    {video.youTubeChannelName}
                                  </Typography>
                                ) : (
                                  <Typography
                                    variant='caption'
                                    color='text.secondary'
                                    className="block"
                                  >
                                    {video.youTubeChannelName}
                                  </Typography>
                                );
                              })()}
                            </Box>

                            {/* Smaller thumbnail - 16:9 aspect ratio at reduced size */}
                            <Box
                              style={{
                                position: 'relative',
                                width: '100%',
                                height: 0,
                                paddingTop: '56.25%',
                                overflow: 'hidden',
                                backgroundColor: 'var(--media-placeholder-background)',
                                border: 'var(--media-placeholder-border)',
                                cursor: 'pointer',
                              }}
                              onClick={(event) => handleOpenVideoModal(event, video)}
                            >
                              {imageErrors[video.youtubeId] ? (
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    textAlign: 'center',
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                                  }}
                                >
                                  <Typography variant='caption'>
                                    No thumbnail available
                                  </Typography>
                                </Box>
                              ) : (
                                <img
                                  src={`/images/videothumb-${video.youtubeId}.jpg`}
                                  alt='thumbnail'
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: video.media_type === 'short' ? 'contain' : 'cover',
                                    filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                                  }}
                                  onError={() =>
                                    handleImageError(video.youtubeId)
                                  }
                                />
                              )}
                              {/* Center hotspot for opening video modal */}
                              <ThumbnailClickOverlay
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  setModalVideo(video);
                                }}
                              />
                              {video.youtube_removed ? (
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    backgroundColor: 'var(--media-overlay-danger-background)',
                                    color: 'var(--media-overlay-foreground)',
                                    padding: '4px 8px',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    zIndex: 2,
                                  }}
                                >
                                  Removed From YouTube
                                </Box>
                              ) : null}
                              {video.removed ? (
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(244, 67, 54, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 1,
                                  }}
                                >
                                  <ErrorOutlineIcon
                                    className="text-destructive"
                                    style={{
                                      fontSize: '2.5rem',
                                      filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'
                                    }}
                                  />
                                </Box>
                              ) : null}
                              {/* Selection checkbox for mobile actions */}
                              {!video.removed && video.fileSize && (
                                <Checkbox
                                  checked={selectedVideos.includes(video.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    handleSelectVideo(video.id);
                                  }}
                                  inputProps={{ 'aria-label': `Select ${video.youTubeVideoName}` }}
                                  style={{
                                    position: 'absolute',
                                    top: 4,
                                    left: 4,
                                    backgroundColor: 'var(--media-overlay-background)',
                                    color: 'var(--media-overlay-foreground)',
                                    transition: 'all 0.2s',
                                    zIndex: 3,
                                  }}
                                />
                              )}
                              {/* Protection shield */}
                              {!video.removed && (
                                <ProtectionShieldButton
                                  isProtected={video.protected || false}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleProtection(video.id);
                                  }}
                                  style={{ position: 'absolute', bottom: 6, left: 6, zIndex: 3 }}
                                />
                              )}
                            </Box>

                            {/* Compact metadata below thumbnail */}
                            <Stack spacing={0.5} className="mt-1">
                              {/* Duration, Size, Published, Downloaded in a compact grid */}
                              <Box className="grid grid-cols-2 gap-2 text-xs">
                                {video.duration && (
                                  <Box className="flex items-center gap-1">
                                    <AlarmOnIcon size={14} className="text-muted-foreground" />
                                    <Typography variant='caption' className="text-muted-foreground">
                                      {formatDuration(video.duration)}
                                    </Typography>
                                  </Box>
                                )}
                                {video.fileSize && (
                                  <Box className="flex items-center gap-1">
                                    <StorageIcon size={14} className="text-muted-foreground" />
                                    <Typography variant='caption' className="text-muted-foreground">
                                      {formatFileSize(typeof video.fileSize === 'string' ? parseInt(video.fileSize, 10) : video.fileSize)}
                                    </Typography>
                                  </Box>
                                )}
                                <Box className="flex items-center gap-1">
                                  <ScheduleIcon size={14} className="text-muted-foreground" />
                                  <Typography variant='caption' className="text-muted-foreground">
                                    Published: {formatYTDate(video.originalDate)}
                                  </Typography>
                                </Box>
                                <Box className="flex items-center gap-1">
                                  <DownloadIcon size={14} className="text-muted-foreground" />
                                  <Typography variant='caption' className="text-muted-foreground">
                                    Added: {new Date(video.timeCreated).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              </Box>

                              <Stack direction="row" spacing={0.5} className="flex-wrap gap-1 mt-1">
                                {!video.removed && (video.filePath || video.audioFilePath) && (
                                  <DownloadFormatIndicator
                                    filePath={video.filePath}
                                    audioFilePath={video.audioFilePath}
                                    fileSize={video.fileSize}
                                    audioFileSize={video.audioFileSize}
                                  />
                                )}
                                {(() => {
                                  const mediaTypeInfo = getMediaTypeInfo(video.media_type);
                                  return mediaTypeInfo ? (
                                    <Chip
                                      size="small"
                                      icon={mediaTypeInfo.icon}
                                      label={mediaTypeInfo.label}
                                      color={mediaTypeInfo.color}
                                      variant="outlined"
                                      style={SHARED_STATUS_CHIP_SMALL_STYLE}
                                    />
                                  ) : null;
                                })()}
                                <RatingBadge
                                  rating={video.normalized_rating}
                                  ratingSource={video.rating_source}
                                  showNA={true}
                                  size="small"
                                />
                                {video.removed ? (
                                  <Tooltip title="Video file not found on disk" enterTouchDelay={0}>
                                    <Chip
                                      size="small"
                                      icon={<ErrorOutlineIcon size={12} />}
                                      label="Missing"
                                      color="error"
                                      variant="filled"
                                      style={videoAvailabilityChipStyle.missing}
                                    />
                                  </Tooltip>
                                ) : video.fileSize ? (
                                  <Tooltip title="Video file exists on disk" enterTouchDelay={0}>
                                    <Chip
                                      size="small"
                                      icon={<CheckCircleIcon size={12} />}
                                      label="Available"
                                      color="success"
                                      variant="filled"
                                      style={videoAvailabilityChipStyle.available}
                                    />
                                  </Tooltip>
                                ) : null}
                              </Stack>
                            </Stack>
                          </Box>
                        </TableCell>
                      ) : (
                        <TableCell colSpan={1} className="p-0">
                          <Box className="flex items-stretch gap-4 py-3 px-4">
                            <Checkbox
                              checked={selectedVideos.includes(video.id)}
                              onChange={() => handleSelectVideo(video.id)}
                              disabled={Boolean(video.removed)}
                              className="self-start mt-1"
                            />
                            <Box
                              style={{
                                width: 256,
                                height: 144,
                                border: 'var(--media-placeholder-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                                backgroundColor: 'var(--media-placeholder-background)',
                                cursor: 'pointer',
                              }}
                              onClick={(event) => handleOpenVideoModal(event, video)}
                            >
                              {imageErrors[video.youtubeId] ? (
                                <Typography
                                  variant='caption'
                                  style={{
                                    filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                                  }}
                                >
                                  No thumbnail
                                </Typography>
                              ) : (
                                <img
                                  src={`/images/videothumb-${video.youtubeId}.jpg`}
                                  alt='thumbnail'
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: video.media_type === 'short' ? 'contain' : 'cover',
                                    filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                                  }}
                                  onError={() =>
                                    handleImageError(video.youtubeId)
                                  }
                                />
                              )}
                              {/* Center hotspot for opening video modal */}
                              <ThumbnailClickOverlay
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  setModalVideo(video);
                                }}
                              />
                              {video.youtube_removed ? (
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    backgroundColor: 'var(--media-overlay-danger-background)',
                                    color: 'var(--media-overlay-foreground)',
                                    padding: '4px 8px',
                                    fontSize: '0.875rem',
                                    fontWeight: 'bold',
                                    textAlign: 'center',
                                    zIndex: 2,
                                  }}
                                >
                                  Removed From YouTube
                                </Box>
                              ) : null}
                              {video.removed ? (
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(244, 67, 54, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 1,
                                  }}
                                >
                                  <ErrorOutlineIcon
                                    className="text-destructive"
                                    style={{
                                      fontSize: '4rem',
                                      filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'
                                    }}
                                  />
                                </Box>
                              ) : null}
                              <Box
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  backgroundColor: 'var(--media-overlay-background)',
                                  color: 'var(--media-overlay-foreground)',
                                  padding: '4px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  zIndex: 2,
                                }}
                              >
                                {(() => {
                                  const channelId = getEnabledChannelId(video.youTubeChannelName, video.channel_id);
                                  return channelId ? (
                                    <Typography
                                      component={RouterLink}
                                      to={`/channel/${channelId}`}
                                      className="text-inherit no-underline hover:underline"
                                    >
                                      {video.youTubeChannelName}
                                    </Typography>
                                  ) : (
                                    <Box component="span">{video.youTubeChannelName}</Box>
                                  );
                                })()}
                              </Box>
                            </Box>
                            <Box className="flex-1 min-w-0 flex flex-col gap-4">
                              <Box className="min-w-0">
                                <Typography
                                  variant='subtitle1'
                                  className="font-bold"
                                  style={{ lineHeight: 1.3, cursor: 'pointer' }}
                                  onClick={(event) => handleOpenVideoModal(event, video)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      setModalVideo(video);
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                >
                                  {video.youTubeVideoName}
                                </Typography>
                                {video.duration && (
                                  <Typography variant='caption' color='text.secondary'>
                                    Duration: {formatDuration(video.duration)}
                                  </Typography>
                                )}
                              </Box>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" className="gap-y-1">
                                {(() => {
                                  const mediaTypeInfo = getMediaTypeInfo(video.media_type);
                                  return mediaTypeInfo ? (
                                    <Chip
                                      size="small"
                                      icon={mediaTypeInfo.icon}
                                      label={mediaTypeInfo.label}
                                      color={mediaTypeInfo.color}
                                      variant="outlined"
                                      style={SHARED_STATUS_CHIP_SMALL_STYLE}
                                    />
                                  ) : null;
                                })()}
                                <RatingBadge
                                  rating={video.normalized_rating}
                                  ratingSource={video.rating_source}
                                  showNA={true}
                                  size="small"
                                />
                                {!video.removed && (video.filePath || video.audioFilePath) && (
                                  <DownloadFormatIndicator
                                    filePath={video.filePath}
                                    audioFilePath={video.audioFilePath}
                                    fileSize={video.fileSize}
                                    audioFileSize={video.audioFileSize}
                                  />
                                )}
                                {video.removed ? (
                                  <Tooltip title="Video file not found on disk. It may have been deleted or moved." enterTouchDelay={0}>
                                    <Chip
                                      size="small"
                                      icon={<ErrorOutlineIcon size={12} />}
                                      label="Missing"
                                      color="error"
                                      variant="filled"
                                      style={videoAvailabilityChipStyle.missing}
                                    />
                                  </Tooltip>
                                ) : video.fileSize ? (
                                  <Tooltip title="Video file exists on disk" enterTouchDelay={0}>
                                    <Chip
                                      size="small"
                                      icon={<CheckCircleIcon size={12} />}
                                      label="Available"
                                      color="success"
                                      variant="filled"
                                      style={videoAvailabilityChipStyle.available}
                                    />
                                  </Tooltip>
                                ) : null}
                              </Stack>
                              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                                  <Box className="flex items-center gap-1">
                                    <ScheduleIcon size={16} className="text-muted-foreground" />
                                    <Typography variant="caption" color="text.secondary">
                                      Published: {formatYTDate(video.originalDate)}
                                    </Typography>
                                  </Box>
                                  <Box className="flex items-center gap-1">
                                    <DownloadIcon size={16} className="text-muted-foreground" />
                                    <Typography variant="caption" color="text.secondary">
                                      Downloaded: {new Date(video.timeCreated).toLocaleDateString()} {new Date(video.timeCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                  </Box>
                                </Stack>
                              </Box>
                              <Box className="flex items-center gap-1">
                                {!video.removed && (
                                  <ProtectionShieldButton
                                    isProtected={video.protected || false}
                                    onClick={() => handleToggleProtection(video.id)}
                                    variant="inline"
                                  />
                                )}
                                <Tooltip title="Delete video from disk">
                                  <span>
                                    <IconButton
                                      color="error"
                                      size="small"
                                      data-testid="DeleteIcon"
                                      aria-label="Delete video from disk"
                                      onClick={() => handleDeleteSingleVideo(video.id)}
                                      disabled={Boolean(video.removed) || deleteLoading}
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Box>
                            </Box>
                          </TableCell>
                      )}
                    </TableRow>
                  );
                  })
                )}
              </TableBody>
            </Table>
              </div>

            {useInfiniteScroll && (
              <>
                <div
                  ref={loadMoreRef}
                  style={{
                    height: 24,
                    width: '100%',
                    marginTop: 12,
                    marginBottom: 16,
                  }}
                />
                {loading && videos.length > 0 && page < totalPages && (
                  <Box style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 16px 0' }}>
                    <Typography variant="caption" color="text.secondary">Loading more videos...</Typography>
                  </Box>
                )}
                {!loading && page >= totalPages && videos.length > 0 && (
                  <Typography variant="caption" color="text.secondary" align="center" style={{ display: 'block', paddingBottom: 12 }}>
                    You're all caught up.
                  </Typography>
                )}
              </>
            )}
            </TableContainer>
          </div>
        </Paper>
        {renderMobileActionBar()}
      </Box>

      {/* Delete Confirmation Dialog */}
      <DeleteVideosDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        videoCount={selectedVideos.length}
      />

      {/* Change Rating Dialog */}
      <ChangeRatingDialog
        open={ratingDialogOpen}
        onClose={() => setRatingDialogOpen(false)}
        onApply={handleApplyRating}
        selectedCount={selectedVideos.length}
      />

      {/* Success/Error Snackbars */}
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
            fetchVideos();
          }}
          onProtectionChanged={(youtubeId, isProtected) => {
            setVideos((prev: VideoData[]) =>
              prev.map((v: VideoData) =>
                v.youtubeId === youtubeId ? { ...v, protected: isProtected } : v
              )
            );
          }}
          onRatingChanged={(youtubeId, rating) => {
            setVideos((prev: VideoData[]) =>
              prev.map((v: VideoData) =>
                v.youtubeId === youtubeId
                  ? { ...v, normalized_rating: rating, rating_source: rating ? 'Manual Override' : null }
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
