import React, { useState } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  Menu,
  MenuItem,
  Switch,
  Typography,
} from '../../ui';
import { Refresh as RefreshIcon, MoreHorizontal } from '../../../lib/icons';
import { MediaServerStatus, MediaServerType, Playlist } from '../../../types/playlist';
import InfoHint from './InfoHint';
import PlaylistSyncChips from './PlaylistSyncChips';

interface MediaServerSyncGroupProps {
  playlist: Playlist;
  serverStatus: MediaServerStatus;
  onToggleSync: (server: MediaServerType, enabled: boolean) => void;
  togglePending: boolean;
  publicOnServers: boolean;
  onChangePublic: () => void;
  onSyncNow: () => void;
  onRegenerateM3U: () => void;
  anyConfigured: boolean;
  actionRunning: boolean;
}

const MediaServerSyncGroup: React.FC<MediaServerSyncGroupProps> = ({
  playlist,
  serverStatus,
  onToggleSync,
  togglePending,
  publicOnServers,
  onChangePublic,
  onSyncNow,
  onRegenerateM3U,
  anyConfigured,
  actionRunning,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box
      className="flex-1 min-w-[250px] rounded-[var(--radius-ui)] p-4 flex flex-col gap-4"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-1.5">
        <Typography variant="overline" color="text.secondary">
          Media Server Sync
        </Typography>
        <InfoHint label="About media server sync">
          <div>
            <p className="mb-2">
              Pick which connected servers show this playlist. Only servers connected in
              Settings can be toggled.
            </p>
            <p>
              Youtarr re-syncs after each download and when you Refresh from YouTube. After
              changing these settings, use Sync now to apply them right away.
            </p>
          </div>
        </InfoHint>
      </div>

      <div>
        <PlaylistSyncChips
          playlist={playlist}
          serverStatus={serverStatus}
          onToggle={onToggleSync}
          disabled={togglePending}
        />
      </div>

      <div className="flex items-center gap-2">
        <FormControlLabel
          control={
            <Switch
              checked={publicOnServers}
              disabled={!anyConfigured || actionRunning}
              onChange={() => onChangePublic()}
              color="primary"
            />
          }
          label="Public on media servers"
        />
        <InfoHint label="About public playlists">
          <div>
            <p className="mb-2">
              When on, Jellyfin and Emby make this playlist visible to other users on the
              server.
            </p>
            <p>
              Plex has no automatic public setting; share Plex playlists with each user
              inside Plex.
            </p>
          </div>
        </InfoHint>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant="outlined"
          size="sm"
          onClick={onSyncNow}
          disabled={actionRunning || !anyConfigured}
          startIcon={<RefreshIcon size={16} />}
        >
          Sync now
        </Button>
        <Button
          variant="outlined"
          size="sm"
          aria-label="More playlist actions"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
        >
          <MoreHorizontal size={16} />
        </Button>
        <Menu
          open={!!menuAnchor}
          anchorEl={menuAnchor}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              onRegenerateM3U();
            }}
          >
            Rebuild .m3u file
          </MenuItem>
        </Menu>
      </div>
    </Box>
  );
};

export default MediaServerSyncGroup;
