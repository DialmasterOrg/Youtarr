import React, { useState } from 'react';
import { Chip, Tooltip, Box, Grow, Popover, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon, History as HistoryIcon, Lock } from '@mui/icons-material';
import { VideoInfo } from './types';

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
      return { label: 'Short', color: 'secondary.main' } as const;
    case 'livestream':
      return { label: 'Live', color: 'error.main' } as const;
    default:
      return { label: formatMediaTypeLabel(normalized), color: 'info.main' } as const;
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box>
        <Box sx={{ fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.3 }}>
          {truncateText(video.channelName, 20)}
          {video.isAlreadyDownloaded && (
            <IconButton
              size="small"
              onClick={handlePopoverOpen}
              sx={{
                p: 0,
                ml: 0.5,
                '&:hover': { backgroundColor: 'transparent' }
              }}
            >
              <HistoryIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
            </IconButton>
          )}
        </Box>
        <Box sx={{ fontSize: '0.7rem' }}>
          {truncateText(video.videoTitle, 40)}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
        {mediaTypeInfo && (
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.4,
              fontSize: '0.65rem',
              fontWeight: 600,
              color: 'text.secondary',
            }}
          >
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: mediaTypeInfo.color,
                flexShrink: 0
              }}
            />
            {mediaTypeInfo.label}
          </Box>
        )}
        <Box sx={{
          fontSize: '0.65rem',
          bgcolor: 'action.selected',
          px: 0.5,
          py: 0.25,
          borderRadius: 1
        }}>
          {formatDuration(video.duration)}
        </Box>
      </Box>
      {video.isMembersOnly && <Lock fontSize="small" sx={{ ml: 0.5 }} />}
    </Box>
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
            label={chipLabel}
            onDelete={() => onDelete(video.youtubeId)}
            deleteIcon={<CloseIcon />}
            color={getChipColor()}
            variant="filled"
            sx={{
              height: 'auto',
              py: 1,
              '& .MuiChip-label': {
                display: 'block',
                whiteSpace: 'normal'
              },
              width: '100%',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'scale(1.02)',
                boxShadow: 2
              }
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
        <Box sx={{ p: 1.5, maxWidth: 200 }}>
          <Typography variant="body2">
            This video was previously downloaded
          </Typography>
        </Box>
      </Popover>
    </>
  );
};

export default VideoChip;
