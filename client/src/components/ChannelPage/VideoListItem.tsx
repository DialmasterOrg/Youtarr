import React from 'react';
import {
  Card,
  Box,
  Typography,
  Checkbox,
  Chip,
  IconButton,
  CardContent,
  Fade,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import StorageIcon from '@mui/icons-material/Storage';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { formatFileSize, decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo } from '../../utils/videoStatus';
import StillLiveDot from './StillLiveDot';

interface VideoListItemProps {
  video: ChannelVideo;
  checkedBoxes: string[];
  selectedForDeletion: string[];
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onToggleDeletion: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
}

function VideoListItem({
  video,
  checkedBoxes,
  selectedForDeletion,
  onCheckChange,
  onToggleDeletion,
  onMobileTooltip,
}: VideoListItemProps) {
  const theme = useTheme();
  const status = getVideoStatus(video);
  // Check if video is still live (not "was_live" and not null/undefined)
  const isStillLive = video.live_status && video.live_status !== 'was_live';
  const isSelectable = (status === 'never_downloaded' || status === 'missing') && !isStillLive;
  const isChecked = checkedBoxes.includes(video.youtube_id);
  const mediaTypeInfo = getMediaTypeInfo(video.media_type);

  return (
    <Fade in timeout={300} key={video.youtube_id}>
      <Card
        sx={{
          mb: 1.5,
          display: 'flex',
          position: 'relative',
          transition: 'all 0.2s ease',
          cursor: isSelectable ? 'pointer' : 'default',
          opacity: status === 'members_only' ? 0.7 : 1,
          '&:hover': {
            boxShadow: theme.shadows[3],
          },
        }}
        onClick={() => isSelectable && onCheckChange(video.youtube_id, !isChecked)}
      >
        {/* Thumbnail */}
        <Box
          sx={{
            position: 'relative',
            // Keep container size consistent for all videos
            width: 120,
            minWidth: 120,
            height: 90,
            bgcolor: 'grey.900',
          }}
        >
          <img
            src={video.thumbnail}
            alt={decodeHtml(video.title)}
            style={{
              width: '100%',
              height: '100%',
              // Shorts use contain to show full portrait thumbnail with black bars
              objectFit: video.media_type === 'short' ? 'contain' : 'cover',
            }}
            loading="lazy"
          />

          {/* YouTube Removed Banner */}
          {video.youtube_removed ? (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(211, 47, 47, 0.95)',
                color: 'white',
                padding: '2px 4px',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                textAlign: 'center',
                zIndex: 2,
              }}
            >
              Removed From YouTube
            </Box>
          ) : null}

          {/* Duration overlay - hide for shorts since duration isn't available from flat-playlist */}
          {video.media_type !== 'short' && (
            <Chip
              label={formatDuration(video.duration)}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                bgcolor: 'rgba(0,0,0,0.8)',
                color: 'white',
                fontSize: '0.7rem',
                height: 18,
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          )}

          {/* Still Live indicator or Checkbox for selectable videos */}
          {isStillLive ? (
            <Box
              sx={{
                position: 'absolute',
                top: 4,
                left: 4,
                zIndex: 2,
              }}
            >
              <StillLiveDot isMobile onMobileClick={onMobileTooltip} />
            </Box>
          ) : isSelectable && (
            <Checkbox
              checked={isChecked}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onCheckChange(video.youtube_id, e.target.checked);
              }}
              sx={{
                position: 'absolute',
                top: 2,
                left: 2,
                color: 'white',
                bgcolor: 'rgba(0,0,0,0.5)',
                padding: 0.5,
                '&.Mui-checked': {
                  color: 'primary.main',
                  bgcolor: 'rgba(0,0,0,0.7)',
                },
                '& .MuiSvgIcon-root': { fontSize: 20 },
              }}
            />
          )}

          {/* Delete icon for downloaded videos */}
          {status === 'downloaded' && (
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                onToggleDeletion(video.youtube_id);
              }}
              sx={{
                position: 'absolute',
                top: 2,
                left: 2,
                bgcolor: selectedForDeletion.includes(video.youtube_id) ? 'error.main' : 'rgba(0,0,0,0.6)',
                color: 'white',
                padding: 0.5,
                '&:hover': {
                  bgcolor: selectedForDeletion.includes(video.youtube_id) ? 'error.dark' : 'rgba(0,0,0,0.8)',
                },
                transition: 'all 0.2s',
              }}
              size="small"
            >
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>

        {/* Content */}
        <CardContent sx={{ flex: 1, py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
          {/* Title */}
          <Typography
            variant="body2"
            sx={{
              mb: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.3,
              fontSize: '0.875rem',
            }}
            title={decodeHtml(video.title)}
          >
            {decodeHtml(video.title)}
          </Typography>

          {/* Date, Size, and Status on same line */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 'auto' }}>
          {video.media_type !== 'short' && video.publishedAt && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3, fontSize: '0.7rem' }}>
              <CalendarTodayIcon sx={{ fontSize: 11 }} />
              {new Date(video.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
            </Typography>
          )}
            {video.fileSize && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3, fontSize: '0.7rem' }}>
                <StorageIcon sx={{ fontSize: 11 }} />
                {formatFileSize(video.fileSize)}
              </Typography>
            )}
            {mediaTypeInfo && (
              <Chip
                size="small"
                icon={mediaTypeInfo.icon}
                label={mediaTypeInfo.label}
                color={mediaTypeInfo.color}
                variant="outlined"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  '& .MuiChip-icon': { fontSize: 14, ml: 0.5 },
                  '& .MuiChip-label': { px: 0.6 },
                }}
              />
            )}
            <Chip
              icon={getStatusIcon(status)}
              label={getStatusLabel(status)}
              size="small"
              color={getStatusColor(status)}
              variant={status === 'downloaded' ? 'filled' : 'outlined'}
              sx={{
                height: 20,
                fontSize: '0.7rem',
                '& .MuiChip-icon': { fontSize: 14, ml: 0.5 },
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>
        </CardContent>
      </Card>
    </Fade>
  );
}

export default VideoListItem;
