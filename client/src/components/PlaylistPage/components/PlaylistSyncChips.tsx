import React from 'react';
import { Chip, Stack, Tooltip } from '../../ui';
import { MediaServerStatus, MediaServerType, Playlist } from '../../../types/playlist';

interface PlaylistSyncChipsProps {
  playlist: Playlist;
  serverStatus: MediaServerStatus;
  onToggle: (server: MediaServerType, enabled: boolean) => void;
  disabled?: boolean;
}

const SERVER_LABEL: Record<MediaServerType, string> = {
  plex: 'Plex',
  jellyfin: 'Jellyfin',
  emby: 'Emby',
};

const SYNC_KEY: Record<MediaServerType, keyof Playlist> = {
  plex: 'sync_to_plex',
  jellyfin: 'sync_to_jellyfin',
  emby: 'sync_to_emby',
};

const SERVERS: MediaServerType[] = ['plex', 'jellyfin', 'emby'];

const PlaylistSyncChips: React.FC<PlaylistSyncChipsProps> = ({
  playlist,
  serverStatus,
  onToggle,
  disabled,
}) => {
  return (
    <Stack
      direction="row"
      spacing={1}
      className="flex-wrap gap-2"
      aria-label="Per-server sync toggles"
    >
      {SERVERS.map((server) => {
        const configured = serverStatus[server];
        const enabled = !!playlist[SYNC_KEY[server]];

        const tooltip = configured
          ? enabled
            ? `Click to disable sync to ${SERVER_LABEL[server]}`
            : `Click to enable sync to ${SERVER_LABEL[server]}`
          : `${SERVER_LABEL[server]} is not configured. Add a connection in Settings.`;

        const chip = (
          <Chip
            label={SERVER_LABEL[server]}
            color={enabled && configured ? 'success' : 'default'}
            variant={enabled && configured ? 'filled' : 'outlined'}
            onClick={configured && !disabled ? () => onToggle(server, !enabled) : undefined}
            disabled={!configured || disabled}
            aria-pressed={enabled}
          />
        );

        return (
          <Tooltip key={server} title={tooltip}>
            <span>{chip}</span>
          </Tooltip>
        );
      })}
    </Stack>
  );
};

export default PlaylistSyncChips;
