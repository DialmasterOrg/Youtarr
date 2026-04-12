import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Link,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import DownloadIcon from '@mui/icons-material/Download';
import BlockIcon from '@mui/icons-material/Block';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StopIcon from '@mui/icons-material/Stop';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { VideoModalData } from '../types';
import { YOUTUBE_URL_BASE } from '../constants';

interface VideoPlayerProps {
  video: VideoModalData;
  token: string | null;
  onDownloadClick: () => void;
  isMobile: boolean;
}

// Fixed player heights as percentage of viewport.
// The dialog is ~85vh. These heights leave room for title + metadata below.
const PLAYER_HEIGHT_DESKTOP = '50vh';
const PLAYER_HEIGHT_MOBILE = '25vh';

function VideoPlayer({ video, token, onDownloadClick, isMobile }: VideoPlayerProps) {
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const [streamError, setStreamError] = useState(false);

  useEffect(() => {
    setPlaybackStarted(false);
    setStreamError(false);
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

  const youtubeUrl = `${YOUTUBE_URL_BASE}${video.youtubeId}`;
  const isPlaying = canStream && playbackStarted && streamUrl && !streamError;
  const playerHeight = isMobile ? PLAYER_HEIGHT_MOBILE : PLAYER_HEIGHT_DESKTOP;

  // Two different sizing strategies:
  // - Thumbnail: natural flow (width: 100%, height: auto) so it fills
  //   the width with no black bars, capped by maxHeight.
  // - Video playback: fixed height container with absolute positioning,
  //   because <video> elements don't respect maxHeight in flex layouts.
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        bgcolor: 'black',
        border: 1,
        borderColor: 'divider',
        ...(isPlaying && { height: playerHeight }),
        overflow: 'hidden',
        borderRadius: 1,
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
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      )}

      {/* Thumbnail - scales to the largest size that fits both width and height
          constraints while preserving aspect ratio. No cropping, no black bars. */}
      {!isPlaying && (
        <Box
          component="img"
          src={video.thumbnailUrl}
          alt={video.title}
          sx={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: playerHeight,
            width: 'auto',
            height: 'auto',
            mx: 'auto',
          }}
        />
      )}

      {/* Overlay content - shown when not playing */}
      {!isPlaying && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.5) 100%)',
            gap: 1,
          }}
        >
          {streamError ? (
            <>
              <CloudOffIcon sx={{ fontSize: 48, color: 'common.white' }} />
              <Typography variant="body2" sx={{ color: 'common.white' }}>
                Unable to stream video
              </Typography>
              <Link
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                variant="body2"
                sx={{ color: 'primary.light' }}
              >
                Open on YouTube
              </Link>
            </>
          ) : canStream ? (
            <IconButton
              onClick={handlePlay}
              aria-label="Play video"
              sx={{
                bgcolor: 'rgba(0,0,0,0.7)',
                color: 'common.white',
                '&:hover': {
                  bgcolor: 'rgba(0,0,0,0.85)',
                  transform: 'scale(1.1)',
                },
                transition: 'transform 0.2s ease, background-color 0.2s ease',
                width: 72,
                height: 72,
              }}
            >
              <PlayArrowIcon sx={{ fontSize: 48 }} />
            </IconButton>
          ) : video.status === 'ignored' ? (
            <>
              <BlockIcon sx={{ fontSize: 48, color: 'common.white' }} />
              <Typography variant="body1" sx={{ color: 'common.white', fontWeight: 500 }}>
                Ignored
              </Typography>
            </>
          ) : video.status === 'missing' ? (
            <>
              <WarningAmberIcon sx={{ fontSize: 48, color: 'warning.light' }} />
              <Typography variant="body1" sx={{ color: 'common.white', fontWeight: 500 }}>
                File Missing
              </Typography>
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={onDownloadClick}
                size="small"
                sx={{ textTransform: 'none', mt: 1 }}
              >
                Re-download Video
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={onDownloadClick}
              size="small"
              sx={{ textTransform: 'none' }}
            >
              Download Video
            </Button>
          )}
        </Box>
      )}

      {/* Stop button - shown during playback */}
      {isPlaying && (
        <Tooltip title="Stop playback">
          <IconButton
            size="small"
            onClick={handleStop}
            aria-label="Stop playback"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              color: 'common.white',
              bgcolor: 'rgba(0,0,0,0.5)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              zIndex: 2,
            }}
          >
            <StopIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {/* Playback info tooltip - shown when video can stream */}
      {canStream && !streamError && (
        <Tooltip title="Video is served directly without transcoding. Playback may buffer on slow connections.">
          <IconButton
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'common.white',
              bgcolor: 'rgba(0,0,0,0.5)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              zIndex: 2,
            }}
          >
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

export default VideoPlayer;
