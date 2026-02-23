import React from 'react';
import { Box, Chip, Tooltip } from '../ui';
import { MovieOutlined as VideoIcon, AudiotrackOutlined as AudioIcon } from '../../lib/icons';
import { formatFileSize } from '../../utils/formatters';

interface DownloadFormatIndicatorProps {
  filePath?: string | null;
  audioFilePath?: string | null;
  fileSize?: number | string | null;
  audioFileSize?: number | string | null;
}

// Strip internal Docker paths from display
const stripInternalPath = (path: string): string => {
  const internalPrefixes = ['/usr/src/app/data/'];
  for (const prefix of internalPrefixes) {
    if (path.startsWith(prefix)) {
      return path.slice(prefix.length);
    }
  }
  return path;
};

const DownloadFormatIndicator: React.FC<DownloadFormatIndicatorProps> = ({
  filePath,
  audioFilePath,
  fileSize,
  audioFileSize
}) => {
  const hasVideo = !!filePath;
  const hasAudio = !!audioFilePath;

  // Don't render anything if no files exist
  if (!hasVideo && !hasAudio) {
    return null;
  }

  // Parse file sizes to numbers for formatting
  const videoSizeNum = typeof fileSize === 'string' ? parseInt(fileSize, 10) : fileSize;
  const audioSizeNum = typeof audioFileSize === 'string' ? parseInt(audioFileSize, 10) : audioFileSize;

  // Strip internal Docker paths for display
  const displayVideoPath = filePath ? stripInternalPath(filePath) : '';
  const displayAudioPath = audioFilePath ? stripInternalPath(audioFilePath) : '';

  // Format size labels
  const videoSizeLabel = videoSizeNum ? formatFileSize(videoSizeNum) : 'Unknown';
  const audioSizeLabel = audioSizeNum ? formatFileSize(audioSizeNum) : 'Unknown';

  return (
    <Box className="inline-flex items-center gap-1">
      {hasVideo && (
        <Tooltip title={displayVideoPath} arrow placement="top" enterTouchDelay={0}>
          <Chip
            size="small"
            icon={<VideoIcon size={14} className="text-primary" data-testid="MovieOutlinedIcon" />}
            label={videoSizeLabel}
            variant="outlined"
            style={{ height: 20, fontSize: '0.7rem' }}
          />
        </Tooltip>
      )}
      {hasAudio && (
        <Tooltip title={displayAudioPath} arrow placement="top" enterTouchDelay={0}>
          <Chip
            size="small"
            icon={<AudioIcon size={14} className="text-secondary" data-testid="AudiotrackOutlinedIcon" />}
            label={audioSizeLabel}
            variant="outlined"
            style={{ height: 20, fontSize: '0.7rem' }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default DownloadFormatIndicator;
