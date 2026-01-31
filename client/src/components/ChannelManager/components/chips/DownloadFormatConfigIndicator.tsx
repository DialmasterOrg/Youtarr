import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { MovieOutlined as VideoIcon, AudiotrackOutlined as AudioIcon } from '@mui/icons-material';

interface DownloadFormatConfigIndicatorProps {
  audioFormat: string | null | undefined;
}

const DownloadFormatConfigIndicator: React.FC<DownloadFormatConfigIndicatorProps> = ({
  audioFormat,
}) => {
  // Determine which icons to show based on audio_format setting:
  // - null or undefined: video only (default)
  // - 'video_mp3': both video and mp3
  // - 'mp3_only': mp3 only
  const showVideo = !audioFormat || audioFormat === 'video_mp3';
  const showAudio = audioFormat === 'video_mp3' || audioFormat === 'mp3_only';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
      }}
      data-testid="download-format-config-indicator"
    >
      {showVideo && (
        <Tooltip title="Video downloads" arrow placement="top" enterTouchDelay={0}>
          <VideoIcon
            data-testid="video-format-icon"
            sx={{
              fontSize: '1rem',
              color: 'primary.main',
            }}
          />
        </Tooltip>
      )}
      {showAudio && (
        <Tooltip title="MP3 downloads" arrow placement="top" enterTouchDelay={0}>
          <AudioIcon
            data-testid="audio-format-icon"
            sx={{
              fontSize: '1rem',
              color: 'secondary.main',
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default DownloadFormatConfigIndicator;
