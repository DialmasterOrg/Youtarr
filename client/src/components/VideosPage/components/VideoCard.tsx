import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Card, Typography, Chip, Box, Checkbox, IconButton, Tooltip } from '../../ui';
import {
  AlertCircle as ErrorOutlineIcon,
  CheckCircle as CheckCircleIcon,
  HardDrive as StorageIcon,
  Trash2 as DeleteIcon,
  Download as DownloadIcon,
  Clock as ScheduleIcon,
  AlarmCheck as AlarmOnIcon,
  Video as VideoLibraryIcon,
} from 'lucide-react';
import { formatDuration, formatYTDate } from '../../../utils';
import { formatFileSize } from '../../../utils/formatters';
import { VideoData, EnabledChannel } from '../../../types/VideoData';
import RatingBadge from '../../shared/RatingBadge';
import DownloadFormatIndicator from '../../shared/DownloadFormatIndicator';
import ProtectionShieldButton from '../../shared/ProtectionShieldButton';
import ThumbnailClickOverlay from '../../shared/ThumbnailClickOverlay';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_THEMED_CHIP_SMALL_STYLE } from '../../shared/chipStyles';

export interface VideoCardProps {
  video: VideoData;
  selected: boolean;
  enabledChannels: EnabledChannel[];
  imageErrored: boolean;
  deleteDisabled: boolean;
  onToggleSelect: (videoId: number) => void;
  onOpenModal: (video: VideoData) => void;
  onToggleProtection: (videoId: number) => void;
  onDeleteSingle: (videoId: number) => void;
  onImageError: (youtubeId: string) => void;
}

const chipStyle = {
  available: {
    ...SHARED_THEMED_CHIP_SMALL_STYLE,
    backgroundColor: 'var(--success)',
    color: 'var(--success-foreground)',
  } as React.CSSProperties,
  missing: {
    ...SHARED_THEMED_CHIP_SMALL_STYLE,
    backgroundColor: 'var(--destructive)',
    color: 'var(--destructive-foreground)',
  } as React.CSSProperties,
};

function getMediaTypeInfo(mediaType?: string) {
  switch (mediaType) {
    case 'short':
      return { label: 'Short', color: 'secondary' as const, icon: <ScheduleIcon /> };
    case 'livestream':
      return { label: 'Live', color: 'error' as const, icon: <VideoLibraryIcon /> };
    case 'video':
    default:
      return null;
  }
}

function getEnabledChannelId(
  channelName: string,
  videoChannelId: string | null | undefined,
  enabledChannels: EnabledChannel[]
): string | null {
  if (videoChannelId) {
    const match = enabledChannels.find((ch) => ch.channel_id === videoChannelId);
    if (match) return match.channel_id;
  }
  const match = enabledChannels.find((ch) => ch.uploader === channelName);
  return match ? match.channel_id : null;
}

function formatAddedDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    const day = date.toLocaleDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${day} ${time}`;
  } catch {
    return '';
  }
}

function VideoCard({
  video,
  selected,
  enabledChannels,
  imageErrored,
  deleteDisabled,
  onToggleSelect,
  onOpenModal,
  onToggleProtection,
  onDeleteSingle,
  onImageError,
}: VideoCardProps) {
  const isSelectable = !video.removed;
  const channelId = getEnabledChannelId(video.youTubeChannelName, video.channel_id, enabledChannels);
  const mediaTypeInfo = getMediaTypeInfo(video.media_type);
  const fileSizeNumber = video.fileSize
    ? typeof video.fileSize === 'string'
      ? parseInt(video.fileSize, 10)
      : video.fileSize
    : null;

  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
        borderRadius: 'var(--radius-ui)',
        outline: selected ? '2px solid var(--primary)' : '2px solid transparent',
        transition: 'outline-color 0.15s ease',
      }}
    >
      <Box
        style={{
          position: 'relative',
          width: '100%',
          height: 0,
          paddingTop: '56.25%',
          overflow: 'hidden',
          backgroundColor: 'var(--media-placeholder-background)',
          border: 'var(--media-placeholder-border)',
          cursor: 'pointer',
        }}
        onClick={() => onOpenModal(video)}
      >
        {imageErrored ? (
          <Box
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: video.removed ? 'grayscale(100%) brightness(0.6)' : 'none',
            }}
          >
            <Typography variant="caption">No thumbnail available</Typography>
          </Box>
        ) : (
          <img
            src={`/images/videothumb-${video.youtubeId}.jpg`}
            alt="thumbnail"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
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
              padding: '4px 8px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              textAlign: 'center',
              zIndex: 2,
            }}
          >
            Removed From YouTube
          </Box>
        )}

        {video.removed && (
          <Box
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(244, 67, 54, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <ErrorOutlineIcon
              className="text-destructive"
              style={{
                fontSize: '3rem',
                filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))',
              }}
            />
          </Box>
        )}

        {isSelectable && (
          <Checkbox
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation();
              onToggleSelect(video.id);
            }}
            inputProps={{ 'aria-label': `Select ${video.youTubeVideoName}` }}
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
        )}

        {!video.removed && (
          <ProtectionShieldButton
            isProtected={video.protected || false}
            onClick={(e) => {
              e.stopPropagation();
              onToggleProtection(video.id);
            }}
            style={{ position: 'absolute', bottom: 6, left: 6, zIndex: 3 }}
          />
        )}
      </Box>

      <Box className="flex flex-col gap-2" style={{ padding: 12, flex: 1 }}>
        <Box>
          <Typography
            variant="subtitle2"
            className="font-semibold"
            style={{
              lineHeight: 1.3,
              cursor: 'pointer',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word',
              minHeight: '2.6em',
            }}
            onClick={() => onOpenModal(video)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenModal(video);
              }
            }}
            role="button"
            tabIndex={0}
            title={video.youTubeVideoName}
          >
            {video.youTubeVideoName}
          </Typography>
          {channelId ? (
            <Typography
              component={RouterLink}
              to={`/channel/${channelId}`}
              variant="caption"
              className="text-primary no-underline hover:underline block"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {video.youTubeChannelName}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary" className="block">
              {video.youTubeChannelName}
            </Typography>
          )}
        </Box>

        <Box className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          {video.duration ? (
            <Box className="flex items-center gap-1">
              <AlarmOnIcon size={14} className="text-muted-foreground" />
              <Typography variant="caption" className="text-muted-foreground">
                {formatDuration(video.duration)}
              </Typography>
            </Box>
          ) : null}
          <Box className="flex items-center gap-1">
            <ScheduleIcon size={14} className="text-muted-foreground" />
            <Typography variant="caption" className="text-muted-foreground">
              Published: {formatYTDate(video.originalDate)}
            </Typography>
          </Box>
          {fileSizeNumber && !(video.filePath || video.audioFilePath) ? (
            <Box className="flex items-center gap-1">
              <StorageIcon size={14} className="text-muted-foreground" />
              <Typography variant="caption" className="text-muted-foreground">
                {formatFileSize(fileSizeNumber)}
              </Typography>
            </Box>
          ) : null}
          <Box className="col-span-2 flex items-center gap-1">
            <DownloadIcon size={14} className="text-muted-foreground" />
            <Typography
              variant="caption"
              className="text-muted-foreground"
              style={{ whiteSpace: 'nowrap' }}
            >
              Downloaded: {formatAddedDateTime(video.timeCreated)}
            </Typography>
          </Box>
        </Box>

        <Box
          className="flex flex-wrap items-center gap-1"
          style={{ marginTop: 'auto' }}
        >
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
              style={SHARED_STATUS_CHIP_SMALL_STYLE}
            />
          )}
          <RatingBadge
            rating={video.normalized_rating}
            ratingSource={video.rating_source}
            showNA
            size="small"
          />
          {video.removed ? (
            <Tooltip title="Video file not found on disk" enterTouchDelay={0}>
              <Chip
                size="small"
                icon={<ErrorOutlineIcon size={12} />}
                label="Missing"
                color="error"
                variant="filled"
                style={chipStyle.missing}
              />
            </Tooltip>
          ) : video.fileSize ? (
            <Tooltip title="Video file exists on disk" enterTouchDelay={0}>
              <Chip
                size="small"
                icon={<CheckCircleIcon size={12} />}
                label="Available"
                color="success"
                variant="filled"
                style={chipStyle.available}
              />
            </Tooltip>
          ) : null}
          {!video.removed && (
            <Tooltip title="Delete video from disk">
              <span style={{ marginLeft: 'auto' }}>
                <IconButton
                  color="error"
                  size="small"
                  data-testid="DeleteIcon"
                  aria-label="Delete video from disk"
                  onClick={() => onDeleteSingle(video.id)}
                  disabled={deleteDisabled}
                >
                  <DeleteIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Card>
  );
}

export default VideoCard;
