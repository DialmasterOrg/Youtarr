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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import Pagination from '@mui/material/Pagination';
import FilterListIcon from '@mui/icons-material/FilterList';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StorageIcon from '@mui/icons-material/Storage';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AlarmOnIcon from '@mui/icons-material/AlarmOn';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration, formatYTDate } from '../utils';
import { formatFileSize } from '../utils/formatters';
import { VideoData, PaginatedVideosResponse, EnabledChannel } from '../types/VideoData';
import { useSwipeable } from 'react-swipeable';
import FilterMenu from './VideosPage/FilterMenu';
import SearchIcon from '@mui/icons-material/Search';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { debounce } from 'lodash';
import { Link as RouterLink } from 'react-router-dom';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DeleteVideosDialog from './shared/DeleteVideosDialog';
import { useVideoDeletion } from './shared/useVideoDeletion';
import RatingBadge from './shared/RatingBadge';
import ChangeRatingDialog from './shared/ChangeRatingDialog';
import EighteenUpRatingIcon from '@mui/icons-material/EighteenUpRating';
import VideoActionsDropdown from './shared/VideoActionsDropdown';
import { RATING_OPTIONS } from '../utils/ratings';
import DownloadFormatIndicator from './shared/DownloadFormatIndicator';

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
    if (dateFrom) params.append('dateFrom', dateFrom.toISOString().split('T')[0]);
    if (dateTo) params.append('dateTo', dateTo.toISOString().split('T')[0]);
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

  const handleApplyRating = async (rating: string) => {
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
    <Box sx={{ mb: 2 }}>
      <Box>
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
                sx={{
                  color: 'text.primary',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    borderColor: 'text.primary',
                    color: 'text.primary',
                  }
                }}
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
              sx={{
                color: 'text.primary',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'action.hover',
                  borderColor: 'text.primary',
                  color: 'text.primary',
                }
              }}
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
                    <TableCell colSpan={1} sx={{ py: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Checkbox
                            indeterminate={selectedVideos.length > 0 && selectedVideos.length < videos.filter(v => !v.removed).length}
                            checked={videos.filter(v => !v.removed).length > 0 && selectedVideos.length === videos.filter(v => !v.removed).length}
                            onChange={handleSelectAll}
                          />
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Downloaded Videos
                          </Typography>
                          <IconButton onClick={handleFilterClick} size="small">
                            <FilterListIcon fontSize="small" />
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
                            Downloaded
                          </TableSortLabel>
                        </Stack>
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
                            sx={{ gap: 1 }}
                          >
                            {/* Title at the top */}
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography 
                                variant='subtitle2' 
                                sx={{ 
                                  fontWeight: 600,
                                  lineHeight: 1.3,
                                  mb: 0.5,
                                }}
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
                                    sx={{
                                      color: 'primary.main',
                                      textDecoration: 'none',
                                      '&:hover': {
                                        textDecoration: 'underline',
                                      },
                                      display: 'block',
                                    }}
                                  >
                                    {video.youTubeChannelName}
                                  </Typography>
                                ) : (
                                  <Typography
                                    variant='caption'
                                    color='text.secondary'
                                    sx={{ display: 'block' }}
                                  >
                                    {video.youTubeChannelName}
                                  </Typography>
                                );
                              })()}
                            </Box>

                            {/* Smaller thumbnail - 16:9 aspect ratio at reduced size */}
                            <Box
                              width='100%'
                              height='0'
                              paddingTop='56.25%'
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
                                    sx={{
                                      color: 'error.main',
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
                                  sx={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
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
                                  <DeleteIcon sx={{ fontSize: '1.125rem' }} />
                                </IconButton>
                              )}
                            </Box>

                            {/* Compact metadata below thumbnail */}
                            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                              {/* Duration, Size, Published, Downloaded in a compact grid */}
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, fontSize: '0.75rem' }}>
                                {video.duration && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <AlarmOnIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                                    <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                      {formatDuration(video.duration)}
                                    </Typography>
                                  </Box>
                                )}
                                {video.fileSize && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <StorageIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                                    <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                      {formatFileSize(video.fileSize)}
                                    </Typography>
                                  </Box>
                                )}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <ScheduleIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                                  <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                    Pub: {formatYTDate(video.originalDate)}
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <DownloadIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
                                  <Typography variant='caption' sx={{ color: 'text.secondary' }}>
                                    {new Date(video.timeCreated).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              </Box>

                              {/* Status chips in a flexible row */}
                              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
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
                                      sx={{ height: 20, fontSize: '0.65rem' }}
                                    />
                                  ) : null;
                                })()}
                                <RatingBadge
                                  rating={video.normalized_rating}
                                  ratingSource={video.rating_source}
                                  showNA={true}
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.65rem', boxShadow: 'none' }}
                                />
                                {video.removed ? (
                                  <Tooltip title="Video file not found on disk" enterTouchDelay={0}>
                                    <Chip
                                      size="small"
                                      icon={<ErrorOutlineIcon />}
                                      label="Missing"
                                      color="error"
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.65rem' }}
                                    />
                                  </Tooltip>
                                ) : video.fileSize ? (
                                  <Tooltip title="Video file exists on disk" enterTouchDelay={0}>
                                    <Chip
                                      size="small"
                                      icon={<CheckCircleIcon />}
                                      label="Available"
                                      color="success"
                                      variant="filled"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.65rem',
                                        '& .MuiChip-icon': { fontSize: 12, ml: 0.25 },
                                        '& .MuiChip-label': { px: 0.5 },
                                      }}
                                    />
                                  </Tooltip>
                                ) : null}
                              </Stack>
                            </Stack>
                          </Box>
                        </TableCell>
                      ) : (
                        <TableCell colSpan={1} sx={{ p: 0 }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'stretch',
                              gap: 2,
                              py: 1.5,
                              px: 2,
                            }}
                          >
                            <Checkbox
                              checked={selectedVideos.includes(video.id)}
                              onChange={() => handleSelectVideo(video.id)}
                              disabled={Boolean(video.removed)}
                              sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                            />
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
                              <Box
                                sx={{
                                  position: 'absolute',
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  bgcolor: 'rgba(0, 0, 0, 0.6)',
                                  color: 'common.white',
                                  px: 1,
                                  py: 0.5,
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
                                      sx={{
                                        color: 'inherit',
                                        textDecoration: 'none',
                                        '&:hover': { textDecoration: 'underline' },
                                      }}
                                    >
                                      {video.youTubeChannelName}
                                    </Typography>
                                  ) : (
                                    <Box component="span">{video.youTubeChannelName}</Box>
                                  );
                                })()}
                              </Box>
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant='subtitle1' sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                                  {video.youTubeVideoName}
                                </Typography>
                                {video.duration && (
                                  <Typography variant='caption' color='text.secondary'>
                                    Duration: {formatDuration(video.duration)}
                                  </Typography>
                                )}
                              </Box>
                              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.5 }}>
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
                                <RatingBadge
                                  rating={video.normalized_rating}
                                  ratingSource={video.rating_source}
                                  showNA={true}
                                  size="small"
                                  sx={{ height: 20, fontSize: '0.7rem', boxShadow: 'none' }}
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
                                      icon={<CheckCircleIcon />}
                                      label="Available"
                                      color="success"
                                      variant="filled"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.7rem',
                                        '& .MuiChip-icon': { fontSize: 14, ml: 0.5 },
                                        '& .MuiChip-label': { px: 0.75 },
                                      }}
                                    />
                                  </Tooltip>
                                ) : null}
                              </Stack>
                              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    <Typography variant="caption" color="text.secondary">
                                      Published: {formatYTDate(video.originalDate)}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <DownloadIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    <Typography variant="caption" color="text.secondary">
                                      Downloaded: {new Date(video.timeCreated).toLocaleDateString()} {new Date(video.timeCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </Typography>
                                  </Box>
                                </Stack>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
    </Box>
  );
}

export default VideosPage;
