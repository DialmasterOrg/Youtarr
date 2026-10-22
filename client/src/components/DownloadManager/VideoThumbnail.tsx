import React from 'react';
import { Box, Typography } from '../ui';
import { AlertCircle as ErrorOutlineIcon, Trash2 as DeletedIcon } from 'lucide-react';
import { VideoData } from '../../types/VideoData';
import { DELETED_OVERLAY_BACKGROUND, getRemovalState } from '../../utils/videoRemoval';

const MISSING_OVERLAY_BG = 'color-mix(in srgb, var(--destructive) 30%, transparent)';

interface VideoThumbnailProps {
  video: VideoData;
  width: number;
  height: number;
  onClick: () => void;
  hasError: boolean;
  onError: () => void;
  iconSize: number;
}

function VideoThumbnail({
  video,
  width,
  height,
  onClick,
  hasError,
  onError,
  iconSize,
}: VideoThumbnailProps) {
  // Missing (file not found) keeps the red warning tint; deleted (removed by
  // Youtarr) gets a neutral one, since nothing is wrong.
  const removalState = getRemovalState(video.removed, video.removed_reason);
  const isRemoved = removalState !== 'present';
  const isMissing = removalState === 'missing';

  return (
    <Box
      data-testid="video-thumbnail"
      onClick={onClick}
      className="relative flex items-center justify-center shrink-0 overflow-hidden cursor-pointer"
      style={{
        width,
        height,
        borderRadius: 'var(--radius-thumb)',
        backgroundColor: 'var(--media-placeholder-background)',
        border: 'var(--media-placeholder-border)',
      }}
    >
      {hasError ? (
        <Typography
          variant="caption"
          className="text-center px-1"
          style={{
            filter: isRemoved ? 'grayscale(100%) brightness(0.6)' : 'none',
          }}
        >
          No thumbnail
        </Typography>
      ) : (
        <img
          src={`/images/videothumb-${video.youtubeId}.jpg`}
          alt={video.youTubeVideoName}
          loading="lazy"
          onError={onError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: video.media_type === 'short' ? 'contain' : 'cover',
            filter: isRemoved ? 'grayscale(100%) brightness(0.6)' : 'none',
          }}
        />
      )}
      {isRemoved && (
        <Box
          data-testid={isMissing ? 'video-thumbnail-missing-overlay' : 'video-thumbnail-deleted-overlay'}
          className="absolute inset-0 z-[1] flex items-center justify-center"
          style={{ backgroundColor: isMissing ? MISSING_OVERLAY_BG : DELETED_OVERLAY_BACKGROUND }}
        >
          {isMissing ? (
            <ErrorOutlineIcon
              size={iconSize}
              className="text-destructive"
              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }}
            />
          ) : (
            <DeletedIcon
              size={iconSize}
              className="text-muted-foreground"
              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

export default VideoThumbnail;
