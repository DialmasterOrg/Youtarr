import React from 'react';
import { Box, Card, CardContent, Stack, Tooltip, Typography } from '../../ui';
import { Info as InfoIcon } from '../../../lib/icons';
import { MediaServerStatus, MediaServerType, Playlist } from '../../../types/playlist';
import LibraryDownloadsGroup from './LibraryDownloadsGroup';
import MediaServerSyncGroup from './MediaServerSyncGroup';

interface PlaylistHeaderProps {
  playlist: Playlist;
  thumbnailUrl: string;
  isMobile: boolean;
  serverStatus: MediaServerStatus;
  anyConfigured: boolean;
  newCount: number | null;
  togglePending: boolean;
  actionRunning: boolean;
  onRefresh: () => void;
  onDownloadAll: () => void;
  onOpenSettings: () => void;
  onToggleAutoDownload: (enabled: boolean) => void;
  onToggleSync: (server: MediaServerType, enabled: boolean) => void;
  onChangePublic: () => void;
  onSyncNow: () => void;
  onRegenerateM3U: () => void;
}

function formatTimestamp(value: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const PlaylistHeader: React.FC<PlaylistHeaderProps> = ({
  playlist,
  thumbnailUrl,
  isMobile,
  serverStatus,
  anyConfigured,
  newCount,
  togglePending,
  actionRunning,
  onRefresh,
  onDownloadAll,
  onOpenSettings,
  onToggleAutoDownload,
  onToggleSync,
  onChangePublic,
  onSyncNow,
  onRegenerateM3U,
}) => {
  return (
    <Card elevation={8} className="mb-4" style={{ borderRadius: 'var(--radius-ui)', overflow: 'hidden' }}>
      <CardContent
        style={{
          paddingLeft: isMobile ? 14 : 16,
          paddingRight: isMobile ? 14 : 16,
          paddingTop: isMobile ? 14 : 16,
          paddingBottom: isMobile ? 14 : 16,
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:gap-5">
          <Box
            component="img"
            src={thumbnailUrl}
            alt="Playlist thumbnail"
            className="w-full md:w-[220px] h-[150px] md:h-[124px] object-cover rounded-xl bg-muted block shrink-0"
            style={{ border: '1px solid var(--border)' }}
          />
          <div className="flex flex-col gap-4 flex-1 min-w-0">
            <div>
              <Typography variant="h5" style={{ fontWeight: 700 }}>
                {playlist.title}
              </Typography>
              {playlist.uploader && (
                <Typography variant="body2" color="text.secondary">
                  By {playlist.uploader}
                </Typography>
              )}
              <Stack direction="row" spacing={2} className="flex-wrap gap-2 mt-1">
                <Typography variant="body2" color="text.secondary" className="inline-flex items-center gap-1">
                  {playlist.video_count} videos
                  <Tooltip title="Private and members-only videos can't be accessed, so they're excluded from this list and never downloaded.">
                    <span
                      className="inline-flex items-center cursor-help"
                      aria-label="Why some videos may be missing"
                    >
                      <InfoIcon size={14} />
                    </span>
                  </Tooltip>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last fetched: {formatTimestamp(playlist.lastFetched)}
                </Typography>
              </Stack>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row">
              <LibraryDownloadsGroup
                autoDownload={playlist.auto_download}
                onToggleAutoDownload={onToggleAutoDownload}
                togglePending={togglePending}
                newCount={newCount}
                onRefresh={onRefresh}
                onDownloadAll={onDownloadAll}
                onOpenSettings={onOpenSettings}
                actionRunning={actionRunning}
              />
              <MediaServerSyncGroup
                playlist={playlist}
                serverStatus={serverStatus}
                onToggleSync={onToggleSync}
                togglePending={togglePending}
                publicOnServers={playlist.public_on_servers}
                onChangePublic={onChangePublic}
                onSyncNow={onSyncNow}
                onRegenerateM3U={onRegenerateM3U}
                anyConfigured={anyConfigured}
                actionRunning={actionRunning}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlaylistHeader;
