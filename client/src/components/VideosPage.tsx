import React, { useState, useEffect } from 'react';
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
  Fab,
  Badge,
  Zoom,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
} from './ui';
import { Filter as FilterListIcon, AlertCircle as ErrorOutlineIcon, CheckCircle as CheckCircleIcon, HardDrive as StorageIcon, Trash2 as DeleteIcon, Download as DownloadIcon, Clock as ScheduleIcon, AlarmCheck as AlarmOnIcon, Search as SearchIcon, Video as VideoLibraryIcon } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { EighteenUpRating as EighteenUpRatingIcon } from '../lib/icons';
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

interface VideosPageProps {
  token: string | null;
}

function VideosPage({ token }: VideosPageProps) {
  const isMobile = useMediaQuery('(max-width: 599px)');
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
  const [selectedForDeletion, setSelectedForDeletion] = useState<number[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [maxRatingFilter, setMaxRatingFilter] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { deleteVideos, loading: deleteLoading } = useVideoDeletion();

  const videosPerPage = isMobile ? 6 : 12;

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

    try {
      const response = await axios.get<PaginatedVideosResponse>(`/getVideos?${params.toString()}`, {
        headers: {
          'x-access-token': token,
        },
      });

      setVideos(response.data.videos);
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
  }, [token, page, videosPerPage, orderBy, sortOrder, search, filter, dateFrom, dateTo, maxRatingFilter]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    value: number
  ) => {
    setPage(value);
  };

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

  const toggleDeletionSelection = (videoId: number) => {
    setSelectedForDeletion(prev => {
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

    const videoIdsToUpdate = isMobile ? selectedForDeletion : selectedVideos;

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
      setSelectedForDeletion([]);
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

    const videosToDelete = isMobile ? selectedForDeletion : selectedVideos;
    const result = await deleteVideos(videosToDelete, token);

    if (result.success) {
      setSuccessMessage(`Successfully deleted ${result.deleted.length} video${result.deleted.length !== 1 ? 's' : ''}`);
      setSelectedVideos([]);
      setSelectedForDeletion([]);
      // Refresh the videos list
      fetchVideos();
    } else {
      const deletedCount = result.deleted.length;
      const failedCount = result.failed.length;

      if (deletedCount > 0) {
        setSuccessMessage(`Deleted ${deletedCount} video${deletedCount !== 1 ? 's' : ''}, but ${failedCount} failed`);
        setSelectedVideos([]);
        setSelectedForDeletion([]);
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

          <FormControl fullWidth size="small">
            <InputLabel>Max Rating</InputLabel>
            <Select
              value={maxRatingFilter}
              label="Max Rating"
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

          {selectedVideos.length > 0 && (
            <Box display="flex" gap={2} alignItems="center">
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
          <Box display='flex' justifyContent='center' mb={2}>
            <Button
              variant='outlined'
              startIcon={<FilterListIcon data-testid="FilterListIcon" />}
              onClick={handleFilterClick}
              className="text-foreground border-border hover:bg-muted hover:border-foreground"
            >
              Filter by Channel
            </Button>
            <FilterMenu
              anchorEl={anchorEl}
              handleClose={handleClose}
              handleMenuItemClick={handleMenuItemClick}
              filter={filter}
              uniqueChannels={uniqueChannels}
            />
          </Box>
        )}

        <Grid
          container
          spacing={2}
          justifyContent='center'
          style={{ marginTop: '8px', marginBottom: '8px' }}
        >
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            disabled={loading}
          />
        </Grid>

        <TableContainer component={Paper}>
          <div {...handlers}>
            <Table>
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
                          <IconButton onClick={handleFilterClick} size="small">
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
                      <Box style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                        <Typography variant="caption">Thumbnail</Typography>
                        <Typography variant="caption">Channel</Typography>
                        <Typography variant="caption">Video Information</Typography>
                        <Typography variant="caption">File Info</Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
              )}
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={1} align="center">
                      <Typography>Loading videos...</Typography>
                    </TableCell>
                  </TableRow>
                ) : videos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={1} align="center">
                      <Typography>No videos found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  videos.map((video) => (
                    <TableRow key={video.id}>
                      {isMobile ? (
                        <TableCell>
                          <Box
                            display='flex'
                            flexDirection='column'
                            alignItems='stretch'
                            justifyContent='flex-start'
                            className="gap-4"
                          >
                            {/* Title at the top */}
                            <Box className="flex-grow">
                              <Typography 
                                variant='subtitle2' 
                                className="font-semibold mb-1"
                                style={{ lineHeight: 1.3 }}
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
                                backgroundColor: '#111827',
                                border: '1px solid rgba(107, 114, 128, 0.4)',
                              }}
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
                              {video.youtube_removed ? (
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    backgroundColor: 'rgba(211, 47, 47, 0.95)',
                                    color: 'white',
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
                              {/* Delete icon for downloaded videos on mobile */}
                              {!video.removed && video.fileSize && (
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDeletionSelection(video.id);
                                  }}
                                  data-testid="DeleteIcon"
                                  style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    backgroundColor: selectedForDeletion.includes(video.id) ? 'hsl(var(--destructive))' : 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    transition: 'all 0.2s',
                                    zIndex: 3,
                                  }}
                                  size="small"
                                >
                                  <DeleteIcon size={18} />
                                </IconButton>
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
                                      style={{ height: 20, fontSize: '0.65rem' }}
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
                                      variant="outlined"
                                      style={{ height: 20, fontSize: '0.65rem' }}
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
                                      style={{ height: 20, fontSize: '0.65rem' }}
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
                                border: '1px solid rgba(107, 114, 128, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                                backgroundColor: '#111827',
                              }}
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
                              {video.youtube_removed ? (
                                <Box
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    backgroundColor: 'rgba(211, 47, 47, 0.95)',
                                    color: 'white',
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
                                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                  color: 'white',
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
                                <Typography variant='subtitle1' className="font-bold" style={{ lineHeight: 1.3 }}>
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
                                      style={{ height: 20, fontSize: '0.7rem' }}
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
                                      variant="outlined"
                                      style={{ height: 20, fontSize: '0.7rem' }}
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
                                      style={{ height: 20, fontSize: '0.7rem' }}
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
                              <Box className="flex items-center">
                                <Tooltip title="Delete video from disk">
                                  <span>
                                    <IconButton
                                      color="error"
                                      size="small"
                                      data-testid="DeleteIcon"
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TableContainer>
      </Box>

      {/* Delete Confirmation Dialog */}
      <DeleteVideosDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        videoCount={isMobile ? selectedForDeletion.length : selectedVideos.length}
      />

      {/* Change Rating Dialog */}
      <ChangeRatingDialog
        open={ratingDialogOpen}
        onClose={() => setRatingDialogOpen(false)}
        onApply={handleApplyRating}
        selectedCount={isMobile ? selectedForDeletion.length : selectedVideos.length}
      />

      {/* Mobile Rating FAB */}
      {isMobile && selectedForDeletion.length > 0 && (
        <Zoom in={selectedForDeletion.length > 0}>
          <Fab
            color="primary"
            style={{
              position: 'fixed',
              bottom: 80,
              right: 16,
              zIndex: 1000,
            }}
            onClick={handleChangeRatingClick}
          >
            <EighteenUpRatingIcon />
          </Fab>
        </Zoom>
      )}

      {/* Mobile Delete FAB */}
      {isMobile && selectedForDeletion.length > 0 && (
        <Zoom in={selectedForDeletion.length > 0}>
          <Fab
            color="error"
            style={{
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 1000,
            }}
            onClick={handleDeleteClick}
          >
            <Badge badgeContent={selectedForDeletion.length} color="primary">
              <DeleteIcon />
            </Badge>
          </Fab>
        </Zoom>
      )}

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
    </Box>
  );
}

export default VideosPage;
