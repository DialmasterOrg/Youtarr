import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  IconButton,
  Button,
  TableSortLabel,
  Alert,
  TextField,
  InputAdornment,
  Stack,
  Chip,
  Tooltip,
  Checkbox,
  Snackbar,
  Fab,
  Badge,
  Zoom,
} from '@mui/material';
import Pagination from '@mui/material/Pagination';
import FilterListIcon from '@mui/icons-material/FilterList';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorageIcon from '@mui/icons-material/Storage';
import DeleteIcon from '@mui/icons-material/Delete';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration, formatYTDate } from '../utils';
import { VideoData, PaginatedVideosResponse, EnabledChannel } from '../types/VideoData';
import { useSwipeable } from 'react-swipeable';
import FilterMenu from './VideosPage/FilterMenu';
import SearchIcon from '@mui/icons-material/Search';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { debounce } from 'lodash';
import { Link as RouterLink } from 'react-router-dom';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DeleteVideosDialog from './shared/DeleteVideosDialog';
import { useVideoDeletion } from './shared/useVideoDeletion';
import RatingBadge from './shared/RatingBadge';
import ChangeRatingDialog from './shared/ChangeRatingDialog';
import EighteenUpRatingIcon from '@mui/icons-material/EighteenUpRating';
import VideoActionsDropdown from './shared/VideoActionsDropdown';

interface VideosPageProps {
  token: string | null;
}

