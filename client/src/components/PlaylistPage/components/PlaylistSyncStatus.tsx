import React, { useEffect, useState } from 'react';
import { Typography } from '../../ui';
import {
  MediaServerStatus,
  MediaServerType,
  Playlist,
  PlaylistServerSyncState,
  PlaylistSyncStatus as SyncStatus,
} from '../../../types/playlist';
import { formatRelativeDate } from '../../../utils/formatters';
import { MEDIA_SERVERS, MEDIA_SERVER_LABEL, MEDIA_SERVER_SYNC_KEY } from '../playlistConstants';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const AGE_REFRESH_MS = MINUTE_MS;

interface PlaylistSyncStatusProps {
  playlist: Playlist;
  serverStatus: MediaServerStatus;
  // null until the playlist detail has loaded.
  syncStatus?: SyncStatus | null;
}

// "just now", "5 min ago", "3 hours ago", then days and longer.
function formatSyncAge(iso: string, now: number): string {
  const elapsed = now - Date.parse(iso);
  if (!Number.isFinite(elapsed) || elapsed < MINUTE_MS) return 'just now';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  return formatRelativeDate(iso, new Date(now)) ?? 'just now';
}

interface ServerLine {
  headline: string;
  reason?: string;
  lastSynced?: string;
}

function describeServer(
  state: PlaylistServerSyncState | undefined,
  syncing: boolean,
  now: number
): ServerLine {
  if (syncing) return { headline: 'Syncing...' };
  if (state?.last_error) {
    return {
      headline: 'Not synced',
      reason: state.last_error,
      lastSynced: state.last_synced_at
        ? `Last synced ${formatSyncAge(state.last_synced_at, now)}`
        : undefined,
    };
  }
  if (state?.last_synced_at) {
    return { headline: `Synced ${formatSyncAge(state.last_synced_at, now)}` };
  }
  return { headline: 'Not synced yet' };
}

/** The last media server sync result, one line per server the playlist syncs to. */
const PlaylistSyncStatus: React.FC<PlaylistSyncStatusProps> = ({
  playlist,
  serverStatus,
  syncStatus,
}) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), AGE_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const servers: MediaServerType[] = MEDIA_SERVERS.filter(
    (server) => serverStatus[server] && !!playlist[MEDIA_SERVER_SYNC_KEY[server]]
  );
  if (!syncStatus || servers.length === 0) return null;

  return (
    <ul aria-label="Sync status" className="m-0 p-0 list-none flex flex-col gap-2">
      {servers.map((server) => {
        const line = describeServer(syncStatus.servers[server], syncStatus.syncing, now);
        return (
          <li key={server} aria-label={MEDIA_SERVER_LABEL[server]}>
            <Typography variant="body2">
              <span className="font-semibold">{MEDIA_SERVER_LABEL[server]}:</span> {line.headline}
            </Typography>
            {line.reason && (
              <Typography variant="body2" color="text.secondary">
                {line.reason}
              </Typography>
            )}
            {line.lastSynced && (
              <Typography variant="body2" color="text.secondary">
                {line.lastSynced}
              </Typography>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default PlaylistSyncStatus;
