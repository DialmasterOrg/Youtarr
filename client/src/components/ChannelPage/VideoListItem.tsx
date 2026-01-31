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
  Tooltip,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useTheme } from '@mui/material/styles';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo } from '../../utils/videoStatus';
import StillLiveDot from './StillLiveDot';
import DownloadFormatIndicator from '../shared/DownloadFormatIndicator';

import RatingBadge from '../shared/RatingBadge';
interface VideoListItemProps {
  video: ChannelVideo;
  checkedBoxes: string[];
  selectedForDeletion: string[];
  selectionMode: 'download' | 'delete' | null;
  onCheckChange: (videoId: string, isChecked: boolean) => void;
  onDeletionChange: (videoId: string, isChecked: boolean) => void;
  onToggleIgnore: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
}

function VideoListItem({
  video,
  checkedBoxes,
  selectedForDeletion,
  selectionMode,
  onCheckChange,
  onDeletionChange,
  onToggleIgnore,
  onMobileTooltip,
}: VideoListItemProps) {
  const theme = useTheme();
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
  const isClickable = (isDownloadSelectable && isDownloadAllowed) || (isDeleteSelectable && isDeleteAllowed);

  return (
    <Fade in timeout={300} key={video.youtube_id}>
      <Card
        sx={{
          mb: 1.5,
          display: 'flex',
          position: 'relative',
          transition: 'all 0.2s ease',
          cursor: isClickable ? 'pointer' : 'default',
          opacity: status === 'members_only' || isIgnored ? 0.7 : 1,
          '&:hover': {
            boxShadow: theme.shadows[3],
          },
        }}
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
        {/* Thumbnail */}
        <Box
          sx={{
            position: 'relative',
            // Keep container size consistent for all videos
            width: 120,
            minWidth: 120,
            height: 90,
            bgcolor: 'grey.900',
            borderRadius: 'var(--radius-thumb)',
            overflow: 'hidden',
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
              borderRadius: 'var(--radius-thumb)',
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
          ) : isDownloadSelectable && isDownloadAllowed && (
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
                top: 2,
                left: 2,
                color: 'white',
                bgcolor: 'rgba(0,0,0,0.5)',
                padding: 0.5,
                '&.Mui-checked': {
                  color: 'error.main',
                  bgcolor: 'rgba(0,0,0,0.7)',
                },
                '& .MuiSvgIcon-root': { fontSize: 20 },
              }}
            />
          )}

          {/* Ignore/Unignore button - for videos not currently on disk (never downloaded or missing) */}
          {!isStillLive && (!video.added || video.removed) && (
            <Tooltip
              title={isIgnored ? "Click to unignore" : "Click to ignore"}
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
                  top: 2,
                  right: 2,
                  bgcolor: isIgnored ? 'warning.main' : 'rgba(0,0,0,0.6)',
                  color: 'white',
                  padding: 0.5,
                  '&:hover': {
                    bgcolor: isIgnored ? 'warning.dark' : 'rgba(0,0,0,0.8)',
                  },
                  transition: 'all 0.2s',
                }}
                size="small"
              >
                {isIgnored ? <CheckCircleOutlineIcon sx={{ fontSize: 18 }} /> : <BlockIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
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
            {video.added && !video.removed && (
              <DownloadFormatIndicator
                filePath={video.filePath}
                audioFilePath={video.audioFilePath}
                fileSize={video.fileSize}
                audioFileSize={video.audioFileSize}
              />
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
                  boxShadow: 'var(--chip-shadow)',
                  transition: 'box-shadow 200ms var(--transition-bouncy)',
                  '&:hover': {
                    boxShadow: 'var(--chip-shadow-hover)',
                  }
                }}
              />
            )}
            <Chip
              icon={getStatusIcon(status)}
              label={getStatusLabel(status)}
              size="small"
              color={getStatusColor(status)}
              variant={status === 'downloaded' ? 'filled' : 'outlined'}
              sx={(theme) => ({
                height: 20,
                fontSize: '0.7rem',
                '& .MuiChip-icon': { fontSize: 14, ml: 0.5 },
                '& .MuiChip-label': {
                  px: 0.75,
                  display: 'inline-block',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
                flex: '0 0 auto',
                boxShadow: 'var(--chip-shadow)',
                transition: 'box-shadow 200ms var(--transition-bouncy)',
                '&:hover': {
                  boxShadow: 'var(--chip-shadow-hover)',
                }
              })}
            />
          </Box>
        </CardContent>
      </Card>
    </Fade>
  );
}

export default VideoListItem;
