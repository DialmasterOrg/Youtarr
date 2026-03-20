import React from 'react';
import { Box, Chip, Tooltip } from '../ui';
import { Storage as StorageIcon } from '../../lib/icons';
import { formatFileSize } from '../../utils/formatters';
import { SHARED_THEMED_CHIP_SMALL_STYLE } from './chipStyles';

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

const getPathLocation = (path: string): string => {
  const normalizedPath = stripInternalPath(path).replace(/\\/g, '/').replace(/\/+$/, '');
  const lastSlashIndex = normalizedPath.lastIndexOf('/');

  if (lastSlashIndex <= 0) {
    return normalizedPath.startsWith('/') ? '/' : 'Downloads';
  }

  return normalizedPath.slice(0, lastSlashIndex);
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

  const displayVideoLocation = filePath ? getPathLocation(filePath) : '';
  const displayAudioLocation = audioFilePath ? getPathLocation(audioFilePath) : '';

  // Format size labels
  const videoSizeLabel = videoSizeNum ? formatFileSize(videoSizeNum) : 'Unknown';
  const audioSizeLabel = audioSizeNum ? formatFileSize(audioSizeNum) : 'Unknown';
  const renderPathTooltip = (path: string) => (
    <div
      style={{
        maxWidth: 320,
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      }}
    >
      {path}
    </div>
  );

  return (
    <Box className="inline-flex items-center gap-1">
      {hasVideo && (
        <Tooltip title={renderPathTooltip(displayVideoLocation)} arrow placement="top" enterTouchDelay={0}>
          <Chip
            size="small"
            icon={<StorageIcon size={14} className="text-primary" data-testid="StorageIcon" />}
            label={videoSizeLabel}
            variant="outlined"
            style={SHARED_THEMED_CHIP_SMALL_STYLE}
          />
        </Tooltip>
      )}
      {hasAudio && (
        <Tooltip title={renderPathTooltip(displayAudioLocation)} arrow placement="top" enterTouchDelay={0}>
          <Chip
            size="small"
            icon={<StorageIcon size={14} className="text-secondary" data-testid="StorageIcon" />}
            label={audioSizeLabel}
            variant="outlined"
            style={SHARED_THEMED_CHIP_SMALL_STYLE}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default DownloadFormatIndicator;
