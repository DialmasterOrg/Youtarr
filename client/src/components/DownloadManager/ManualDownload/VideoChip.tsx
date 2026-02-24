import React, { useState } from 'react';
import { Chip, Tooltip, Grow, Popover, Typography } from '../../ui';
import { Close as CloseIcon, Lock } from '../../../lib/icons';
import { History as HistoryIcon } from 'lucide-react';
import { VideoInfo } from './types';
import { useThemeEngine } from '../../../contexts/ThemeEngineContext';

interface VideoChipProps {
  video: VideoInfo;
  onDelete: (youtubeId: string) => void;
}

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

const VideoChip: React.FC<VideoChipProps> = ({ video, onDelete }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const mediaTypeInfo = getMediaTypeInfo(video.media_type);
  const { themeMode } = useThemeEngine();

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const getChipColor = (): 'default' | 'success' | 'warning' | 'error' => {
    if (video.isAlreadyDownloaded) return 'warning';  // Changed to warning (yellow/orange)
    if (video.isMembersOnly) return 'error';
    return 'default';
  };

  const chipLabel = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div>
        <div style={{ fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}>
          {truncateText(video.channelName, 20)}
          {video.isAlreadyDownloaded && (
            <button
              type="button"
              onClick={handlePopoverOpen}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: 0, marginLeft: 4 }}
            >
              <HistoryIcon size={14} data-testid="HistoryIcon" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          )}
        </div>
        <div style={{ fontSize: '0.7rem' }}>
          {truncateText(video.videoTitle, 40)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
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
        <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: 'var(--radius-ui)' }}>
          {formatDuration(video.duration)}
        </span>
      </div>
      {video.isMembersOnly && <Lock size={16} data-testid="LockIcon" style={{ marginLeft: 4 }} />}
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
        <Tooltip title={getTooltipTitle()}>
          <Chip
            onClick={() => {}}
            aria-label={getTooltipTitle()}
            label={chipLabel}
            onDelete={() => onDelete(video.youtubeId)}
            deleteIcon={<CloseIcon size={14} data-testid="CloseIcon" />}
            color={getChipColor()}
            variant="filled"
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
