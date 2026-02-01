import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  Grid, 
  Typography, 
  Box, 
  IconButton, 
  Chip,
  Alert,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderIcon from '@mui/icons-material/Folder';
import VideocamIcon from '@mui/icons-material/Videocam';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import PlaylistVideos from './PlaylistPage/PlaylistVideos';
import PlaylistSettingsDialog from './PlaylistPage/PlaylistSettingsDialog';

interface Playlist {
  playlist_id: string;
  title: string;
  uploader: string;
  thumbnail: string | null;
  enabled: boolean;
  auto_download_enabled: boolean;
  video_quality: string | null;
  audio_format: string | null;
  sub_folder: string | null;
  min_duration: number | null;
  max_duration: number | null;
  title_filter_regex: string | null;
  folder_name: string | null;
  description?: string | null;
}

interface PlaylistPageProps {
  token: string;
}

function PlaylistPage({ token }: PlaylistPageProps) {
  const { playlist_id } = useParams<{ playlist_id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [regexAnchorEl, setRegexAnchorEl] = useState<HTMLElement | null>(null);
  const [regexDialogOpen, setRegexDialogOpen] = useState(false);

  useEffect(() => {
    if (!playlist_id) return;

    const fetchPlaylist = async () => {
      try {
        const response = await fetch(`/api/playlists/${playlist_id}`, {
          headers: {
            'x-access-token': token,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch playlist');
        }

        const data = await response.json();
        setPlaylist(data);
      } catch (err) {
        console.error('Error fetching playlist:', err);
        setError('Failed to load playlist');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylist();
  }, [playlist_id, token]);

  const handleSettingsSaved = (updatedSettings: any) => {
    if (playlist) {
      setPlaylist({
        ...playlist,
        ...updatedSettings
      });
    }
  };

  const handleRegexClick = (event: React.MouseEvent<HTMLElement>) => {
    if (isMobile) {
      setRegexDialogOpen(true);
    } else {
      setRegexAnchorEl(event.currentTarget);
    }
  };

  const handleRegexClose = () => {
    setRegexAnchorEl(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading playlist...</Typography>
      </Box>
    );
  }

  if (error || !playlist) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Playlist not found'}</Alert>
      </Box>
    );
  }

  // Helper functions (reused from ChannelPage pattern)
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const isUsingDefaultSubfolder = () => {
    return playlist.sub_folder === '__USE_GLOBAL_DEFAULT__' || (!playlist.sub_folder && !playlist.folder_name);
  };

  const isExplicitlyNoSubfolder = () => {
    return playlist.sub_folder === '' || playlist.folder_name === '';
  };

  const renderSubFolder = () => {
    let displayText: string;
    let isSpecial = false;

    if (isExplicitlyNoSubfolder()) {
      // null/empty = root (backwards compatible)
      displayText = 'root';
      isSpecial = true;
    } else if (isUsingDefaultSubfolder()) {
      // Use global default
      displayText = 'global default';
      isSpecial = true;
    } else {
      // Specific subfolder
      const actualSubfolder = playlist.folder_name || playlist.sub_folder;
      displayText = `__${actualSubfolder}/`;
    }

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <FolderIcon fontSize="small" />
        <Typography variant="body2" sx={{ fontStyle: isSpecial ? 'italic' : 'normal', color: isSpecial ? 'text.secondary' : 'text.primary' }}>
          {displayText}
        </Typography>
      </Box>
    );
  };

  const renderFilterIndicators = () => {
    const filters = [];

    // Quality filter
    if (playlist.video_quality) {
      filters.push(
        <Chip
          key="quality"
          icon={<VideocamIcon />}
          label={`${playlist.video_quality}p`}
          size="small"
          variant="outlined"
        />
      );
    }

    // Duration filters
    const minDur = formatDuration(playlist.min_duration);
    const maxDur = formatDuration(playlist.max_duration);
    if (minDur || maxDur) {
      const label = minDur && maxDur 
        ? `${minDur} - ${maxDur}`
        : minDur 
          ? `≥ ${minDur}`
          : `≤ ${maxDur}`;
      
      filters.push(
        <Chip
          key="duration"
          label={label}
          size="small"
          variant="outlined"
        />
      );
    }

    // Regex filter (clickable)
    if (playlist.title_filter_regex) {
      filters.push(
        <Chip
          key="regex"
          label="Title Filter"
          size="small"
          variant="outlined"
          onClick={handleRegexClick}
          sx={{ cursor: 'pointer' }}
        />
      );
    }

    return filters.length > 0 ? filters : null;
  };

  const textToHTML = (text: string | null | undefined) => {
    if (!text) return null;
    return text
      .split('\n')
      .map((line, i) => <React.Fragment key={i}>{line}<br /></React.Fragment>);
  };

  const filters = renderFilterIndicators();
  const regexPopoverOpen = Boolean(regexAnchorEl);

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            {/* Header */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={() => navigate('/playlists')} size="small">
                  <ArrowBackIcon />
                </IconButton>
                <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
                  {playlist.title}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip 
                    label={playlist.enabled ? 'Enabled' : 'Disabled'} 
                    color={playlist.enabled ? 'success' : 'default'}
                    size="small"
                  />
                  {playlist.auto_download_enabled && (
                    <Chip 
                      label="Auto-download" 
                      color="primary"
                      size="small"
                    />
                  )}
                  <IconButton 
                    onClick={() => setSettingsOpen(true)}
                    size="small"
                    sx={{ ml: 1 }}
                  >
                    <SettingsIcon />
                  </IconButton>
                </Box>
              </Box>
            </Grid>

            {/* Thumbnail */}
            <Grid item xs={12} sm={4} md={3}>
              {playlist.thumbnail && (
                <Box
                  component="img"
                  src={playlist.thumbnail}
                  alt={playlist.title}
                  sx={{
                    width: '100%',
                    borderRadius: 1,
                    aspectRatio: '16/9',
                    objectFit: 'cover',
                  }}
                />
              )}
            </Grid>

            {/* Details */}
            <Grid item xs={12} sm={8} md={9}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Uploader */}
                <Typography variant="body2" color="text.secondary">
                  <strong>Uploader:</strong> {playlist.uploader}
                </Typography>

                {/* Subfolder */}
                {renderSubFolder()}

                {/* Filters */}
                {filters && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Filters:
                    </Typography>
                    {filters}
                  </Box>
                )}

                {/* Description */}
                {playlist.description && (
                  <Box
                    sx={{
                      mt: 1,
                      p: 1.5,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      maxHeight: 150,
                      overflowY: 'auto'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {textToHTML(playlist.description)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Videos Component */}
      <PlaylistVideos 
        token={token} 
        playlistId={playlist_id!}
        playlistQuality={playlist.video_quality}
        playlistAudioFormat={playlist.audio_format}
      />

      {/* Settings Dialog */}
      <PlaylistSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        playlistId={playlist_id!}
        playlistName={playlist.title}
        token={token}
        onSettingsSaved={handleSettingsSaved}
      />

      {/* Regex Popover (Desktop) */}
      <Popover
        open={regexPopoverOpen}
        anchorEl={regexAnchorEl}
        onClose={handleRegexClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 400 }}>
          <Typography variant="subtitle2" gutterBottom>
            Title Filter Regex
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {playlist.title_filter_regex}
          </Typography>
        </Box>
      </Popover>

      {/* Regex Dialog (Mobile) */}
      <Dialog
        open={regexDialogOpen}
        onClose={() => setRegexDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Title Filter Regex</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {playlist.title_filter_regex}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegexDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default PlaylistPage;
