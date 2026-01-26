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
  Tooltip,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import StorageIcon from '@mui/icons-material/Storage';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { formatFileSize, decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo } from '../../utils/videoStatus';
import StillLiveDot from './StillLiveDot';
import RatingBadge from '../shared/RatingBadge';

interface VideoCardProps {
  video: ChannelVideo;
  isMobile: boolean;
  checkedBoxes: string[];
  hoveredVideo: string | null;
  selectedForDeletion: string[];
  selectionMode: 'download' | 'delete' | null;
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onHoverChange: (videoId: string | null) => void;
  onDeletionChange: (videoId: string, isChecked: boolean) => void;
  onToggleIgnore: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
  isInteractive?: boolean;
}

function VideoCard({
  video,
  isMobile,
  checkedBoxes,
  hoveredVideo,
  selectedForDeletion,
  selectionMode,
  onCheckChange,
  onHoverChange,
  onDeletionChange,
  onToggleIgnore,
  onMobileTooltip,
  isInteractive = false,
}: VideoCardProps) {
  const status = getVideoStatus(video);
  // Check if video is still live (not "was_live" and not null/undefined)
  const isStillLive = video.live_status && video.live_status !== 'was_live';
  const isDownloadSelectable = (status === 'never_downloaded' || status === 'missing' || status === 'ignored') && !isStillLive;
  const isDeleteSelectable = video.added && !video.removed && !isStillLive;
  const isDownloadAllowed = selectionMode !== 'delete';
  const isDeleteAllowed = selectionMode !== 'download';
  const isChecked = checkedBoxes.includes(video.youtube_id);
  const isDeleteChecked = selectedForDeletion.includes(video.youtube_id);
  const mediaTypeInfo = getMediaTypeInfo(video.media_type);
  const isIgnored = status === 'ignored';
  const baseTransform = isInteractive ? 'var(--sticker-rest-transform)' : 'translate(0, 0)';
  const isClickable = (isDownloadSelectable && isDownloadAllowed) || (isDeleteSelectable && isDeleteAllowed);

  return (
    <Fade in timeout={300} key={video.youtube_id}>
      <Grid item xs={12} sm={6} md={4} lg={3}>
        <Card
          /* toggle 'hover:animate-wiggle' here */
          className={isInteractive ? 'wiggle-card' : undefined}
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: isClickable ? 'pointer' : 'default',
            opacity: status === 'members_only' || isIgnored ? 0.7 : 1,
            transform: hoveredVideo === video.youtube_id ? 'var(--sticker-hover-transform)' : baseTransform,
            boxShadow: hoveredVideo === video.youtube_id ? 'var(--card-hover-shadow)' : 'var(--shadow-soft)',
            '&:hover': {
              boxShadow: 'var(--card-hover-shadow)',
            },
          }}
          onMouseEnter={() => onHoverChange(video.youtube_id)}
          onMouseLeave={() => onHoverChange(null)}
          onClick={() => {
            if (isDownloadSelectable && isDownloadAllowed) {
              onCheckChange(video.youtube_id, !isChecked);
              return;
            }
            if (isDeleteSelectable && isDeleteAllowed) {
              onDeletionChange(video.youtube_id, !isDeleteChecked);
            }
          }}
        >
          {/* Thumbnail with overlay */}
          <Box sx={{
            position: 'relative',
            // Keep container size consistent - shorts use contain to show with black bars
            paddingTop: isMobile ? '52%' : '56.25%',
            bgcolor: 'grey.900'
          }}>
            <img
              src={video.thumbnail}
              alt={decodeHtml(video.title)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
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

            {/* Duration overlay - hide for shorts since duration isn't available from flat-playlist */}
            {video.media_type !== 'short' && (
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
            )}

            {/* Still Live indicator or Selection overlay for download */}
            {isStillLive ? (
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  zIndex: 2,
                }}
              >
                <StillLiveDot isMobile={isMobile} onMobileClick={onMobileTooltip} />
              </Box>
            ) : isDownloadSelectable && isDownloadAllowed && (
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

            {/* Delete checkbox for downloaded videos */}
            {isDeleteSelectable && isDeleteAllowed && (
              <Checkbox
                checked={isDeleteChecked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onDeletionChange(video.youtube_id, e.target.checked);
                }}
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  '&.Mui-checked': {
                    color: 'error.main',
                  },
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.7)',
                  },
                }}
              />
            )}

            {/* Ignore/Unignore button - for videos not currently on disk (never downloaded or missing) */}
            {!isStillLive && (!video.added || video.removed) && (
              <Tooltip
                title={isIgnored ? "Click to unignore (allow auto-downloads)" : "Click to ignore (prevent auto-downloads)"}
                arrow
                placement="top"
              >
                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleIgnore(video.youtube_id);
                  }}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: isIgnored ? 'warning.main' : 'rgba(0,0,0,0.6)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: isIgnored ? 'warning.dark' : 'rgba(0,0,0,0.8)',
                    },
                    transition: 'all 0.2s',
                    zIndex: 3,
                  }}
                  size="small"
                >
                  {isIgnored ? <CheckCircleOutlineIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
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

            <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {/* Date and Size on same line */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {video.media_type !== 'short' && video.publishedAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarTodayIcon sx={{ fontSize: 12 }} />
                    {isMobile
                      ? new Date(video.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                      : new Date(video.publishedAt).toLocaleDateString()
                    }
                  </Typography>
                )}
                {video.fileSize && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <StorageIcon sx={{ fontSize: 12 }} />
                    {formatFileSize(video.fileSize)}
                  </Typography>
                )}
              </Box>

              {/* Media type, rating, and status chips on same line */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                {mediaTypeInfo && (
                  <Chip
                    size="small"
                    icon={mediaTypeInfo.icon}
                    label={mediaTypeInfo.label}
                    color={mediaTypeInfo.color}
                    variant="outlined"
                    sx={{ 
                      height: 24, 
                      fontSize: '0.7rem', 
                      minWidth: 'fit-content',
                      boxShadow: 'none',
                      transition: 'box-shadow 200ms var(--transition-bouncy)',
                      '&:hover': {
                        boxShadow: 'var(--shadow-hard)',
                      }
                    }}
                  />
                )}
                <RatingBadge
                  rating={video.normalized_rating}
                  ratingSource={video.rating_source}
                  showNA={true}
                  size="small"
                  sx={{ height: 24, flexShrink: 0 }}
                />
                <Chip
                  icon={getStatusIcon(status)}
                  label={getStatusLabel(status)}
                  size="small"
                  color={getStatusColor(status)}
                  variant={status === 'downloaded' ? 'filled' : 'outlined'}
                  sx={{ 
                    height: 24, 
                    fontSize: '0.7rem', 
                    flex: '1 1 auto', 
                    minWidth: 'fit-content',
                    boxShadow: 'none',
                    transition: 'box-shadow 200ms var(--transition-bouncy)',
                    '&:hover': {
                      boxShadow: 'var(--shadow-hard)',
                    }
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Card>
      </Grid>
    </Fade>
  );
}

export default VideoCard;
