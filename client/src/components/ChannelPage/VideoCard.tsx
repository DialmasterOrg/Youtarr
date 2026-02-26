import React from 'react';
import {
  Card,
  Typography,
  Checkbox,
  Chip,
  Grid,
  Fade,
  Tooltip,
} from '../ui';
import { CalendarToday as CalendarTodayIcon, Block as BlockIcon, CheckCircleOutline as CheckCircleOutlineIcon, Delete as DeleteIcon } from '../../lib/icons';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo } from '../../utils/videoStatus';
import StillLiveDot from './StillLiveDot';
import RatingBadge from '../shared/RatingBadge';
import DownloadFormatIndicator from '../shared/DownloadFormatIndicator';

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
  const isDeleteAllowed = selectionMode === 'delete';
  const isChecked = checkedBoxes.includes(video.youtube_id);
  const isDeleteChecked = selectedForDeletion.includes(video.youtube_id);
  const mediaTypeInfo = getMediaTypeInfo(video.media_type);
  const isIgnored = status === 'ignored';
  const statusVariant = status === 'downloaded' || status === 'missing' ? 'filled' : 'outlined';
  const baseTransform = isInteractive ? 'var(--sticker-rest-transform)' : 'translate(0, 0)';
  const isClickable = (isDownloadSelectable && isDownloadAllowed) || (isDeleteSelectable && isDeleteAllowed);

  return (
    <Fade in timeout={300} key={video.youtube_id}>
      <Grid item xs={12} sm={6} md={4} lg={3}>
        <Card
          data-testid="video-card"
          className={isInteractive ? 'wiggle-card' : undefined}
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: isClickable ? 'pointer' : 'default',
            opacity: status === 'members_only' || isIgnored ? 0.7 : 1,
            transform: hoveredVideo === video.youtube_id ? 'var(--sticker-hover-transform)' : baseTransform,
            boxShadow: hoveredVideo === video.youtube_id ? 'var(--card-hover-shadow)' : 'var(--shadow-soft)',
            overflow: 'hidden',
            borderRadius: 'var(--radius-ui)',
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
          <div style={{
            position: 'relative',
            paddingTop: isMobile ? '52%' : '56.25%',
            backgroundColor: '#111',
            borderRadius: 'var(--radius-ui)',
            overflow: 'hidden',
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
                borderRadius: 'var(--radius-ui)',
              }}
              loading="lazy"
            />

            {/* YouTube Removed Banner */}
            {video.youtube_removed ? (
              <div
                style={{
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
              </div>
            ) : null}

            {/* Duration overlay - hide for shorts since duration isn't available from flat-playlist */}
            {video.media_type !== 'short' && (
              <Chip
                label={formatDuration(video.duration)}
                size="small"
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  color: 'white',
                  fontSize: '0.75rem',
                  height: 22,
                }}
              />
            )}

            {/* Still Live indicator or Selection overlay for download */}
            {isStillLive ? (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  zIndex: 2,
                }}
              >
                <StillLiveDot isMobile={isMobile} onMobileClick={onMobileTooltip} />
              </div>
            ) : isDownloadSelectable && isDownloadAllowed && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: isChecked ? 'rgba(25, 118, 210, 0.3)' : 'transparent',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  padding: 8,
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
                  style={{
                    color: 'white',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                  }}
                />
              </div>
            )}

            {/* Delete checkbox for downloaded videos (only in explicit delete mode) */}
            {isDeleteSelectable && isDeleteAllowed && (
              <Checkbox
                checked={isDeleteChecked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  onDeletionChange(video.youtube_id, e.target.checked);
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  color: 'white',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                }}
              />
            )}

            {/* Visual delete indicator when video is queued for deletion (outside delete mode) */}
            {isDeleteSelectable && !isDeleteAllowed && isDeleteChecked && (
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  color: 'white',
                  backgroundColor: 'rgba(220,38,38,0.8)',
                  padding: 4,
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <DeleteIcon size={16} data-testid="DeleteIcon" />
              </div>
            )}

            {/* Ignore/Unignore button - for videos not currently on disk (never downloaded or missing) */}
            {!isStillLive && (!video.added || video.removed) && (
              <Tooltip
                title={isIgnored ? "Click to unignore (allow auto-downloads)" : "Click to ignore (prevent auto-downloads)"}
                arrow
                placement="top"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleIgnore(video.youtube_id);
                  }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: isIgnored ? 'var(--warning)' : 'rgba(0,0,0,0.6)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                    zIndex: 3,
                  }}
                >
                  {isIgnored ? <CheckCircleOutlineIcon size={16} data-testid="CheckCircleOutlineIcon" /> : <BlockIcon size={16} data-testid="BlockIcon" />}
                </button>
              </Tooltip>
            )}
          </div>

          {/* Card content */}
          <div style={{ padding: isMobile ? 12 : 16, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="body2"
              style={{
                marginBottom: 8,
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

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Date and download format info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {video.media_type !== 'short' && video.publishedAt && (
                <Typography variant="caption" color="text.secondary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarTodayIcon size={12} />
                  {isMobile
                    ? new Date(video.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : new Date(video.publishedAt).toLocaleDateString()
                  }
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
              </div>

              {/* Media type, rating, and status chips on same line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                {mediaTypeInfo && (
                  <Chip
                    size="small"
                    icon={mediaTypeInfo.icon}
                    label={mediaTypeInfo.label}
                    color={mediaTypeInfo.color}
                    variant="outlined"
                    style={{
                      height: 24,
                      fontSize: '0.7rem',
                      minWidth: 'fit-content',
                      boxShadow: 'var(--chip-shadow)',
                      transition: 'box-shadow 200ms var(--transition-bouncy)',
                    }}
                  />
                )}
                <RatingBadge
                  rating={video.normalized_rating}
                  ratingSource={video.rating_source}
                  showNA={true}
                  size="small"
                  style={{ height: 24, flexShrink: 0 }}
                />
                <Chip
                  icon={getStatusIcon(status)}
                  label={getStatusLabel(status)}
                  size="small"
                  color={getStatusColor(status)}
                  variant={statusVariant}
                  style={{
                    height: 24,
                    fontSize: '0.7rem',
                    flex: '0 0 auto',
                    minWidth: 'fit-content',
                    boxShadow: 'var(--chip-shadow)',
                    transition: 'box-shadow 200ms var(--transition-bouncy)',
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      </Grid>
    </Fade>
  );
}

export default VideoCard;
