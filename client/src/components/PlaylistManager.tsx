import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fab,
  IconButton,
  List,
  Pagination,
  TextField,
  Tooltip,
  Typography,
  Zoom,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useNavigate } from 'react-router-dom';
import WebSocketContext from '../contexts/WebSocketContext';
import { Playlist } from '../types/Playlist';
import { usePlaylistList } from './PlaylistManager/hooks/usePlaylistList';
import { usePlaylistMutations } from './PlaylistManager/hooks/usePlaylistMutations';
import PlaylistListRow from './PlaylistManager/components/PlaylistListRow';

interface PlaylistManagerProps {
  token: string | null;
}

const PlaylistManager: React.FC<PlaylistManagerProps> = ({ token }) => {
  const websocketContext = useContext(WebSocketContext);
  if (!websocketContext) {
    throw new Error('WebSocketContext not found');
  }

  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [newPlaylistUrl, setNewPlaylistUrl] = useState('');
  const [page, setPage] = useState(1);
  const [filterValue, setFilterValue] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [addingPlaylist, setAddingPlaylist] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pageSize = isMobile ? 16 : 20;

  const {
    playlists,
    total,
    totalPages,
    loading,
    error,
    refetch: refetchPlaylists,
  } = usePlaylistList({
    token,
    page,
    pageSize,
    searchTerm: filterValue,
    sortOrder: 'asc',
  });

  const {
    addPlaylist,
    deletePlaylist,
    updatePlaylist,
    fetchPlaylistVideos,
    downloadPlaylist,
    loading: mutationLoading,
    error: mutationError,
  } = usePlaylistMutations(token, refetchPlaylists);

  const [modifiedPlaylists, setModifiedPlaylists] = useState<Map<string, Partial<Playlist>>>(new Map());

  // Message filter for playlist updates
  const messageFilter = useCallback(
    (message: any) => (
      message.destination === 'broadcast' &&
      message.source === 'playlist' &&
      message.type === 'playlistsUpdated'
    ),
    []
  );

  // Handle playlist update messages
  const handleMessage = useCallback(() => {
    refetchPlaylists();
  }, [refetchPlaylists]);

  // Subscribe to playlist updates via WebSocket
  useEffect(() => {
    websocketContext.subscribe(messageFilter, handleMessage);
    return () => {
      websocketContext.unsubscribe(handleMessage);
    };
  }, [websocketContext, messageFilter, handleMessage]);

  // Reset page if it exceeds total pages
  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleAddPlaylist = useCallback(async () => {
    if (!newPlaylistUrl.trim()) return;

    setAddingPlaylist(true);
    try {
      await addPlaylist(newPlaylistUrl);
      setNewPlaylistUrl('');
      setAddDialogOpen(false);
    } catch (err) {
      console.error('Failed to add playlist:', err);
    } finally {
      setAddingPlaylist(false);
    }
  }, [newPlaylistUrl, addPlaylist]);

  const handleDeletePlaylist = useCallback(async (playlistId: string) => {
    if (!window.confirm('Are you sure you want to delete this playlist?')) {
      return;
    }

    try {
      await deletePlaylist(playlistId);
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  }, [deletePlaylist]);

  const handlePlaylistChange = useCallback((playlistId: string, updates: Partial<Playlist>) => {
    setModifiedPlaylists(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(playlistId) || {};
      newMap.set(playlistId, { ...existing, ...updates });
      return newMap;
    });
    setPendingSave(true);
  }, []);

  const handleSaveChanges = useCallback(async () => {
    try {
      for (const [playlistId, updates] of modifiedPlaylists.entries()) {
        await updatePlaylist(playlistId, updates);
      }
      setModifiedPlaylists(new Map());
      setPendingSave(false);
    } catch (err) {
      console.error('Failed to save changes:', err);
    }
  }, [modifiedPlaylists, updatePlaylist]);

  const handleNavigate = useCallback((playlist: Playlist) => {
    if (!playlist.playlist_id) return;
    navigate(`/playlist/${playlist.playlist_id}`);
  }, [navigate]);

  const handleFetchVideos = useCallback(async (playlistId: string) => {
    try {
      await fetchPlaylistVideos(playlistId);
      setSuccessMessage('Playlist videos fetched successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to fetch playlist videos:', err);
    }
  }, [fetchPlaylistVideos]);

  const handleDownloadPlaylist = useCallback(async (playlistId: string) => {
    try {
      const result = await downloadPlaylist(playlistId);
      if (result?.videoCount) {
        setSuccessMessage(`Queued ${result.videoCount} videos for download!`);
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setSuccessMessage('No videos to download');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to download playlist:', err);
    }
  }, [downloadPlaylist]);

  const displayPlaylists = playlists.map(playlist => {
    const modifications = modifiedPlaylists.get(playlist.playlist_id);
    return modifications ? { ...playlist, ...modifications } : playlist;
  });

  return (
    <>
      <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CardHeader
          title="Your Playlists"
          action={
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              size={isMobile ? 'small' : 'medium'}
            >
              Add Playlist
            </Button>
          }
        />
        <Divider />

        {pendingSave && (
          <Alert
            severity="warning"
            action={
              <Button
                color="inherit"
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleSaveChanges}
                disabled={mutationLoading}
              >
                Save Changes
              </Button>
            }
            sx={{ borderRadius: 0 }}
          >
            You have unsaved changes
          </Alert>
        )}

        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Filter playlists..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          />
        </Box>

        <Divider />

        {successMessage && (
          <Box sx={{ p: 2 }}>
            <Alert severity="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {mutationError && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{mutationError}</Alert>
          </Box>
        )}

        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : displayPlaylists.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography color="text.secondary">No playlists found. Add a playlist to get started.</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {displayPlaylists.map((playlist) => (
                <PlaylistListRow
                  key={playlist.playlist_id}
                  playlist={playlist}
                  onNavigate={() => handleNavigate(playlist)}
                  onDelete={() => handleDeletePlaylist(playlist.playlist_id)}
                  onChange={(updates) => handlePlaylistChange(playlist.playlist_id, updates)}
                  onFetchVideos={() => handleFetchVideos(playlist.playlist_id)}
                  onDownload={() => handleDownloadPlaylist(playlist.playlist_id)}
                />
              ))}
            </List>
          )}
        </Box>

        {totalPages > 1 && (
          <>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
                size={isMobile ? 'small' : 'medium'}
              />
            </Box>
          </>
        )}

        <Divider />
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Total playlists: {total}
          </Typography>
        </Box>
      </Card>

      {/* Add Playlist Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Playlist</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Playlist URL"
            type="url"
            fullWidth
            value={newPlaylistUrl}
            onChange={(e) => setNewPlaylistUrl(e.target.value)}
            placeholder="https://www.youtube.com/playlist?list=PLxxx..."
            helperText="Enter a YouTube playlist URL"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddPlaylist}
            variant="contained"
            disabled={!newPlaylistUrl.trim() || addingPlaylist}
            startIcon={addingPlaylist ? <CircularProgress size={16} /> : <AddIcon />}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button (Mobile) */}
      {isMobile && (
        <Zoom in={!addDialogOpen}>
          <Fab
            color="primary"
            aria-label="add playlist"
            sx={{
              position: 'fixed',
              bottom: 16,
              right: 16,
            }}
            onClick={() => setAddDialogOpen(true)}
          >
            <AddIcon />
          </Fab>
        </Zoom>
      )}
    </>
  );
};

export default PlaylistManager;
