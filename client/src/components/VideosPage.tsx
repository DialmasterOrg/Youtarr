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
} from '@mui/material';
import Pagination from '@mui/material/Pagination';
import FilterListIcon from '@mui/icons-material/FilterList';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import StorageIcon from '@mui/icons-material/Storage';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatDuration, formatYTDate } from '../utils';
import { VideoData, PaginatedVideosResponse } from '../types/VideoData';
import { useSwipeable } from 'react-swipeable';
import FilterMenu from './VideosPage/FilterMenu';
import SearchIcon from '@mui/icons-material/Search';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { debounce } from 'lodash';

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

      // Extract unique channels for filter menu
      const channels = Array.from(
        new Set(response.data.videos.map(v => v.youTubeChannelName))
      ).sort();
      setUniqueChannels(channels);
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
                  </TableRow>
                </TableHead>
              )}
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 1 : 6} align="center">
                      <Typography>Loading videos...</Typography>
                    </TableCell>
                  </TableRow>
                ) : videos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isMobile ? 1 : 6} align="center">
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
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                                  }}
                                  onError={() =>
                                    handleImageError(video.youtubeId)
                                  }
                                />
                              )}
                              {video.removed && (
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
                                    style={{
                                      color: '#f44336',
                                      fontSize: '3rem',
                                      filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'
                                    }}
                                  />
                                </Box>
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
                            <Typography
                              variant='subtitle2'
                              color='text.secondary'
                            >
                              {video.youTubeChannelName}
                            </Typography>

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
                                  width='256'
                                  height='144'
                                  style={{
                                    filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                                  }}
                                  onError={() =>
                                    handleImageError(video.youtubeId)
                                  }
                                />
                              )}
                              {video.removed && (
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
                                    style={{
                                      color: '#f44336',
                                      fontSize: '4rem',
                                      filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))'
                                    }}
                                  />
                                </Box>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell style={{ fontSize: 'medium' }}>
                            {video.youTubeChannelName}
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
                            <Stack direction="row" spacing={1}>
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
    </Card>
  );
}

export default VideosPage;
