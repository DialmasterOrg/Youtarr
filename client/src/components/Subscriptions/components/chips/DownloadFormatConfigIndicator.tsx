import React from 'react';
import { Tooltip } from '../../../../components/ui';
import { AudioIcon } from '../../../../lib/icons';

interface DownloadFormatConfigIndicatorProps {
  audioFormat: string | null | undefined;
}

const DownloadFormatConfigIndicator: React.FC<DownloadFormatConfigIndicatorProps> = ({
  audioFormat,
}) => {
  // Show audio icon only when MP3 downloads are enabled:
  // - null or undefined: video only (default, no extra indicator)
  // - 'video_mp3': both video and mp3 → show audio icon
  // - 'mp3_only': mp3 only → show audio icon
  const showAudio = audioFormat === 'video_mp3' || audioFormat === 'mp3_only';

  if (!showAudio) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
      }}
      data-testid="download-format-config-indicator"
    >
      <Tooltip title="MP3 downloads" arrow placement="top" enterTouchDelay={0}>
        <AudioIcon
          data-testid="audio-format-icon"
          size={16}
          style={{ color: 'var(--muted-foreground)' }}
        />
      </Tooltip>
    </div>
  );
};

export default DownloadFormatConfigIndicator;
