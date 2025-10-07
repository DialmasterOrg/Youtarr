import React from 'react';
import {
  Card,
  Box,
  Typography,
  Checkbox,
  Chip,
  IconButton,
  Grid,
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

interface VideoCardProps {
  video: ChannelVideo;
  isMobile: boolean;
  checkedBoxes: string[];
  hoveredVideo: string | null;
  selectedForDeletion: string[];
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onHoverChange: (videoId: string | null) => void;
  onToggleDeletion: (youtubeId: string) => void;
}

function VideoCard({
  video,
  isMobile,
  checkedBoxes,
  hoveredVideo,
  selectedForDeletion,
  onCheckChange,
  onHoverChange,
  onToggleDeletion,
}: VideoCardProps) {
  const theme = useTheme();
  const status = getVideoStatus(video);
  const isSelectable = status === 'never_downloaded' || status === 'missing';
  const isChecked = checkedBoxes.includes(video.youtube_id);
  const mediaTypeInfo = getMediaTypeInfo(video.media_type);

  return (
    <Fade in timeout={300} key={video.youtube_id}>
      <Grid item xs={12} sm={6} md={4} lg={3}>
        <Card
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: isSelectable ? 'pointer' : 'default',
            opacity: status === 'members_only' ? 0.7 : 1,
            transform: hoveredVideo === video.youtube_id ? 'translateY(-4px)' : 'translateY(0)',
            boxShadow: hoveredVideo === video.youtube_id ? theme.shadows[8] : theme.shadows[1],
            '&:hover': {
              boxShadow: theme.shadows[4],
            },
          }}
          onMouseEnter={() => onHoverChange(video.youtube_id)}
          onMouseLeave={() => onHoverChange(null)}
          onClick={() => isSelectable && onCheckChange(video.youtube_id, !isChecked)}
        >
          {/* Thumbnail with overlay */}
          <Box sx={{ position: 'relative', paddingTop: isMobile ? '52%' : '56.25%', bgcolor: 'grey.900' }}>
            <img
              src={video.thumbnail}
              alt={decodeHtml(video.title)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
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
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  textAlign: 'center',
                  zIndex: 2,
                }}
              >
                Removed From YouTube
              </Box>
            ) : null}

            {/* Duration overlay */}
            <Chip
              label={formatDuration(video.duration)}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                bgcolor: 'rgba(0,0,0,0.8)',
                color: 'white',
                fontSize: '0.75rem',
                height: 22,
              }}
            />

            {/* Selection overlay for download */}
            {isSelectable && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: isChecked ? 'rgba(25, 118, 210, 0.3)' : 'transparent',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  p: 1,
                  transition: 'background-color 0.2s',
                }}
              >
                <Checkbox
                  checked={isChecked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    onCheckChange(video.youtube_id, e.target.checked);
                  }}
                  sx={{
                    color: 'white',
                    bgcolor: 'rgba(0,0,0,0.5)',
                    '&.Mui-checked': {
                      color: 'primary.main',
                    },
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.7)',
                    },
                  }}
                />
              </Box>
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
                  top: 8,
                  right: 8,
                  bgcolor: selectedForDeletion.includes(video.youtube_id) ? 'error.main' : 'rgba(0,0,0,0.6)',
                  color: 'white',
                  '&:hover': {
                    bgcolor: selectedForDeletion.includes(video.youtube_id) ? 'error.dark' : 'rgba(0,0,0,0.8)',
                  },
                  transition: 'all 0.2s',
                  zIndex: 3,
                }}
                size="small"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          {/* Card content */}
          <Box sx={{ p: isMobile ? 1.5 : 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="body2"
              sx={{
                mb: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
                minHeight: '2.6em',
              }}
              title={decodeHtml(video.title)}
            >
              {decodeHtml(video.title)}
            </Typography>

            <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Date, size, and status - same line on mobile, separate on desktop */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CalendarTodayIcon sx={{ fontSize: 12 }} />
                  {isMobile
                    ? new Date(video.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : new Date(video.publishedAt).toLocaleDateString()
                  }
                </Typography>
                {video.fileSize && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <StorageIcon sx={{ fontSize: 12 }} />
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
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
                {isMobile && (
                  <Chip
                    icon={getStatusIcon(status)}
                    label={getStatusLabel(status)}
                    size="small"
                    color={getStatusColor(status)}
                    variant={status === 'downloaded' ? 'filled' : 'outlined'}
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Box>

              {/* Status chip for desktop only */}
              {!isMobile && (
                <Chip
                  icon={getStatusIcon(status)}
                  label={getStatusLabel(status)}
                  size="small"
                  color={getStatusColor(status)}
                  variant={status === 'downloaded' ? 'filled' : 'outlined'}
                  sx={{ width: 'fit-content' }}
                />
              )}
            </Box>
          </Box>
        </Card>
      </Grid>
    </Fade>
  );
}

export default VideoCard;
