import React from 'react';
import { Tooltip } from '../../../../components/ui';
import { VideoIcon, AudioIcon } from '../../../../lib/icons';

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
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
      }}
      data-testid="download-format-config-indicator"
    >
      {showVideo && (
        <Tooltip title="Video downloads" arrow placement="top" enterTouchDelay={0}>
          <VideoIcon
            data-testid="video-format-icon"
            size={16}
            style={{ color: 'var(--primary)' }}
          />
        </Tooltip>
      )}
      {showAudio && (
        <Tooltip title="MP3 downloads" arrow placement="top" enterTouchDelay={0}>
          <AudioIcon
            data-testid="audio-format-icon"
            size={16}
            style={{ color: 'var(--muted-foreground)' }}
          />
        </Tooltip>
      )}
    </div>
  );
};

export default DownloadFormatConfigIndicator;
