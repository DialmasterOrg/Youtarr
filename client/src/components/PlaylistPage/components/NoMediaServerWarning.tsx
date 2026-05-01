import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Typography } from '../../ui';

const NoMediaServerWarning: React.FC = () => {
  return (
    <Alert severity="info" className="mb-3">
      <Typography variant="body2">
        No media server (Plex, Jellyfin, Emby) is currently configured. Playlist videos will still
        download into channel folders, and an M3U fallback file will be written under
        <code className="px-1 mx-1 rounded bg-muted/40">__playlists__/</code>. To create native
        playlists in your media server,{' '}
        <RouterLink
          to="/settings"
          style={{ color: 'inherit', textDecoration: 'underline' }}
        >
          configure a server connection in Settings
        </RouterLink>
        .
      </Typography>
    </Alert>
  );
};

export default NoMediaServerWarning;
