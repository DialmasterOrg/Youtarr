import React from 'react';
import { Box, Typography } from '../ui';
import { AlertCircle as ErrorOutlineIcon } from 'lucide-react';
import { VideoData } from '../../types/VideoData';

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
  const isMissing = Boolean(video.removed);

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
            filter: isMissing ? 'grayscale(100%) brightness(0.6)' : 'none',
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
            filter: isMissing ? 'grayscale(100%) brightness(0.6)' : 'none',
          }}
        />
      )}
      {isMissing && (
        <Box
          data-testid="video-thumbnail-missing-overlay"
          className="absolute inset-0 z-[1] flex items-center justify-center"
          style={{ backgroundColor: MISSING_OVERLAY_BG }}
        >
          <ErrorOutlineIcon
            size={iconSize}
            className="text-destructive"
            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }}
          />
        </Box>
      )}
    </Box>
  );
}

export default VideoThumbnail;
