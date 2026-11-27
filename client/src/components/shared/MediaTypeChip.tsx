import React from 'react';
import { Chip } from '../ui';
import { getMediaTypeInfo } from '../../utils/videoStatus';
import { SHARED_STATUS_CHIP_SMALL_STYLE } from './chipStyles';

interface MediaTypeChipProps {
  mediaType?: string | null;
  style?: React.CSSProperties;
}

// Marks a short or a live stream; an ordinary video gets no chip.
function MediaTypeChip({ mediaType, style }: MediaTypeChipProps) {
  const info = getMediaTypeInfo(mediaType);
  if (!info) return null;
  return (
    <Chip
      size="small"
      icon={info.icon}
      label={info.label}
      color={info.color}
      variant="outlined"
      style={{ ...SHARED_STATUS_CHIP_SMALL_STYLE, ...style }}
    />
  );
}

export default MediaTypeChip;
