import React, { useState, useCallback, useEffect } from 'react';
import { Box, Typography, IconButton, Tooltip, Link } from '../../../ui';
import {
  Play as PlayArrowIcon,
  CloudOff as CloudOffIcon,
  Download as DownloadIcon,
  Block as BlockIcon,
  Info as InfoOutlinedIcon,
  Close as CloseIcon,
  WarningAmber as WarningAmberIcon,
  Lock as LockIcon,
} from '../../../../lib/icons';
import { VideoModalData } from '../types';
import { YOUTUBE_URL_BASE } from '../constants';

interface VideoPlayerProps {
  video: VideoModalData;
  token: string | null;
  onDownloadClick: () => void;
  isMobile: boolean;
}

const DEFAULT_LANDSCAPE_ASPECT_RATIO = 16 / 9;
const DEFAULT_PORTRAIT_ASPECT_RATIO = 9 / 16;

function VideoPlayer({ video, token, onDownloadClick, isMobile }: VideoPlayerProps) {
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [infoTooltipOpen, setInfoTooltipOpen] = useState(false);
  const [streamAspectRatio, setStreamAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    setPlaybackStarted(false);
    setStreamError(false);
    setInfoTooltipOpen(false);
    setStreamAspectRatio(null);
  }, [video.youtubeId]);

  const canStream = video.isDownloaded && video.status !== 'missing';
  const streamUrl = token
    ? `/api/videos/${video.youtubeId}/stream?token=${encodeURIComponent(token)}`
    : null;

  const handlePlay = useCallback(() => {
    setPlaybackStarted(true);
  }, []);

  const handleStreamError = useCallback(() => {
    setStreamError(true);
    setPlaybackStarted(false);
  }, []);

  const handleStop = useCallback(() => {
    setPlaybackStarted(false);
  }, []);

  const handleVideoMetadata = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (videoWidth > 0 && videoHeight > 0) {
      setStreamAspectRatio(videoWidth / videoHeight);
    }
  }, []);

  const youtubeUrl = `${YOUTUBE_URL_BASE}${video.youtubeId}`;
  const isPlaying = canStream && playbackStarted && streamUrl && !streamError;
  const fallbackAspectRatio = video.mediaType === 'short'
    ? DEFAULT_PORTRAIT_ASPECT_RATIO
    : DEFAULT_LANDSCAPE_ASPECT_RATIO;
  const displayAspectRatio = isPlaying
    ? (streamAspectRatio ?? fallbackAspectRatio)
    : fallbackAspectRatio;
  const maxPlayerHeight = isMobile
    ? 'var(--video-modal-media-max-height-mobile, 52vh)'
    : 'var(--video-modal-media-max-height-desktop, 68vh)';

  return (
    <Box
      style={{
        position: 'relative',
        display: 'block',
        width: `min(100%, calc(${maxPlayerHeight} * ${displayAspectRatio}))`,
        maxWidth: '100%',
        ...(isPlaying ? {} : { aspectRatio: `${displayAspectRatio}` }),
        padding: 0,
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none',
        overflow: 'hidden',
        borderRadius: 'var(--video-modal-media-radius, var(--radius-ui))',
        margin: '0 auto',
        lineHeight: 0,
      }}
    >
      {/* Video element - absolutely positioned when playing */}
      {isPlaying && (
        <Box
          component="video"
          data-testid="video-stream-element"
          src={streamUrl}
          controls
          autoPlay
          onError={handleStreamError}
          onLoadedMetadata={handleVideoMetadata}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            maxHeight: maxPlayerHeight,
            objectFit: 'cover',
            borderRadius: 'inherit',
            verticalAlign: 'top',
          }}
        />
      )}

      {!isPlaying && (
        <Box
          component="img"
          src={video.thumbnailUrl}
          alt={video.title}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* Overlay content - shown when not playing */}
      {!isPlaying && (
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--video-modal-media-overlay-gradient, linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.42) 100%))',
            gap: 8,
            borderRadius: 'inherit',
          }}
        >
          {streamError ? (
            <>
              <CloudOffIcon size={48} color="white" />
              <Typography variant="body2" sx={{ color: 'common.white' }}>
                Unable to stream video
              </Typography>
              <Link
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                variant="body2"
                style={{ color: 'var(--video-modal-link-color, hsl(var(--primary)))' }}
              >
                Open in YouTube
              </Link>
            </>
          ) : canStream ? (
            <IconButton
              onClick={handlePlay}
              aria-label="Play video"
              style={{
                backgroundColor: 'var(--video-modal-overlay-action-background, var(--media-overlay-background-strong))',
                color: 'var(--video-modal-overlay-action-foreground, var(--media-overlay-foreground))',
                width: 'var(--video-modal-overlay-action-size, 72px)',
                height: 'var(--video-modal-overlay-action-size, 72px)',
                zIndex: 2,
              }}
            >
              <PlayArrowIcon size={Number.parseInt('48', 10)} style={{ width: 'var(--video-modal-overlay-action-icon-size, 48px)', height: 'var(--video-modal-overlay-action-icon-size, 48px)' }} />
            </IconButton>
          ) : video.status === 'ignored' ? (
            <>
              <BlockIcon size={48} color="white" />
              <Typography variant="body1" sx={{ color: 'common.white', fontWeight: 500 }}>
                Ignored
              </Typography>
            </>
          ) : video.status === 'missing' ? (
            <>
              <WarningAmberIcon size={48} color="var(--warning)" />
              <Typography variant="body1" sx={{ color: 'common.white', fontWeight: 500 }}>
                File Missing
              </Typography>
              <IconButton
                onClick={onDownloadClick}
                aria-label="Re-download video"
                style={{
                  backgroundColor: 'var(--video-modal-overlay-action-background, var(--media-overlay-background-strong))',
                  color: 'var(--video-modal-overlay-action-foreground, var(--media-overlay-foreground))',
                  width: 'var(--video-modal-overlay-download-size, 90px)',
                  height: 'var(--video-modal-overlay-download-size, 90px)',
                  zIndex: 2,
                }}
              >
                <DownloadIcon style={{ width: 'var(--video-modal-overlay-download-icon-size, 50px)', height: 'var(--video-modal-overlay-download-icon-size, 50px)' }} />
              </IconButton>
            </>
          ) : video.status === 'members_only' ? (
            <>
              <LockIcon size={48} color="white" />
              <Typography variant="body1" sx={{ color: 'common.white', fontWeight: 500 }}>
                Members Only
              </Typography>
              <Typography variant="body2" sx={{ color: 'common.white', opacity: 0.85, textAlign: 'center', paddingLeft: 16, paddingRight: 16 }}>
                Youtarr cannot download this video or fetch its metadata
              </Typography>
            </>
          ) : (
            <IconButton
              onClick={onDownloadClick}
              aria-label="Download video"
              style={{
                backgroundColor: 'var(--video-modal-overlay-action-background, var(--media-overlay-background-strong))',
                color: 'var(--video-modal-overlay-action-foreground, var(--media-overlay-foreground))',
                width: 'var(--video-modal-overlay-download-size, 90px)',
                height: 'var(--video-modal-overlay-download-size, 90px)',
                zIndex: 2,
              }}
            >
              <DownloadIcon style={{ width: 'var(--video-modal-overlay-download-icon-size, 50px)', height: 'var(--video-modal-overlay-download-icon-size, 50px)' }} />
            </IconButton>
          )}
        </Box>
      )}

      {/* Playback controls - shown during playback */}
      {isPlaying && (
        <Box
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            zIndex: 2,
          }}
        >
          {canStream && !streamError && (
            <Box style={{ position: 'relative' }}>
              <IconButton
                size="small"
                onClick={() => setInfoTooltipOpen((prev) => !prev)}
                aria-label="Playback info"
                style={{
                  color: 'var(--video-modal-overlay-corner-foreground, var(--media-overlay-foreground))',
                  backgroundColor: 'var(--video-modal-overlay-corner-background, var(--media-overlay-background))',
                }}
              >
                <InfoOutlinedIcon size={16} />
              </IconButton>
              {infoTooltipOpen && (
                <Box
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: isMobile ? 'min(240px, calc(100vw - 40px))' : '260px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-ui)',
                    backgroundColor: 'var(--video-modal-info-bubble-background, var(--popover))',
                    color: 'var(--video-modal-info-bubble-foreground, var(--popover-foreground))',
                    border: 'var(--video-modal-info-bubble-border, 1px solid var(--border))',
                    boxShadow: 'var(--video-modal-info-bubble-shadow, var(--shadow-soft))',
                    zIndex: 3,
                  }}
                >
                  <Typography variant="caption" style={{ display: 'block', lineHeight: 1.5 }}>
                    Video is served directly without transcoding. Playback may buffer on slow connections.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          <Tooltip title="Stop playback">
            <IconButton
              size="small"
              onClick={handleStop}
              aria-label="Stop playback"
              style={{
                color: 'var(--video-modal-overlay-corner-foreground, var(--media-overlay-foreground))',
                backgroundColor: 'var(--video-modal-overlay-corner-background, var(--media-overlay-background))',
              }}
            >
              <CloseIcon size={16} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

export default VideoPlayer;
