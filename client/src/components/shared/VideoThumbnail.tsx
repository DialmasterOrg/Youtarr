import React, { useEffect, useState } from 'react';
import { Box, Typography } from '../ui';
import { AlertCircle as ErrorOutlineIcon, Trash2 as DeletedIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { VideoData } from '../../types/VideoData';
import { DELETED_OVERLAY_BACKGROUND, getRemovalState } from '../../utils/videoRemoval';

const MISSING_OVERLAY_BG = 'color-mix(in srgb, var(--destructive) 30%, transparent)';
const REMOVED_IMAGE_FILTER = 'grayscale(100%) brightness(0.6)';
const OVERLAY_ICON_SHADOW = 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))';

interface VideoThumbnailProps {
  video: Pick<VideoData, 'youtubeId' | 'youTubeVideoName' | 'media_type' | 'removed' | 'removed_reason'>;
  // A fixed box in pixels. Left out, the thumbnail fills its parent's width
  // at 16:9, as the top of a card does.
  width?: number;
  height?: number;
  iconSize: number;
  onClick?: (event: React.MouseEvent) => void;
  // Drawn over the image: checkbox, badges, the click target.
  children?: React.ReactNode;
}

// The cached thumbnail of a video in the library, tinted when its file is gone.
function VideoThumbnail({ video, width, height, iconSize, onClick, children }: VideoThumbnailProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [video.youtubeId]);

  // Missing (file not found) keeps the red warning tint; deleted (removed by
  // Youtarr) gets a neutral one, since nothing is wrong.
  const removalState = getRemovalState(video.removed, video.removed_reason);
  const isRemoved = removalState !== 'present';
  const isMissing = removalState === 'missing';
  const fillsParent = width === undefined;
  const OverlayIcon = isMissing ? ErrorOutlineIcon : DeletedIcon;

  return (
    <Box
      data-testid="video-thumbnail"
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center shrink-0 overflow-hidden',
        onClick && 'cursor-pointer',
        fillsParent && 'w-full aspect-video'
      )}
      style={{
        width,
        height,
        borderRadius: fillsParent ? undefined : 'var(--radius-thumb)',
        backgroundColor: 'var(--media-placeholder-background)',
        border: 'var(--media-placeholder-border)',
      }}
    >
      {imageFailed ? (
        <Typography
          variant="caption"
          className="text-center px-1"
          style={{ filter: isRemoved ? REMOVED_IMAGE_FILTER : 'none' }}
        >
          No thumbnail
        </Typography>
      ) : (
        <img
          src={`/images/videothumb-${video.youtubeId}.jpg`}
          alt={video.youTubeVideoName}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: video.media_type === 'short' ? 'contain' : 'cover',
            filter: isRemoved ? REMOVED_IMAGE_FILTER : 'none',
          }}
        />
      )}
      {isRemoved && (
        <Box
          data-testid={isMissing ? 'video-thumbnail-missing-overlay' : 'video-thumbnail-deleted-overlay'}
          className="absolute inset-0 z-[1] flex items-center justify-center pointer-events-none"
          style={{ backgroundColor: isMissing ? MISSING_OVERLAY_BG : DELETED_OVERLAY_BACKGROUND }}
        >
          <OverlayIcon
            size={iconSize}
            className={isMissing ? 'text-destructive' : 'text-muted-foreground'}
            style={{ filter: OVERLAY_ICON_SHADOW }}
          />
        </Box>
      )}
      {children}
    </Box>
  );
}

export default VideoThumbnail;
