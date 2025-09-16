import React from 'react';
import { Chip, Tooltip, Box, Grow } from '@mui/material';
import { Close as CloseIcon, CheckCircle, Lock } from '@mui/icons-material';
import { VideoInfo } from './types';

interface VideoChipProps {
  video: VideoInfo;
  onDelete: (youtubeId: string) => void;
}

const VideoChip: React.FC<VideoChipProps> = ({ video, onDelete }) => {
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
    if (video.isAlreadyDownloaded) return 'success';
    if (video.isMembersOnly) return 'error';
    return 'default';
  };

  const getStatusIcon = () => {
    if (video.isAlreadyDownloaded) {
      return <CheckCircle fontSize="small" sx={{ ml: 0.5 }} />;
    }
    if (video.isMembersOnly) {
      return <Lock fontSize="small" sx={{ ml: 0.5 }} />;
    }
    return null;
  };

  const chipLabel = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box>
        <Box sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
          {truncateText(video.channelName, 20)}
        </Box>
        <Box sx={{ fontSize: '0.7rem' }}>
          {truncateText(video.videoTitle, 40)}
        </Box>
      </Box>
      <Box sx={{
        fontSize: '0.65rem',
        bgcolor: 'action.selected',
        px: 0.5,
        py: 0.25,
        borderRadius: 1,
        ml: 1
      }}>
        {formatDuration(video.duration)}
      </Box>
      {getStatusIcon()}
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
    <Grow in={true} timeout={300}>
      <Tooltip title={getTooltipTitle()}>
        <Chip
          label={chipLabel}
          onDelete={() => onDelete(video.youtubeId)}
          deleteIcon={<CloseIcon />}
          color={getChipColor()}
          variant={video.isAlreadyDownloaded || video.isMembersOnly ? 'outlined' : 'filled'}
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
  );
};

export default VideoChip;