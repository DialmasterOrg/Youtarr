import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography, Chip, Checkbox, Stack } from '../../ui';
import { AlertCircle as ErrorOutlineIcon } from 'lucide-react';
import { formatDuration, formatYTDate } from '../../../utils';
import { formatAddedDate, formatFileSize } from '../../../utils/formatters';
import { getMediaTypeInfo } from '../../../utils/videoStatus';
import { getEnabledChannelId } from '../../../utils/enabledChannels';
import { VideoData, EnabledChannel } from '../../../types/VideoData';
import RatingBadge from '../../shared/RatingBadge';
import DownloadFormatIndicator from '../../shared/DownloadFormatIndicator';
import ProtectionShieldButton from '../../shared/ProtectionShieldButton';
import ThumbnailClickOverlay from '../../shared/ThumbnailClickOverlay';
import AvailabilityChip from '../../shared/AvailabilityChip';
import { SHARED_STATUS_CHIP_SMALL_STYLE } from '../../shared/chipStyles';

export interface VideosListMobileProps {
  videos: VideoData[];
  selectedVideos: number[];
  enabledChannels: EnabledChannel[];
  imageErrors: Record<string, boolean>;
  onToggleSelect: (videoId: number) => void;
  onOpenModal: (video: VideoData) => void;
  onToggleProtection: (videoId: number) => void;
  onImageError: (youtubeId: string) => void;
}

const COMPACT_CHIP_HEIGHT = 20;
const COMPACT_CHIP_FONT_SIZE = '0.65rem';

const compactStatusChipStyle: React.CSSProperties = {
  ...SHARED_STATUS_CHIP_SMALL_STYLE,
  height: COMPACT_CHIP_HEIGHT,
  fontSize: COMPACT_CHIP_FONT_SIZE,
};

const compactRatingChipStyle: React.CSSProperties = {
  height: COMPACT_CHIP_HEIGHT,
  fontSize: COMPACT_CHIP_FONT_SIZE,
};

function VideosListMobile({
  videos,
  selectedVideos,
  enabledChannels,
  imageErrors,
  onToggleSelect,
  onOpenModal,
  onToggleProtection,
  onImageError,
}: VideosListMobileProps) {
  return (
    <Box>
      {videos.map((video) => {
        const isSelectable = !video.removed;
        const isSelected = selectedVideos.includes(video.id);
        const channelId = getEnabledChannelId(
          video.youTubeChannelName,
          video.channel_id,
          enabledChannels
        );
        const mediaTypeInfo = getMediaTypeInfo(video.media_type);
        const fileSizeNumber = video.fileSize
          ? typeof video.fileSize === 'string'
            ? parseInt(video.fileSize, 10)
            : video.fileSize
          : null;

        return (
          <Box
            key={video.id}
            role={isSelectable ? 'button' : undefined}
            tabIndex={isSelectable ? 0 : undefined}
            onClick={() => {
              if (isSelectable) onToggleSelect(video.id);
            }}
            onKeyDown={(event) => {
              if (isSelectable && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                onToggleSelect(video.id);
              }
            }}
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 4px',
              borderBottom: '1px solid var(--border)',
              cursor: isSelectable ? 'pointer' : 'default',
              backgroundColor: isSelected ? 'var(--muted)' : undefined,
              transition: 'background-color 0.15s ease',
              alignItems: 'flex-start',
            }}
          >
            <Box
              style={{
                flexShrink: 0,
                width: 120,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
              onClick={(e) => e.stopPropagation()}
            >
            <Box
              style={{
                position: 'relative',
                width: 120,
                height: 68,
                overflow: 'hidden',
                backgroundColor: 'var(--media-placeholder-background)',
                borderRadius: 'var(--radius-thumb)',
              }}
            >
              {imageErrors[video.youtubeId] ? (
                <Typography
                  variant="caption"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                    fontSize: '0.65rem',
                  }}
                >
                  No thumb
                </Typography>
              ) : (
                <img
                  src={`/images/videothumb-${video.youtubeId}.jpg`}
                  alt="thumbnail"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: video.media_type === 'short' ? 'contain' : 'cover',
                    filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
                  }}
                  onError={() => onImageError(video.youtubeId)}
                />
              )}
              <ThumbnailClickOverlay
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onOpenModal(video);
                }}
              />
              {video.youtube_removed && (
                <Box
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--media-overlay-danger-background)',
                    color: 'var(--media-overlay-foreground)',
                    padding: '2px 4px',
                    fontSize: '0.55rem',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    zIndex: 2,
                  }}
                >
                  Removed
                </Box>
              )}
              {video.removed && (
                <Box
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(244, 67, 54, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                >
                  <ErrorOutlineIcon
                    className="text-destructive"
                    style={{ fontSize: '1.5rem' }}
                  />
                </Box>
              )}
              {video.duration ? (
                <Chip
                  label={formatDuration(video.duration)}
                  size="small"
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    backgroundColor: 'var(--media-overlay-background-strong)',
                    color: 'var(--media-overlay-foreground)',
                    fontSize: '0.65rem',
                    height: 16,
                    zIndex: 2,
                  }}
                />
              ) : null}
              {isSelectable && (
                <Checkbox
                  checked={isSelected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    onToggleSelect(video.id);
                  }}
                  inputProps={{ 'aria-label': `Select ${video.youTubeVideoName}` }}
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    padding: 2,
                    backgroundColor: 'var(--media-overlay-background)',
                    color: 'var(--media-overlay-foreground)',
                    zIndex: 3,
                  }}
                />
              )}
              {!video.removed && (
                <ProtectionShieldButton
                  isProtected={video.protected || false}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleProtection(video.id);
                  }}
                  style={{ position: 'absolute', bottom: 2, left: 2, zIndex: 3 }}
                />
              )}
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              style={{
                fontSize: '0.65rem',
                lineHeight: 1.25,
                textAlign: 'center',
              }}
            >
              Published: {formatYTDate(video.originalDate)}
            </Typography>
          </Box>

            <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography
                variant="subtitle2"
                className="font-semibold"
                style={{
                  cursor: 'pointer',
                  lineHeight: 1.25,
                  fontSize: '0.85rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenModal(video);
                }}
              >
                {video.youTubeVideoName}
              </Typography>
              {channelId ? (
                <Typography
                  component={RouterLink}
                  to={`/channel/${channelId}`}
                  variant="caption"
                  className="text-primary no-underline hover:underline block truncate"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  style={{ fontSize: '0.7rem' }}
                >
                  {video.youTubeChannelName}
                </Typography>
              ) : (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  className="block truncate"
                  style={{ fontSize: '0.7rem' }}
                >
                  {video.youTubeChannelName}
                </Typography>
              )}
              <Stack direction="row" spacing={0.5} className="flex-wrap gap-1">
                {!video.removed && (video.filePath || video.audioFilePath) && (
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
                    style={compactStatusChipStyle}
                  />
                )}
                <RatingBadge
                  rating={video.normalized_rating}
                  ratingSource={video.rating_source}
                  showNA
                  size="small"
                  style={compactRatingChipStyle}
                />
                {video.removed ? (
                  <AvailabilityChip isAvailable={false} compact />
                ) : video.fileSize ? (
                  <AvailabilityChip isAvailable={true} compact />
                ) : null}
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                style={{ fontSize: '0.65rem', lineHeight: 1.3 }}
              >
                Downloaded: {formatAddedDate(video.timeCreated)}
                {fileSizeNumber && !(video.filePath || video.audioFilePath)
                  ? ` • ${formatFileSize(fileSizeNumber)}`
                  : ''}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default VideosListMobile;
