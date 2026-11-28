import React from 'react';
import { Chip, Tooltip } from '../ui';
import {
  getStatusChipStyle,
  getStatusChipVariant,
  getStatusColor,
  getStatusIcon,
  getStatusLabel,
  isRemovedStatus,
  VideoStatus,
} from '../../utils/videoStatus';
import type { RemovalRow } from '../../utils/videoRemoval';
import RemovalDescription, { REMOVAL_TOOLTIP_CLASS } from './RemovalDescription';
import { SHARED_THEMED_CHIP_SMALL_STYLE } from './chipStyles';

interface VideoStatusChipProps {
  status: VideoStatus;
  // What this page calls a video that has its file, where that is not "Downloaded".
  downloadedLabel?: string;
  // The row a missing or deleted status is explained from, on hover or tap.
  removalRow?: RemovalRow;
  baseStyle?: React.CSSProperties;
  className?: string;
  style?: React.CSSProperties;
}

function VideoStatusChip({
  status,
  downloadedLabel,
  removalRow,
  baseStyle = SHARED_THEMED_CHIP_SMALL_STYLE,
  className,
  style,
}: VideoStatusChipProps) {
  const chip = (
    <Chip
      icon={getStatusIcon(status)}
      label={status === 'downloaded' && downloadedLabel ? downloadedLabel : getStatusLabel(status)}
      size="small"
      color={getStatusColor(status)}
      variant={getStatusChipVariant(status)}
      className={className}
      style={{ ...baseStyle, ...getStatusChipStyle(status), ...style }}
    />
  );
  if (!removalRow) return chip;
  return (
    <Tooltip
      title={isRemovedStatus(status) ? <RemovalDescription row={removalRow} /> : ''}
      enterTouchDelay={0}
      className={REMOVAL_TOOLTIP_CLASS}
    >
      {chip}
    </Tooltip>
  );
}

export default VideoStatusChip;
