import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Button,
  Box,
  FormControlLabel,
  Typography,
  Alert,
  IconButton,
  Tooltip,
  Snackbar,
  Skeleton,
  Grid,
  Fade,
  Zoom,
  Fab,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CardContent,
} from '@mui/material';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SearchIcon from '@mui/icons-material/Search';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewListIcon from '@mui/icons-material/ViewList';
import DownloadIcon from '@mui/icons-material/Download';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ClearIcon from '@mui/icons-material/Clear';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import StorageIcon from '@mui/icons-material/Storage';
import LockIcon from '@mui/icons-material/Lock';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import ScheduleIcon from '@mui/icons-material/Schedule';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import DeleteIcon from '@mui/icons-material/Delete';

import Pagination from '@mui/material/Pagination';
import useMediaQuery from '@mui/material/useMediaQuery';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { useNavigate } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable';
import DownloadSettingsDialog from '../DownloadManager/ManualDownload/DownloadSettingsDialog';
import { DownloadSettings } from '../DownloadManager/ManualDownload/types';
import DeleteVideosDialog from '../shared/DeleteVideosDialog';
import { useVideoDeletion } from '../shared/useVideoDeletion';

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
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [videoFailed, setVideoFailed] = useState<Boolean>(false);
  const [checkedBoxes, setCheckedBoxes] = useState<string[]>([]);
  const [hideDownloaded, setHideDownloaded] = useState(false);
  const [mobileTooltip, setMobileTooltip] = useState<string | null>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [defaultResolution, setDefaultResolution] = useState<string>('1080');
  const [totalCount, setTotalCount] = useState<number>(0);
  const [oldestVideoDate, setOldestVideoDate] = useState<string | null>(null);
  const [fetchingAllVideos, setFetchingAllVideos] = useState(false);
  const [fetchAllError, setFetchAllError] = useState<string | null>(null);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { deleteVideosByYoutubeIds, loading: deleteLoading } = useVideoDeletion();

  const { channel_id } = useParams();
  const navigate = useNavigate();

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(1)}GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)}MB`;
  };

  const decodeHtml = (html: string) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  const getVideoStatus = (video: ChannelVideo): 'never_downloaded' | 'downloaded' | 'missing' | 'members_only' => {
    if (video.availability === 'subscriber_only') {
      return 'members_only';
    }
    if (!video.added) {
      return 'never_downloaded';
    }
    if (video.removed) {
      return 'missing';
    }
    return 'downloaded';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'downloaded':
        return 'success';
      case 'missing':
        return 'warning';
      case 'members_only':
        return 'default';
      default:
        return 'info';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'downloaded':
        return <CheckCircleIcon fontSize="small" />;
      case 'missing':
        return <CloudOffIcon fontSize="small" />;
      case 'members_only':
        return <LockIcon fontSize="small" />;
      default:
        return <NewReleasesIcon fontSize="small" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'downloaded':
        return 'Downloaded';
      case 'missing':
        return 'Missing';
      case 'members_only':
        return 'Members Only';
      default:
        return 'Not Downloaded';
    }
  };

  const getMediaTypeInfo = (mediaType?: string | null) => {
    switch (mediaType) {
      case 'short':
        return {
          label: 'Short',
          color: 'secondary' as const,
          icon: <ScheduleIcon fontSize="small" />,
        };
      case 'livestream':
        return {
          label: 'Live',
          color: 'error' as const,
          icon: <VideoLibraryIcon fontSize="small" />,
        };
      default:
        return null;
    }
  };

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

    const requestBody: any = {
      urls: checkedBoxes.map(id => `https://www.youtube.com/watch?v=${id}`)
    };

    if (settings) {
      requestBody.overrideSettings = {
        resolution: settings.resolution,
        allowRedownload: settings.allowRedownload
      };
    }

    await fetch('/triggerspecificdownloads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || '',
      },
      body: JSON.stringify(requestBody),
    });

    setCheckedBoxes([]);
    navigate('/downloads');
  };

  const handleRefreshClick = () => {
    setRefreshConfirmOpen(true);
  };

  const handleRefreshConfirm = async () => {
    setRefreshConfirmOpen(false);
    setFetchingAllVideos(true);
    setFetchAllError(null);

    try {
      const response = await fetch(`/fetchallchannelvideos/${channel_id}?page=${page}&pageSize=${pageSize}&hideDownloaded=${hideDownloaded}`, {
        method: 'POST',
        headers: {
          'x-access-token': token || '',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 409 || data.error === 'FETCH_IN_PROGRESS') {
          throw new Error('A fetch operation is already in progress for this channel. Please wait for it to complete.');
        }
        throw new Error(data.message || 'Failed to fetch all videos');
      }

      setVideos(data.videos || []);
      setTotalCount(data.totalCount || 0);
      setOldestVideoDate(data.oldestVideoDate || null);
    } catch (error: any) {
      console.error('Error fetching all videos:', error);
      setFetchAllError(error.message || 'Failed to fetch all videos for channel');
    } finally {
      setFetchingAllVideos(false);
    }
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
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        hideDownloaded: hideDownloaded.toString(),
        searchQuery: searchQuery,
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      fetch(`/getchannelvideos/${channel_id}?${queryParams}`, {
        headers: {
          'x-access-token': token || '',
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.videos !== undefined) {
            setVideos(data.videos || []);
          }
          setTotalCount(data.totalCount || 0);
          setOldestVideoDate(data.oldestVideoDate || null);
        })
        .catch((error) => console.error(error));
    } else {
      const deletedCount = result.deleted.length;
      const failedCount = result.failed.length;

      if (deletedCount > 0) {
        setSuccessMessage(`Deleted ${deletedCount} video${deletedCount !== 1 ? 's' : ''}, but ${failedCount} failed`);
        setSelectedForDeletion(prev => prev.filter(id => !result.deleted.includes(id)));
        // Refresh list
        const queryParams = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
          hideDownloaded: hideDownloaded.toString(),
          searchQuery: searchQuery,
          sortBy: sortBy,
          sortOrder: sortOrder
        });

        fetch(`/getchannelvideos/${channel_id}?${queryParams}`, {
          headers: {
            'x-access-token': token || '',
          },
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.videos !== undefined) {
              setVideos(data.videos || []);
            }
            setTotalCount(data.totalCount || 0);
            setOldestVideoDate(data.oldestVideoDate || null);
          })
          .catch((error) => console.error(error));
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

  // Data fetching - use proper server-side pagination with search and sort
  useEffect(() => {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      hideDownloaded: hideDownloaded.toString(),
      searchQuery: searchQuery,
      sortBy: sortBy,
      sortOrder: sortOrder
    });

    fetch(`/getchannelvideos/${channel_id}?${queryParams}`, {
      headers: {
        'x-access-token': token || '',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return response.json();
      })
      .then((data) => {
        if (data.videos !== undefined) {
          setVideos(data.videos || []);
        }
        setVideoFailed(data.videoFail || false);
        setTotalCount(data.totalCount || 0);
        setOldestVideoDate(data.oldestVideoDate || null);
      })
      .catch((error) => console.error(error));
  }, [token, channel_id, page, pageSize, hideDownloaded, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    if (!token) return;

    fetch('/getconfig', {
      headers: {
        'x-access-token': token,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.preferredResolution) {
          setDefaultResolution(data.preferredResolution);
        }
      })
      .catch((error) => console.error('Failed to fetch config:', error));
  }, [token]);

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

  // Render video card for grid view
  const renderVideoCard = (video: ChannelVideo) => {
    const status = getVideoStatus(video);
    const isSelectable = status === 'never_downloaded' || status === 'missing';
    const isChecked = checkedBoxes.includes(video.youtube_id);
    const mediaTypeInfo = getMediaTypeInfo(video.media_type);

    return (
      <Fade in timeout={300} key={video.youtube_id}>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: isSelectable ? 'pointer' : 'default',
              opacity: status === 'members_only' ? 0.7 : 1,
              transform: hoveredVideo === video.youtube_id ? 'translateY(-4px)' : 'translateY(0)',
              boxShadow: hoveredVideo === video.youtube_id ? theme.shadows[8] : theme.shadows[1],
              '&:hover': {
                boxShadow: theme.shadows[4],
              },
            }}
            onMouseEnter={() => setHoveredVideo(video.youtube_id)}
            onMouseLeave={() => setHoveredVideo(null)}
            onClick={() => isSelectable && handleCheckChange(video.youtube_id, !isChecked)}
          >
            {/* Thumbnail with overlay */}
            <Box sx={{ position: 'relative', paddingTop: isMobile ? '52%' : '56.25%', bgcolor: 'grey.900' }}>
              <img
                src={video.thumbnail}
                alt={decodeHtml(video.title)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                loading="lazy"
              />

              {/* YouTube Removed Banner */}
              {video.youtube_removed ? (
                <Box
                  sx={{
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

              {/* Duration overlay */}
              <Chip
                label={formatDuration(video.duration)}
                size="small"
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  bgcolor: 'rgba(0,0,0,0.8)',
                  color: 'white',
                  fontSize: '0.75rem',
                  height: 22,
                }}
              />

              {/* Selection overlay for download */}
              {isSelectable && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    bgcolor: isChecked ? 'rgba(25, 118, 210, 0.3)' : 'transparent',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    p: 1,
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Checkbox
                    checked={isChecked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleCheckChange(video.youtube_id, e.target.checked);
                    }}
                    sx={{
                      color: 'white',
                      bgcolor: 'rgba(0,0,0,0.5)',
                      '&.Mui-checked': {
                        color: 'primary.main',
                      },
                      '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.7)',
                      },
                    }}
                  />
                </Box>
              )}

              {/* Delete icon for downloaded videos */}
              {status === 'downloaded' && (
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDeletionSelection(video.youtube_id);
                  }}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: selectedForDeletion.includes(video.youtube_id) ? 'error.main' : 'rgba(0,0,0,0.6)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: selectedForDeletion.includes(video.youtube_id) ? 'error.dark' : 'rgba(0,0,0,0.8)',
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

            {/* Card content */}
            <Box sx={{ p: isMobile ? 1.5 : 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="body2"
                sx={{
                  mb: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.3,
                  minHeight: '2.6em',
                }}
                title={decodeHtml(video.title)}
              >
                {decodeHtml(video.title)}
              </Typography>

              <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* Date, size, and status - same line on mobile, separate on desktop */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarTodayIcon sx={{ fontSize: 12 }} />
                    {isMobile
                      ? new Date(video.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : new Date(video.publishedAt).toLocaleDateString()
                    }
                  </Typography>
                  {video.fileSize && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <StorageIcon sx={{ fontSize: 12 }} />
                      {formatFileSize(video.fileSize)}
                    </Typography>
                  )}
                  {mediaTypeInfo && (
                    <Chip
                      size="small"
                      icon={mediaTypeInfo.icon}
                      label={mediaTypeInfo.label}
                      color={mediaTypeInfo.color}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                  {isMobile && (
                    <Chip
                      icon={getStatusIcon(status)}
                      label={getStatusLabel(status)}
                      size="small"
                      color={getStatusColor(status)}
                      variant={status === 'downloaded' ? 'filled' : 'outlined'}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Box>

                {/* Status chip for desktop only */}
                {!isMobile && (
                  <Chip
                    icon={getStatusIcon(status)}
                    label={getStatusLabel(status)}
                    size="small"
                    color={getStatusColor(status)}
                    variant={status === 'downloaded' ? 'filled' : 'outlined'}
                    sx={{ width: 'fit-content' }}
                  />
                )}
              </Box>
            </Box>
          </Card>
        </Grid>
      </Fade>
    );
  };

  // Render video list item (compact view for mobile)
  const renderVideoListItem = (video: ChannelVideo) => {
    const status = getVideoStatus(video);
    const isSelectable = status === 'never_downloaded' || status === 'missing';
    const isChecked = checkedBoxes.includes(video.youtube_id);
    const mediaTypeInfo = getMediaTypeInfo(video.media_type);

    return (
      <Fade in timeout={300} key={video.youtube_id}>
        <Card
          sx={{
            mb: 1.5,
            display: 'flex',
            position: 'relative',
            transition: 'all 0.2s ease',
            cursor: isSelectable ? 'pointer' : 'default',
            opacity: status === 'members_only' ? 0.7 : 1,
            '&:hover': {
              boxShadow: theme.shadows[3],
            },
          }}
          onClick={() => isSelectable && handleCheckChange(video.youtube_id, !isChecked)}
        >
          {/* Thumbnail */}
          <Box
            sx={{
              position: 'relative',
              width: 120,
              minWidth: 120,
              height: 90,
              bgcolor: 'grey.900',
            }}
          >
            <img
              src={video.thumbnail}
              alt={decodeHtml(video.title)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              loading="lazy"
            />

            {/* YouTube Removed Banner */}
            {video.youtube_removed ? (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(211, 47, 47, 0.95)',
                  color: 'white',
                  padding: '2px 4px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  zIndex: 2,
                }}
              >
                Removed From YouTube
              </Box>
            ) : null}

            {/* Duration overlay */}
            <Chip
              label={formatDuration(video.duration)}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                bgcolor: 'rgba(0,0,0,0.8)',
                color: 'white',
                fontSize: '0.7rem',
                height: 18,
                '& .MuiChip-label': { px: 0.5 },
              }}
            />

            {/* Checkbox for selectable videos */}
            {isSelectable && (
              <Checkbox
                checked={isChecked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  handleCheckChange(video.youtube_id, e.target.checked);
                }}
                sx={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  padding: 0.5,
                  '&.Mui-checked': {
                    color: 'primary.main',
                    bgcolor: 'rgba(0,0,0,0.7)',
                  },
                  '& .MuiSvgIcon-root': { fontSize: 20 },
                }}
              />
            )}

            {/* Delete icon for downloaded videos */}
            {status === 'downloaded' && (
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDeletionSelection(video.youtube_id);
                }}
                sx={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  bgcolor: selectedForDeletion.includes(video.youtube_id) ? 'error.main' : 'rgba(0,0,0,0.6)',
                  color: 'white',
                  padding: 0.5,
                  '&:hover': {
                    bgcolor: selectedForDeletion.includes(video.youtube_id) ? 'error.dark' : 'rgba(0,0,0,0.8)',
                  },
                  transition: 'all 0.2s',
                }}
                size="small"
              >
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>

          {/* Content */}
          <CardContent sx={{ flex: 1, py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
            {/* Title */}
            <Typography
              variant="body2"
              sx={{
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
                fontSize: '0.875rem',
              }}
              title={decodeHtml(video.title)}
            >
              {decodeHtml(video.title)}
            </Typography>

            {/* Date, Size, and Status on same line */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3, fontSize: '0.7rem' }}>
                <CalendarTodayIcon sx={{ fontSize: 11 }} />
                {new Date(video.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
              </Typography>
              {video.fileSize && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3, fontSize: '0.7rem' }}>
                  <StorageIcon sx={{ fontSize: 11 }} />
                  {formatFileSize(video.fileSize)}
                </Typography>
              )}
              {mediaTypeInfo && (
                <Chip
                  size="small"
                  icon={mediaTypeInfo.icon}
                  label={mediaTypeInfo.label}
                  color={mediaTypeInfo.color}
                  variant="outlined"
                  sx={{
                    height: 18,
                    fontSize: '0.7rem',
                    '& .MuiChip-icon': { fontSize: 14, ml: 0.5 },
                    '& .MuiChip-label': { px: 0.6 },
                  }}
                />
              )}
              <Chip
                icon={getStatusIcon(status)}
                label={getStatusLabel(status)}
                size="small"
                color={getStatusColor(status)}
                variant={status === 'downloaded' ? 'filled' : 'outlined'}
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  '& .MuiChip-icon': { fontSize: 14, ml: 0.5 },
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Fade>
    );
  };

  // Mobile action drawer
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
        {/* Header */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h6">Channel Videos</Typography>
                {totalCount > 0 && (
                  <Chip label={totalCount} size="small" color="primary" />
                )}
                {oldestVideoDate && !isMobile && (
                  <Typography variant="caption" color="text.secondary">
                    Oldest: {new Date(oldestVideoDate).toLocaleDateString()}
                  </Typography>
                )}
              </Box>

              <Button
                onClick={handleRefreshClick}
                variant="outlined"
                size="small"
                disabled={fetchingAllVideos}
                startIcon={<RefreshIcon />}
              >
                {fetchingAllVideos ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Box>

            {/* Search and filters */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                placeholder="Search videos..."
                size="small"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ flexGrow: 1, minWidth: 200 }}
              />

              {/* View mode toggle - mobile shows list/grid, desktop shows table/grid */}
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={handleViewModeChange}
                size="small"
              >
                {!isMobile && (
                  <ToggleButton value="table">
                    <Tooltip title="Table View">
                      <TableChartIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                )}
                <ToggleButton value="grid">
                  <Tooltip title="Grid View">
                    <ViewModuleIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                {isMobile && (
                  <ToggleButton value="list">
                    <Tooltip title="List View">
                      <ViewListIcon fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                )}
              </ToggleButtonGroup>

              {!isMobile && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={hideDownloaded}
                      onChange={(e) => {
                        setHideDownloaded(e.target.checked);
                        setPage(1);
                      }}
                      size="small"
                    />
                  }
                  label="Hide Downloaded"
                />
              )}
            </Box>

            {/* Action buttons for desktop */}
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadClick}
                  disabled={checkedBoxes.length === 0}
                >
                  Download {checkedBoxes.length > 0 ? `${checkedBoxes.length} ${checkedBoxes.length === 1 ? 'Video' : 'Videos'}` : 'Selected'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSelectAll}
                  disabled={checkedBoxes.length === 0 && paginatedVideos.filter(v => {
                    const status = getVideoStatus(v);
                    return status === 'never_downloaded' || status === 'missing';
                  }).length === 0}
                >
                  Select All This Page
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClearSelection}
                  disabled={checkedBoxes.length === 0}
                >
                  Clear
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteClick}
                  disabled={selectedForDeletion.length === 0 || deleteLoading}
                >
                  Delete {selectedForDeletion.length > 0 ? `${selectedForDeletion.length}` : 'Selected'}
                </Button>
              </Box>
            )}

            {/* Pagination - Always visible at top */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
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
          </Box>

          {/* Progress bar */}
          {fetchingAllVideos && <LinearProgress />}
        </Box>

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
                  {paginatedVideos.map(renderVideoCard)}
                </Grid>
              )}

              {viewMode === 'list' && (
                <Box>
                  {paginatedVideos.map(renderVideoListItem)}
                </Box>
              )}

              {viewMode === 'table' && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox">
                          <Checkbox
                            indeterminate={checkedBoxes.length > 0 && checkedBoxes.length < paginatedVideos.length}
                            checked={paginatedVideos.length > 0 && checkedBoxes.length === paginatedVideos.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleSelectAll();
                              } else {
                                handleClearSelection();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>Thumbnail</TableCell>
                        <TableCell onClick={() => handleSortChange('title')} sx={{ cursor: 'pointer' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            Title
                            {sortBy === 'title' && (
                              sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell onClick={() => handleSortChange('date')} sx={{ cursor: 'pointer' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            Published
                            {sortBy === 'date' && (
                              sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell onClick={() => handleSortChange('duration')} sx={{ cursor: 'pointer' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            Duration
                            {sortBy === 'duration' && (
                              sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell onClick={() => handleSortChange('size')} sx={{ cursor: 'pointer' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            Size
                            {sortBy === 'size' && (
                              sortOrder === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedVideos.map((video) => {
                        const status = getVideoStatus(video);
                        const isSelectable = (status === 'never_downloaded' || status === 'missing') && !video.youtube_removed;
                        const isChecked = checkedBoxes.includes(video.youtube_id);
                        const mediaTypeInfo = getMediaTypeInfo(video.media_type);

                        return (
                          <TableRow
                            key={video.youtube_id}
                            hover
                            sx={{
                              opacity: status === 'members_only' ? 0.6 : 1,
                              cursor: isSelectable ? 'pointer' : 'default',
                            }}
                          >
                            <TableCell padding="checkbox">
                              {isSelectable && (
                                <Checkbox
                                  checked={isChecked}
                                  onChange={(e) => handleCheckChange(video.youtube_id, e.target.checked)}
                                />
                              )}
                              {status === 'downloaded' && (
                                <IconButton
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDeletionSelection(video.youtube_id);
                                  }}
                                  sx={{
                                    color: selectedForDeletion.includes(video.youtube_id) ? 'error.main' : 'action.active',
                                    '&:hover': {
                                      color: 'error.main',
                                      bgcolor: 'error.light',
                                    },
                                  }}
                                  size="small"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              )}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                                <img
                                  src={video.thumbnail}
                                  alt={decodeHtml(video.title)}
                                  style={{ width: 120, height: 67, objectFit: 'cover', borderRadius: 4, display: 'block' }}
                                  loading="lazy"
                                />
                                {video.youtube_removed && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      backgroundColor: 'rgba(211, 47, 47, 0.95)',
                                      color: 'white',
                                      padding: '2px 4px',
                                      fontSize: '0.65rem',
                                      fontWeight: 'bold',
                                      textAlign: 'center',
                                      borderTopLeftRadius: 4,
                                      borderTopRightRadius: 4,
                                    }}
                                  >
                                    Removed From YouTube
                                  </Box>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ mb: 0.5 }}>
                                {decodeHtml(video.title)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {new Date(video.publishedAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {formatDuration(video.duration)}
                            </TableCell>
                            <TableCell>
                              {video.fileSize ? formatFileSize(video.fileSize) : '-'}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                {mediaTypeInfo && (
                                  <Chip
                                    size="small"
                                    icon={mediaTypeInfo.icon}
                                    label={mediaTypeInfo.label}
                                    color={mediaTypeInfo.color}
                                    variant="outlined"
                                  />
                                )}
                                <Chip
                                  icon={getStatusIcon(status)}
                                  label={getStatusLabel(status)}
                                  size="small"
                                  color={getStatusColor(status)}
                                  variant={status === 'downloaded' ? 'filled' : 'outlined'}
                                />
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
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
      <DownloadSettingsDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        onConfirm={handleDownloadConfirm}
        videoCount={checkedBoxes.length}
        missingVideoCount={getMissingVideoCount()}
        defaultResolution={defaultResolution}
        mode="manual"
      />

      {/* Refresh Confirmation Dialog */}
      <Dialog
        open={refreshConfirmOpen}
        onClose={handleRefreshCancel}
        aria-labelledby="refresh-dialog-title"
        aria-describedby="refresh-dialog-description"
      >
        <DialogTitle id="refresh-dialog-title">
          Refresh Channel Videos
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="refresh-dialog-description">
            Refresh will fetch data for all videos for this Channel. This may take some time to complete.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRefreshCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleRefreshConfirm} color="primary" variant="contained">
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={fetchAllError !== null}
        autoHideDuration={6000}
        onClose={() => setFetchAllError(null)}
      >
        <Alert onClose={() => setFetchAllError(null)} severity="error">
          {fetchAllError}
        </Alert>
      </Snackbar>

      <Snackbar
        open={mobileTooltip !== null}
        autoHideDuration={8000}
        onClose={() => setMobileTooltip(null)}
      >
        <Alert onClose={() => setMobileTooltip(null)} severity="info">
          {mobileTooltip}
        </Alert>
      </Snackbar>

      {/* Delete Confirmation Dialog */}
      <DeleteVideosDialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        videoCount={selectedForDeletion.length}
      />

      {/* Success/Error Snackbars for Deletion */}
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
    </>
  );
}

export default ChannelVideos;
