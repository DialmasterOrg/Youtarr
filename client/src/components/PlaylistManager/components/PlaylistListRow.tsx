import React from 'react';
import {
  Box,
  Checkbox,
  IconButton,
  ListItem,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Playlist } from '../../../types/Playlist';

interface PlaylistListRowProps {
  playlist: Playlist;
  onNavigate: () => void;
  onDelete: () => void;
  onChange: (updates: Partial<Playlist>) => void;
  onFetchVideos: () => void;
  onDownload: () => void;
}

const PlaylistListRow: React.FC<PlaylistListRowProps> = ({
  playlist,
  onNavigate,
  onDelete,
  onChange,
  onFetchVideos,
  onDownload,
}) => {
  return (
    <ListItem
      data-testid={`playlist-row-${playlist.url}`}
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: 1.5,
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    >
      {/* Enabled Checkbox */}
      <Tooltip title={playlist.enabled ? 'Playlist enabled' : 'Playlist disabled'}>
        <Checkbox
          checked={playlist.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          size="small"
        />
      </Tooltip>

      {/* Playlist Info */}
      <Box
        sx={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
        onClick={onNavigate}
        data-testid={`navigate-${playlist.url}`}
      >
        <Typography
          variant="body1"
          sx={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {playlist.title || playlist.uploader}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {playlist.uploader}
        </Typography>
      </Box>

      {/* Auto-download Checkbox */}
      <Tooltip title={playlist.auto_download_enabled ? 'Auto-download enabled' : 'Auto-download disabled'}>
        <Checkbox
          checked={playlist.auto_download_enabled}
          onChange={(e) => onChange({ auto_download_enabled: e.target.checked })}
          size="small"
          disabled={!playlist.enabled}
        />
      </Tooltip>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Tooltip title="Fetch videos from YouTube">
          <IconButton onClick={onFetchVideos} size="small" color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Download all videos">
          <IconButton onClick={onDownload} size="small" color="success">
            <CloudDownloadIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="View playlist">
          <IconButton onClick={onNavigate} size="small">
            <PlaylistPlayIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete playlist">
          <IconButton onClick={onDelete} size="small" color="error">
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </ListItem>
  );
};

export default PlaylistListRow;
