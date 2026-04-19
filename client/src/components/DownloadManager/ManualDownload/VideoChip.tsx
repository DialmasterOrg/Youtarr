import React, { useState } from 'react';
import { Chip, Tooltip, Box, Grow, Popover, Typography, IconButton } from '../../ui';
import { Close as CloseIcon, Lock, Link as LinkIcon, Loader2 } from '../../../lib/icons';
import { History as HistoryIcon } from 'lucide-react';
import { VideoInfo } from './types';

interface VideoChipProps {
  video: VideoInfo;
  onDelete: (youtubeId: string) => void;
  isEnriching?: boolean;
}

const THUMBNAIL_WIDTH = 64;
const THUMBNAIL_HEIGHT = 36;

const formatMediaTypeLabel = (mediaType: string): string => {
  return mediaType
    .split(/[_-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getMediaTypeInfo = (mediaType?: string) => {
  if (!mediaType) return null;
  const normalized = mediaType.toLowerCase();
  if (normalized === 'video') return null;

  switch (normalized) {
    case 'short':
      return { label: 'Short', color: 'var(--muted-foreground)' };
    case 'livestream':
      return { label: 'Live', color: 'var(--destructive)' };
    default:
      return { label: formatMediaTypeLabel(normalized), color: 'var(--primary)' };
  }
};

interface VideoThumbnailProps {
  youtubeId: string;
}

const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ youtubeId }) => {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <img
      src={`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`}
      alt=""
      aria-hidden="true"
      onError={() => setVisible(false)}
      style={{
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
        objectFit: 'cover',
        borderRadius: 4,
        flexShrink: 0,
        backgroundColor: 'var(--muted)',
      }}
    />
  );
};

const VideoChip: React.FC<VideoChipProps> = ({ video, onDelete, isEnriching = false }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (video.isBulkImport) {
    const bulkLabel = (
      <Box className="flex items-center gap-2 w-full min-w-0">
        <VideoThumbnail youtubeId={video.youtubeId} />
        {isEnriching ? (
          <Loader2
            size={14}
            data-testid="EnrichingSpinner"
            className="animate-spin"
            style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}
            aria-label="Fetching video details"
          />
        ) : (
          <LinkIcon
            size={14}
            data-testid="LinkIcon"
            style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}
          />
        )}
        <Box className="min-w-0 flex-1">
          <Box
            className="text-xs font-bold truncate"
            style={{ color: 'var(--foreground)' }}
          >
            {video.youtubeId}
          </Box>
          <Box
            className="text-[0.7rem] truncate"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {isEnriching ? 'Fetching details...' : 'URL-only import'}
          </Box>
        </Box>
      </Box>
    );

    return (
      <Grow in={true} timeout={300}>
        <Tooltip title={video.url} fullWidth>
          <Chip
            onClick={() => {}}
            aria-label={video.url}
            label={bulkLabel}
            onDelete={() => onDelete(video.youtubeId)}
            deleteIcon={<CloseIcon size={14} data-testid="CloseIcon" />}
            color="default"
            variant="filled"
            className="!justify-start"
            labelClassName="flex-1 min-w-0 !overflow-visible !whitespace-normal"
            style={{
              height: 'auto',
              paddingTop: 8,
              paddingBottom: 8,
              width: '100%',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--chip-shadow)',
            }}
          />
        </Tooltip>
      </Grow>
    );
  }

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const mediaTypeInfo = getMediaTypeInfo(video.media_type);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formattedPublishDate = video.publishedAt
    ? new Date(video.publishedAt * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      })
    : null;

  const getChipColor = (): 'default' | 'success' | 'warning' | 'error' => {
    if (video.isAlreadyDownloaded) return 'warning';
    if (video.isMembersOnly) return 'error';
    return 'default';
  };

  const chipLabel = (
    <div className="flex items-center gap-2 w-full min-w-0">
      <VideoThumbnail youtubeId={video.youtubeId} />
      <div className="min-w-0 flex-1 flex flex-col">
        <div className="flex items-center gap-1 text-[0.75rem] font-bold min-w-0">
          <span className="truncate">{video.channelName}</span>
          {video.isAlreadyDownloaded && (
            <IconButton
              size="small"
              aria-label="Download history"
              onClick={handlePopoverOpen}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 0, flexShrink: 0 }}
            >
              <HistoryIcon size={14} data-testid="HistoryIcon" style={{ color: 'var(--muted-foreground)' }} />
            </IconButton>
          )}
        </div>
        <div className="text-[0.7rem] truncate">
          {video.videoTitle}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <div className="flex items-center gap-1">
          {mediaTypeInfo && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: '0.65rem',
                fontWeight: 600,
                color: 'var(--muted-foreground)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: mediaTypeInfo.color,
                  flexShrink: 0,
                  display: 'inline-block',
                }}
              />
              {mediaTypeInfo.label}
            </span>
          )}
          {video.duration > 0 && (
            <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: 'var(--radius-ui)' }}>
              {formatDuration(video.duration)}
            </span>
          )}
          {video.isMembersOnly && <Lock size={16} data-testid="LockIcon" />}
        </div>
        {formattedPublishDate && (
          <span
            style={{
              fontSize: '0.6rem',
              color: 'var(--muted-foreground)',
              whiteSpace: 'nowrap',
            }}
          >
            {formattedPublishDate}
          </span>
        )}
      </div>
    </div>
  );

  const getTooltipTitle = () => {
    if (video.isAlreadyDownloaded) {
      return `${video.videoTitle} - Already downloaded`;
    }
    if (video.isMembersOnly) {
      return `${video.videoTitle} - Members-only content (cannot download)`;
    }
    return video.videoTitle;
  };

  return (
    <>
      <Grow in={true} timeout={300}>
        <Tooltip title={getTooltipTitle()} fullWidth>
          <Chip
            onClick={() => {}}
            aria-label={getTooltipTitle()}
            label={chipLabel}
            onDelete={() => onDelete(video.youtubeId)}
            deleteIcon={<CloseIcon size={14} data-testid="CloseIcon" />}
            color={getChipColor()}
            variant="filled"
            className="!justify-start"
            labelClassName="flex-1 min-w-0 !overflow-visible !whitespace-normal"
            style={{
              height: 'auto',
              paddingTop: 8,
              paddingBottom: 8,
              width: '100%',
              transition: 'all 0.2s ease',
              boxShadow: 'var(--chip-shadow)',
            }}
          />
        </Tooltip>
      </Grow>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <div style={{ padding: '12px 16px', maxWidth: 200 }}>
          <Typography variant="body2">
            This video was previously downloaded
          </Typography>
        </div>
      </Popover>
    </>
  );
};

export default VideoChip;
