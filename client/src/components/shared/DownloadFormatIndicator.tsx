import React from 'react';
import { Box, Chip, Tooltip } from '../ui';
import { MovieOutlined as VideoFormatIcon, AudioIcon as AudioFormatIcon } from '../../lib/icons';
import { formatFileSize } from '../../utils/formatters';
import { SHARED_THEMED_CHIP_SMALL_STYLE } from './chipStyles';

interface DownloadFormatIndicatorProps {
  filePath?: string | null;
  audioFilePath?: string | null;
  fileSize?: number | string | null;
  audioFileSize?: number | string | null;
  // 'vertical' stacks the chips to fit narrow table columns
  orientation?: 'horizontal' | 'vertical';
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

const getDisplayPath = (path: string): string =>
  stripInternalPath(path).replace(/\\/g, '/').replace(/\/+$/, '');

const DownloadFormatIndicator: React.FC<DownloadFormatIndicatorProps> = ({
  filePath,
  audioFilePath,
  fileSize,
  audioFileSize,
  orientation = 'horizontal'
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

  const displayVideoPath = filePath ? getDisplayPath(filePath) : '';
  const displayAudioPath = audioFilePath ? getDisplayPath(audioFilePath) : '';

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

  const containerClassName =
    orientation === 'vertical'
      ? 'inline-flex flex-col items-start gap-1'
      : 'inline-flex items-center gap-1';

  return (
    <Box
      className={containerClassName}
      data-testid="download-format-indicator"
      // A chip tap should just show its path tooltip, not bubble up to row/card selection.
      onClick={(e) => e.stopPropagation()}
    >
      {hasVideo && (
        <Tooltip title={renderPathTooltip(displayVideoPath)} arrow placement="top" enterTouchDelay={0}>
          <Chip
            size="small"
            icon={<VideoFormatIcon size={14} className="text-primary" data-testid="VideoFormatIcon" />}
            label={videoSizeLabel}
            variant="outlined"
            style={SHARED_THEMED_CHIP_SMALL_STYLE}
          />
        </Tooltip>
      )}
      {hasAudio && (
        <Tooltip title={renderPathTooltip(displayAudioPath)} arrow placement="top" enterTouchDelay={0}>
          <Chip
            size="small"
            icon={<AudioFormatIcon size={14} className="text-secondary" data-testid="AudioFormatIcon" />}
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
