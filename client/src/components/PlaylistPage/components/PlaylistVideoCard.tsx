import React from 'react';
import { Button, Card, CardContent, Checkbox, Chip, Tooltip, Typography } from '../../ui';
import { PlaylistVideo } from '../../../types/playlist';
import { formatDurationClock } from '../../../utils';
import { isDownloadable, statusLabel, PublishedDate, toDownloadFileProps } from './playlistVideoHelpers';
import DownloadFormatIndicator from '../../shared/DownloadFormatIndicator';
import WatchedChip from '../../shared/WatchedChip';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_COMPACT_CHIP_OVERRIDES } from '../../shared/chipStyles';

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 68;

const compactStatusChipStyle: React.CSSProperties = {
  ...SHARED_STATUS_CHIP_SMALL_STYLE,
  ...SHARED_COMPACT_CHIP_OVERRIDES,
};

interface PlaylistVideoCardProps {
  video: PlaylistVideo;
  onIgnore: (ytId: string) => void;
  onUnignore: (ytId: string) => void;
  onVideoClick: (video: PlaylistVideo) => void;
  pendingId?: string | null;
  isSelected: (ytId: string) => boolean;
  onToggle: (ytId: string) => void;
}

const PlaylistVideoCard: React.FC<PlaylistVideoCardProps> = ({
  video,
  onIgnore,
  onUnignore,
  onVideoClick,
  pendingId,
  isSelected,
  onToggle,
}) => {
  const status = statusLabel(video);
  const selectable = isDownloadable(video);
  const isPending = pendingId === video.youtube_id;

  return (
    <Card
      className="mb-3 flex items-stretch cursor-pointer"
      style={{ borderRadius: 'var(--radius-ui)' }}
      onClick={() => onVideoClick(video)}
    >
      <div
        className="relative shrink-0 overflow-hidden bg-[var(--media-placeholder-background)] rounded-[var(--radius-thumb)] self-center ml-2"
        style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
      >
        {video.thumbnail && (
          <img
            src={video.thumbnail}
            alt=""
            className="block object-cover rounded-[var(--radius-thumb)]"
            style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
            loading="lazy"
          />
        )}
        {selectable && (
          <div
            className="absolute top-1 left-1 z-10 rounded bg-[var(--media-overlay-background)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected(video.youtube_id)}
              onChange={() => onToggle(video.youtube_id)}
              aria-label={`Select ${video.title || video.youtube_id}`}
            />
          </div>
        )}
      </div>

      <CardContent className="flex-1 min-w-0 py-2 px-3">
        <Typography variant="body2" className="line-clamp-2 mb-1" title={video.title || video.youtube_id}>
          {video.title || video.youtube_id}
        </Typography>
        <Typography variant="caption" className="text-muted-foreground line-clamp-1 block">
          {video.channel_name || '-'}
        </Typography>
        <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
          <PublishedDate value={video.published_at} />
          <span className="whitespace-nowrap">{formatDurationClock(video.duration) || '-'}</span>
          {video.downloaded ? (
            <>
              <DownloadFormatIndicator {...toDownloadFileProps(video)} orientation="horizontal" compact />
              {video.ignored && (
                <Chip label={status.label} color={status.color} size="small" style={compactStatusChipStyle} />
              )}
            </>
          ) : (
            <Chip label={status.label} color={status.color} size="small" style={compactStatusChipStyle} />
          )}
          <WatchedChip watchedBy={video.watched_by || []} compact />
        </div>
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          {video.ignored ? (
            <Tooltip title="Include this video in this playlist's downloads and server sync again">
              <Button
                size="sm"
                variant="outlined"
                className="h-7 px-2.5"
                onClick={() => onUnignore(video.youtube_id)}
                disabled={isPending}
              >
                Include
              </Button>
            </Tooltip>
          ) : (
            <Tooltip
              title={
                video.downloaded
                  ? 'Exclude from this playlist: removed from synced server playlists and M3U files; the file stays on disk'
                  : 'Exclude from this playlist: skipped when downloading this playlist'
              }
            >
              <Button
                size="sm"
                variant="outlined"
                className="h-7 px-2.5"
                onClick={() => onIgnore(video.youtube_id)}
                disabled={isPending}
              >
                Exclude
              </Button>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PlaylistVideoCard;