function VideosPage({ token }: VideosPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [uniqueChannels, setUniqueChannels] = useState<string[]>([]);
  const [enabledChannels, setEnabledChannels] = useState<EnabledChannel[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<number[]>([]);
  const [selectedForDeletion, setSelectedForDeletion] = useState<number[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
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
    if (dateFrom) params.append('dateFrom', dateFrom.toISOString().split('T')[0]);
    if (dateTo) params.append('dateTo', dateTo.toISOString().split('T')[0]);

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
  }, [token, page, videosPerPage, orderBy, sortOrder, search, filter, dateFrom, dateTo]);

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

  const formatFileSize = (bytes: string | null | undefined): string => {
    if (!bytes) return '';
    const size = parseInt(bytes);
    if (isNaN(size)) return '';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let formattedSize = size;

    while (formattedSize >= 1024 && unitIndex < units.length - 1) {
      formattedSize /= 1024;
      unitIndex++;
    }

    return `${formattedSize.toFixed(1)} ${units[unitIndex]}`;
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

  const handleApplyRating = async (rating: string) => {
    if (!token) return;

    const videoIdsToUpdate = isMobile ? selectedForDeletion : selectedVideos;

    try {
      await axios.post('/api/videos/rating', {
        videoIds: videoIdsToUpdate,
        rating
      }, {
        headers: {
          'x-access-token': token,
        },
      });

      setSuccessMessage(`Successfully updated content rating for ${videoIdsToUpdate.length} video(s)`);
      setSelectedVideos([]);
      setSelectedForDeletion([]);
      fetchVideos();
    } catch (error: any) {
      console.error('Failed to update ratings:', error);
      setErrorMessage(error.response?.data?.error || 'Failed to update content ratings');
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
    <Card elevation={8} style={{ marginBottom: '16px' }}>
      <CardContent>
        <Typography
          variant={isMobile ? 'h6' : 'h5'}
          component='h2'
          gutterBottom
          align='center'
        >
          Downloaded Videos ({totalVideos} total)
        </Typography>

        {loadError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {loadError}
          </Alert>
        )}

        {/* Search and Filter Controls */}
        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search videos by name or channel..."
            onChange={(e) => debouncedSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          {!isMobile && (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Stack direction="row" spacing={2}>
                <DatePicker
                  label="From Date"
                  value={dateFrom}
                  onChange={(newValue: Date | null) => {
                    setDateFrom(newValue);
                    setPage(1);
                  }}
                  renderInput={(params) => <TextField {...params} variant="outlined" fullWidth />}
                />
                <DatePicker
                  label="To Date"
                  value={dateTo}
                  onChange={(newValue: Date | null) => {
                    setDateTo(newValue);
                    setPage(1);
                  }}
                  renderInput={(params) => <TextField {...params} variant="outlined" fullWidth />}
                />
                {(dateFrom || dateTo) && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setDateFrom(null);
                      setDateTo(null);
                      setPage(1);
                    }}
                  >
                    Clear Dates
                  </Button>
                )}
              </Stack>
            </LocalizationProvider>
          )}

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
              startIcon={<FilterListIcon />}
              onClick={handleFilterClick}
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
              {isMobile ? (
                <></>
              ) : (
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedVideos.length > 0 && selectedVideos.length < videos.filter(v => !v.removed).length}
                        checked={videos.filter(v => !v.removed).length > 0 && selectedVideos.length === videos.filter(v => !v.removed).length}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Thumbnail
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Channel
                      <IconButton onClick={handleFilterClick}>
                        <FilterListIcon />
                      </IconButton>
                      <FilterMenu
                        anchorEl={anchorEl}
                        handleClose={handleClose}
                        handleMenuItemClick={handleMenuItemClick}
                        filter={filter}
                        uniqueChannels={uniqueChannels}
                      />
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Video Information
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                      sortDirection={
                        orderBy === 'published' ? sortOrder : false
                      }
                    >
                      <TableSortLabel
                        active={orderBy === 'published'}
                        direction={orderBy === 'published' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('published')}
                      >
                        Published
                      </TableSortLabel>
                    </TableCell>

                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                      sortDirection={orderBy === 'added' ? sortOrder : false}
                    >
                      <TableSortLabel
                        active={orderBy === 'added'}
                        direction={orderBy === 'added' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('added')}
                      >
                        Added
                      </TableSortLabel>
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      File Info
                    </TableCell>
                    <TableCell
                      style={{ fontWeight: 'bold', fontSize: 'medium' }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
              )}
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 1 : 8} align="center">
                      <Typography>Loading videos...</Typography>
                    </TableCell>
                  </TableRow>
                ) : videos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 1 : 8} align="center">
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
                            alignItems='center'
                            justifyContent='center'
                          >
                            <Box
                              width='100%'
                              height='0'
                              paddingTop='56.25%' // maintain 16:9 aspect ratio
                              border={1}
                              borderColor='grey.500'
                              overflow='hidden'
                              position='relative'
                              bgcolor='grey.900'
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
                                    fontSize: '0.75rem',
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
                                    sx={{
                                      color: 'error.main',
                                      fontSize: '3rem',
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
                                  sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    bgcolor: selectedForDeletion.includes(video.id) ? 'error.main' : 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    '&:hover': {
                                      bgcolor: selectedForDeletion.includes(video.id) ? 'error.dark' : 'rgba(0,0,0,0.8)',
                                    },
                                    transition: 'all 0.2s',
                                    zIndex: 3,
                                  }}
                                  size="small"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                            <Typography variant='subtitle1' textAlign='center'>
                              {video.youTubeVideoName}
                              {video.duration && (
                                <Typography
                                  variant='caption'
                                  color='text.secondary'
                                >
                                  {' '}
                                  ({formatDuration(video.duration)})
                                </Typography>
                              )}
                            </Typography>
                            {(() => {
                              const channelId = getEnabledChannelId(video.youTubeChannelName, video.channel_id);
                              return channelId ? (
                                <Typography
                                  component={RouterLink}
                                  to={`/channel/${channelId}`}
                                  variant='subtitle2'
                                  sx={{
                                    color: 'primary.main',
                                    textDecoration: 'none',
                                    '&:hover': {
                                      textDecoration: 'underline',
                                    },
                                  }}
                                >
                                  {video.youTubeChannelName}
                                </Typography>
                              ) : (
                                <Typography
                                  variant='subtitle2'
                                  color='text.secondary'
                                >
                                  {video.youTubeChannelName}
                                </Typography>
                              );
                            })()}

                            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 0.5 }}>
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                Added: {new Date(video.timeCreated).toLocaleDateString()}
                              </Typography>
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                • Published: {formatYTDate(video.originalDate)}
                              </Typography>
                            </Stack>

                            <Stack
                              direction={{ xs: "row", sm: "column" }}
                              spacing={1}
                              justifyContent="center"
                              alignItems="center"
                              sx={{ mt: 0.5 }}
                            >
                              {(() => {
                                const mediaTypeInfo = getMediaTypeInfo(video.media_type);
                                return mediaTypeInfo ? (
                                  <Chip
                                    size="small"
                                    icon={mediaTypeInfo.icon}
                                    label={mediaTypeInfo.label}
                                    color={mediaTypeInfo.color}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                ) : null;
                              })()}
                              {video.fileSize && (
                                <Tooltip title="File size on disk" enterTouchDelay={0}>
                                  <Chip
                                    size="small"
                                    icon={<StorageIcon />}
                                    label={formatFileSize(video.fileSize)}
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                </Tooltip>
                              )}
                              <RatingBadge
                                rating={video.normalized_rating}
                                ratingSource={video.rating_source}
                                showNA={true}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                              {video.removed ? (
                                <Tooltip title="Video file not found on disk" enterTouchDelay={0}>
                                  <Chip
                                    size="small"
                                    icon={<ErrorOutlineIcon />}
                                    label="Missing"
                                    color="error"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                </Tooltip>
                              ) : video.fileSize ? (
                                <Tooltip title="Video file exists on disk" enterTouchDelay={0}>
                                  <Chip
                                    size="small"
                                    icon={<CheckCircleOutlineIcon />}
                                    label="Available"
                                    color="success"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                </Tooltip>
                              ) : null}
                            </Stack>
                          </Box>
                        </TableCell>
                      ) : (
                        <>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedVideos.includes(video.id)}
                              onChange={() => handleSelectVideo(video.id)}
                              disabled={Boolean(video.removed)}
                            />
                          </TableCell>
                          <TableCell>
                            <Box
                              width={256}
                              height={144}
                              border={1}
                              borderColor='grey.500'
                              display='flex'
                              alignItems='center'
                              justifyContent='center'
                              position='relative'
                              overflow='hidden'
                              bgcolor='grey.900'
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
                                    sx={{
                                      color: 'error.main',
                                      fontSize: '4rem',
                                      filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'
                                    }}
                                  />
                                </Box>
                              ) : null}
                            </Box>
                          </TableCell>
                          <TableCell style={{ fontSize: 'medium' }}>
                            {(() => {
                              const channelId = getEnabledChannelId(video.youTubeChannelName, video.channel_id);
                              return channelId ? (
                                <Typography
                                  component={RouterLink}
                                  to={`/channel/${channelId}`}
                                  sx={{
                                    color: 'primary.main',
                                    textDecoration: 'none',
                                    '&:hover': {
                                      textDecoration: 'underline',
                                    },
                                  }}
                                >
                                  {video.youTubeChannelName}
                                </Typography>
                              ) : (
                                <>{video.youTubeChannelName}</>
                              );
                            })()}
                          </TableCell>
                          <TableCell style={{ fontSize: 'medium' }}>
                            <Typography variant='subtitle1'>
                              {video.youTubeVideoName}
                            </Typography>
                            {video.duration && (
                              <Typography
                                variant='caption'
                                color='text.secondary'
                              >
                                Duration: {formatDuration(video.duration)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {formatYTDate(video.originalDate)}
                          </TableCell>

                          <TableCell>
                            {new Date(video.timeCreated).toLocaleDateString()}
                            <br />
                            {new Date(video.timeCreated).toLocaleTimeString(
                              [],
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </TableCell>
                          <TableCell>
                            <Stack direction={isMobile ? "row" : "column"} spacing={1}>
                              {(() => {
                                const mediaTypeInfo = getMediaTypeInfo(video.media_type);
                                return mediaTypeInfo ? (
                                  <Chip
                                    size="small"
                                    icon={mediaTypeInfo.icon}
                                    label={mediaTypeInfo.label}
                                    color={mediaTypeInfo.color}
                                    variant="outlined"
                                  />
                                ) : null;
                              })()}
                              {video.fileSize && (
                                <Tooltip title="File size on disk" enterTouchDelay={0}>
                                  <Chip
                                    size="small"
                                    icon={<StorageIcon />}
                                    label={formatFileSize(video.fileSize)}
                                    variant="outlined"
                                  />
                                </Tooltip>
                              )}
                              <RatingBadge
                                rating={video.normalized_rating}
                                ratingSource={video.rating_source}
                                showNA={true}
                                size="small"
                              />
                              {video.removed ? (
                                <Tooltip title="Video file not found on disk. It may have been deleted or moved." enterTouchDelay={0}>
                                  <Chip
                                    size="small"
                                    icon={<ErrorOutlineIcon />}
                                    label="Missing"
                                    color="error"
                                    variant="outlined"
                                  />
                                </Tooltip>
                              ) : video.fileSize ? (
                                <Tooltip title="Video file exists on disk" enterTouchDelay={0}>
                                  <Chip
                                    size="small"
                                    icon={<CheckCircleOutlineIcon />}
                                    label="Available"
                                    color="success"
                                    variant="outlined"
                                  />
                                </Tooltip>
                              ) : null}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Delete video from disk">
                              <span>
                                <IconButton
                                  color="error"
                                  size="small"
                                  onClick={() => handleDeleteSingleVideo(video.id)}
                                  disabled={Boolean(video.removed) || deleteLoading}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TableContainer>
      </CardContent>

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
            sx={{
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
            sx={{
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
    </Card>
  );
}

export default VideosPage;
