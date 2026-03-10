import React from 'react';
import {
  Card,
  Typography,
  Chip,
  CardContent,
  Fade,
  Tooltip,
} from '../ui';
import { CalendarToday as CalendarTodayIcon, Block as BlockIcon, CheckCircleOutline as CheckCircleOutlineIcon, Delete as DeleteIcon } from '../../lib/icons';
import { formatDuration } from '../../utils';
import { ChannelVideo } from '../../types/ChannelVideo';
import { decodeHtml } from '../../utils/formatters';
import { getVideoStatus, getStatusColor, getStatusIcon, getStatusLabel, getMediaTypeInfo, getStatusChipVariant, getStatusChipStyle } from '../../utils/videoStatus';
import StillLiveDot from './StillLiveDot';
import DownloadFormatIndicator from '../shared/DownloadFormatIndicator';

import RatingBadge from '../shared/RatingBadge';
import { SHARED_STATUS_CHIP_SMALL_STYLE } from '../shared/chipStyles';
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
  const isClickable = (isDownloadSelectable && isDownloadAllowed) || (isDeleteSelectable && isDeleteAllowed);

  return (
    <Fade in timeout={300} key={video.youtube_id}>
      <Card
        style={{
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          transition: 'all 0.2s ease',
          cursor: isClickable ? 'pointer' : 'default',
          opacity: status === 'members_only' || isIgnored ? 0.7 : 1,
          outline: isDeleteChecked ? '2px solid var(--destructive)' : isChecked ? '2px solid var(--primary)' : '2px solid transparent',
          outlineOffset: '0px',
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
        <div
          style={{
            position: 'relative',
            width: 120,
            minWidth: 120,
            height: 90,
            alignSelf: 'center',
            backgroundColor: '#111',
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
            <div
              style={{
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
            </div>
          ) : null}

          {/* Duration overlay - hide for shorts since duration isn't available from flat-playlist */}
          {video.media_type !== 'short' && (
            <Chip
              label={formatDuration(video.duration)}
              size="small"
              style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                backgroundColor: 'rgba(0,0,0,0.8)',
                color: 'white',
                fontSize: '0.7rem',
                height: 18,
              }}
            />
          )}

          {/* Still Live indicator */}
          {isStillLive && (
            <div
              style={{
                position: 'absolute',
                top: 4,
                left: 4,
                zIndex: 2,
              }}
            >
              <StillLiveDot isMobile onMobileClick={onMobileTooltip} />
            </div>
          )}

          {/* Download selection overlay */}
          {isDownloadSelectable && isDownloadAllowed && isChecked && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(25, 118, 210, 0.2)',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Delete highlight overlay */}
          {isDeleteSelectable && isDeleteAllowed && isDeleteChecked && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(220, 38, 38, 0.2)',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Visual delete indicator when video is queued for deletion (outside delete mode) */}
          {isDeleteSelectable && !isDeleteAllowed && isDeleteChecked && (
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                color: 'white',
                backgroundColor: 'rgba(220,38,38,0.8)',
                padding: 4,
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <DeleteIcon size={18} data-testid="DeleteIcon" />
            </div>
          )}

          {/* Ignore/Unignore button - for videos not currently on disk (never downloaded or missing) */}
          {!isStillLive && (!video.added || video.removed) && (
            <Tooltip
              title={isIgnored ? "Click to unignore" : "Click to ignore"}
              arrow
              placement="top"
            >
              <button
                aria-label={isIgnored ? "Click to unignore" : "Click to ignore"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleIgnore(video.youtube_id);
                }}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  background: isIgnored ? 'var(--warning)' : 'rgba(0,0,0,0.6)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  transition: 'all 0.2s',
                }}
              >
                {isIgnored ? <CheckCircleOutlineIcon size={18} data-testid="CheckCircleOutlineIcon" /> : <BlockIcon size={18} data-testid="BlockIcon" />}
              </button>
            </Tooltip>
          )}
        </div>

        {/* Content */}
        <CardContent style={{ flex: 1, paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }}>
          {/* Title */}
          <Typography
            variant="body2"
            style={{
              marginBottom: 4,
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
            {video.media_type !== 'short' && video.publishedAt && (
            <Typography variant="caption" color="text.secondary" style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.7rem' }}>
                <CalendarTodayIcon size={11} />
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
                style={{
                  ...SHARED_STATUS_CHIP_SMALL_STYLE,
                }}
              />
            )}
            <RatingBadge
              rating={video.normalized_rating}
              ratingSource={video.rating_source}
              size="small"
              variant="pill"
              showNA
              style={{ ...SHARED_STATUS_CHIP_SMALL_STYLE }}
            />
            <Chip
              icon={getStatusIcon(status)}
              label={statusLabel}
              size="small"
              color={getStatusColor(status)}
              variant={getStatusChipVariant(status)}
              style={{
                flex: '0 0 auto',
                ...SHARED_STATUS_CHIP_SMALL_STYLE,
                ...getStatusChipStyle(status),
              }}
            />
          </div>
        </CardContent>
      </Card>
    </Fade>
  );
}

export default VideoListItem;
