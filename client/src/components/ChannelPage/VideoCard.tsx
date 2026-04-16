import React from 'react';
import {
  Card,
  Typography,
  Chip,
  Grid,
  Fade,
  Tooltip,
  Checkbox,
} from '../ui';
import { CalendarToday as CalendarTodayIcon, Block as BlockIcon, CheckCircleOutline as CheckCircleOutlineIcon, Delete as DeleteIcon } from '../../lib/icons';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo, getStatusChipVariant, getStatusChipStyle } from '../../utils/videoStatus';
import StillLiveDot from './StillLiveDot';
import RatingBadge from '../shared/RatingBadge';
import DownloadFormatIndicator from '../shared/DownloadFormatIndicator';
import ProtectionShieldButton from '../shared/ProtectionShieldButton';
import ThumbnailClickOverlay from '../shared/ThumbnailClickOverlay';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_THEMED_CHIP_SMALL_STYLE } from '../shared/chipStyles';

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
  onToggleProtection: (youtubeId: string) => void;
  onMobileTooltip?: (message: string) => void;
  isInteractive?: boolean;
  onVideoClick?: (video: ChannelVideo) => void;
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
  onToggleProtection,
  onMobileTooltip,
  isInteractive = false,
  onVideoClick,
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
  const statusLabel = status === 'downloaded' ? 'Available' : getStatusLabel(status);
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
            cursor: isClickable ? 'pointer' : 'default',
            opacity: status === 'members_only' || isIgnored ? 0.7 : 1,
            transform: hoveredVideo === video.youtube_id ? 'var(--sticker-hover-transform)' : baseTransform,
            boxShadow: hoveredVideo === video.youtube_id ? 'var(--card-hover-shadow)' : 'var(--shadow-soft)',
            overflow: 'hidden',
            borderRadius: 'var(--radius-ui)',
            outline: isDeleteChecked ? '2px solid var(--destructive)' : isChecked ? '2px solid var(--primary)' : '2px solid transparent',
            outlineOffset: '0px',
            transition: 'transform 0.2s, box-shadow 0.2s, outline-color 0.2s',
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
            backgroundColor: 'var(--media-placeholder-background)',
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
            {onVideoClick && (
              <ThumbnailClickOverlay
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onVideoClick(video);
                }}
              />
            )}
            {/* YouTube Removed Banner */}
            {video.youtube_removed ? (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'var(--media-overlay-danger-background)',
                  color: 'var(--media-overlay-foreground)',
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
                  backgroundColor: 'var(--media-overlay-background-strong)',
                  color: 'var(--media-overlay-foreground)',
                  fontSize: '0.75rem',
                  height: 22,
                }}
              />
            )}

            {/* Selection checkbox - rendered for all selectable videos */}
            {(isDownloadSelectable && isDownloadAllowed) ? (
              <Checkbox
                checked={isChecked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onCheckChange(video.youtube_id, e.target.checked)}
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  backgroundColor: 'var(--media-overlay-background)',
                  color: 'var(--media-overlay-foreground)',
                  transition: 'all 0.2s',
                  zIndex: 3,
                }}
              />
            ) : (isDeleteSelectable && isDeleteAllowed) ? (
              <Checkbox
                checked={isDeleteChecked}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onDeletionChange(video.youtube_id, e.target.checked)}
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  backgroundColor: 'var(--media-overlay-background)',
                  color: 'var(--media-overlay-foreground)',
                  transition: 'all 0.2s',
                  zIndex: 3,
                }}
              />
            ) : null}

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
            ) : isDownloadSelectable && isDownloadAllowed && isChecked && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'var(--media-overlay-selection-background)',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Delete highlight overlay for selected videos (delete mode) */}
            {isDeleteSelectable && isDeleteAllowed && isDeleteChecked && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'var(--media-overlay-delete-selection-background)',
                  pointerEvents: 'none',
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
                  color: 'var(--media-overlay-foreground)',
                  backgroundColor: 'var(--media-overlay-delete-indicator-background)',
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
                    background: isIgnored ? 'var(--warning)' : 'var(--media-overlay-ignore-button-background)',
                    color: 'var(--media-overlay-foreground)',
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

            {/* Protection shield for downloaded videos */}
            {video.added && !video.removed && (
              <ProtectionShieldButton
                isProtected={video.protected || false}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleProtection(video.youtube_id);
                }}
                style={{ position: 'absolute', bottom: 6, left: 6, zIndex: 2 }}
              />
            )}
          </div>

          {/* Card content */}
          <div style={{ padding: isMobile ? 12 : 16, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="body2"
              onClick={onVideoClick ? (e: React.MouseEvent) => {
                e.stopPropagation();
                onVideoClick(video);
              } : undefined}
              sx={{
                mb: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
                minHeight: '2.6em',
                cursor: onVideoClick ? 'pointer' : 'default',

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
                      minWidth: 'fit-content',
                      ...SHARED_STATUS_CHIP_SMALL_STYLE,
                    }}
                  />
                )}
                <RatingBadge
                  rating={video.normalized_rating}
                  ratingSource={video.rating_source}
                  showNA={true}
                  size="small"
                  style={{ ...SHARED_STATUS_CHIP_SMALL_STYLE, flexShrink: 0 }}
                />
                <Chip
                  icon={getStatusIcon(status)}
                  label={statusLabel}
                  size="small"
                  color={getStatusColor(status)}
                  variant={getStatusChipVariant(status)}
                  style={{
                    flex: '0 0 auto',
                    minWidth: 'fit-content',
                    ...SHARED_THEMED_CHIP_SMALL_STYLE,
                    ...getStatusChipStyle(status),
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
