import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Card,
  Box,
  Typography,
  Alert,
  Skeleton,
  Grid,
  Pagination,
  Checkbox,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Chip,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import BlockIcon from '@mui/icons-material/Block';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';

import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import axios from 'axios';

interface PlaylistVideo {
  youtube_id: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  playlist_index: number;
  ignored: boolean;
  added: boolean;
}

interface PlaylistVideosProps {
  token: string;
  playlistId: string;
  playlistQuality: string | null;
  playlistAudioFormat: string | null;
}

type ViewMode = 'grid' | 'list';

function PlaylistVideos({ token, playlistId, playlistQuality, playlistAudioFormat }: PlaylistVideosProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [videos, setVideos] = useState<PlaylistVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideDownloaded, setHideDownloaded] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'list' : 'grid');
  const [checkedBoxes, setCheckedBoxes] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const pageSize = isMobile ? 8 : 12;

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        hideDownloaded: hideDownloaded.toString(),
      });
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/getplaylistvideos/${playlistId}?${params}`, {
        headers: {
          'x-access-token': token,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch playlist videos');
      }

      const data = await response.json();
      setVideos(data.videos || []);
      setTotalCount(data.totalCount || 0);
    } catch (error) {
      console.error('Error fetching playlist videos:', error);
    } finally {
      setLoading(false);
    }
  }, [playlistId, page, pageSize, hideDownloaded, searchQuery, token]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await axios.post(
        `/fetchallplaylistvideos/${playlistId}`,
        {},
        {
          headers: {
            'x-access-token': token,
          },
        }
      );
      
      if (response.status === 200) {
        await fetchVideos();
      }
    } catch (error) {
      console.error('Error refreshing playlist videos:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownload = async () => {
    if (checkedBoxes.length === 0) return;

    try {
      const urls = checkedBoxes.map(youtubeId => `https://www.youtube.com/watch?v=${youtubeId}`);
      
      await axios.post(
        '/triggerspecificdownloads',
        {
          urls,
          overrideSettings: {
            resolution: playlistQuality || undefined,
            audioFormat: playlistAudioFormat || undefined,
          },
        },
        {
          headers: {
            'x-access-token': token,
          },
        }
      );

      setCheckedBoxes([]);
    } catch (error) {
      console.error('Error downloading videos:', error);
    }
  };

  const toggleIgnore = async (youtubeId: string) => {
    try {
      const video = videos.find(v => v.youtube_id === youtubeId);
      const endpoint = video?.ignored 
        ? `/api/playlists/${playlistId}/videos/${youtubeId}/unignore`
        : `/api/playlists/${playlistId}/videos/${youtubeId}/ignore`;
      
      await axios.post(
        endpoint,
        {},
        {
          headers: {
            'x-access-token': token,
          },
        }
      );
      
      await fetchVideos();
    } catch (error) {
      console.error('Error toggling ignore:', error);
    }
  };

  const handleCheckChange = (youtubeId: string) => {
    setCheckedBoxes(prev =>
      prev.includes(youtubeId)
        ? prev.filter(id => id !== youtubeId)
        : [...prev, youtubeId]
    );
  };

  const handleSelectAll = () => {
    if (checkedBoxes.length === paginatedVideos.length) {
      setCheckedBoxes([]);
    } else {
      setCheckedBoxes(paginatedVideos.map(v => v.youtube_id));
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const paginatedVideos = useMemo(() => videos, [videos]);
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Card>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="grid">
              <ViewModuleIcon />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewListIcon />
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh videos">
              <IconButton onClick={handleRefresh} disabled={refreshing} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title={`Download ${checkedBoxes.length} selected`}>
              <span>
                <IconButton 
                  onClick={handleDownload} 
                  disabled={checkedBoxes.length === 0}
                  size="small"
                  color="primary"
                >
                  <DownloadIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 2, alignItems: 'center' }}>
          <Chip
            label={hideDownloaded ? 'Showing undownloaded' : 'Showing all'}
            onClick={() => setHideDownloaded(!hideDownloaded)}
            color={hideDownloaded ? 'primary' : 'default'}
            size="small"
          />
          
          <Typography variant="body2" color="text.secondary">
            {totalCount} videos
          </Typography>

          {checkedBoxes.length > 0 && (
            <Chip
              label={`${checkedBoxes.length} selected`}
              onDelete={() => setCheckedBoxes([])}
              size="small"
            />
          )}
        </Box>
      </Box>

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            color="primary"
            size={isMobile ? 'small' : 'medium'}
          />
        </Box>
      )}

      <Box sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Loading playlist videos...
            </Typography>
            <Grid container spacing={2} sx={{ mt: 2 }}>
              {[...Array(pageSize)].map((_, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={`skeleton-${index}`}>
                  <Skeleton variant="rectangular" height={200} />
                  <Skeleton variant="text" sx={{ mt: 1 }} />
                </Grid>
              ))}
            </Grid>
          </Box>
        ) : videos.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              {searchQuery ? 'No videos found matching your search' : 'No videos in this playlist'}
            </Typography>
          </Box>
        ) : (
          <>
            {viewMode === 'grid' && (
              <Grid container spacing={2}>
                {paginatedVideos.map((video) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={video.youtube_id}>
                    <Card sx={{ position: 'relative' }}>
                      <Checkbox
                        checked={checkedBoxes.includes(video.youtube_id)}
                        onChange={() => handleCheckChange(video.youtube_id)}
                        sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1, bgcolor: 'rgba(0,0,0,0.5)' }}
                      />
                      {video.added && (
                        <Chip
                          label="Downloaded"
                          size="small"
                          color="success"
                          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                        />
                      )}
                      {video.ignored && (
                        <Chip
                          label="Ignored"
                          size="small"
                          sx={{ position: 'absolute', bottom: 90, right: 8, zIndex: 1 }}
                        />
                      )}
                      <Box
                        component="img"
                        src={video.thumbnail || `https://i.ytimg.com/vi/${video.youtube_id}/mqdefault.jpg`}
                        alt={video.title}
                        sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }}
                      />
                      <Box sx={{ p: 1 }}>
                        <Typography variant="body2" noWrap title={video.title}>
                          {video.title}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatDuration(video.duration)}
                          </Typography>
                          <IconButton 
                            size="small" 
                            onClick={() => toggleIgnore(video.youtube_id)}
                            color={video.ignored ? 'primary' : 'default'}
                          >
                            <BlockIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {viewMode === 'list' && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={checkedBoxes.length > 0 && checkedBoxes.length < paginatedVideos.length}
                          checked={paginatedVideos.length > 0 && checkedBoxes.length === paginatedVideos.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedVideos.map((video) => (
                      <TableRow key={video.youtube_id}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={checkedBoxes.includes(video.youtube_id)}
                            onChange={() => handleCheckChange(video.youtube_id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <img
                              src={video.thumbnail || `https://i.ytimg.com/vi/${video.youtube_id}/default.jpg`}
                              alt=""
                              style={{ width: 60, height: 45, objectFit: 'cover', borderRadius: 4 }}
                            />
                            <Typography variant="body2">{video.title}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{formatDuration(video.duration)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {video.added && <Chip label="Downloaded" size="small" color="success" />}
                            {video.ignored && <Chip label="Ignored" size="small" />}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <IconButton 
                            size="small" 
                            onClick={() => toggleIgnore(video.youtube_id)}
                            color={video.ignored ? 'primary' : 'default'}
                          >
                            <BlockIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, newPage) => setPage(newPage)}
                  color="primary"
                  size={isMobile ? 'small' : 'medium'}
                />
              </Box>
            )}
          </>
        )}
      </Box>
    </Card>
  );
}

export default PlaylistVideos;
