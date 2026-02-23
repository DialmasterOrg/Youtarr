import React from 'react';
import { Chip, Tooltip } from '../../../../components/ui';
import { AccessTime as AccessTimeIcon } from '../../../../lib/icons';

interface DurationFilterChipProps {
  minDuration: number | null | undefined;
  maxDuration: number | null | undefined;
  isMobile: boolean;
}

const formatDuration = (minSeconds?: number | null, maxSeconds?: number | null, isMobile?: boolean) => {
  const minMinutes = minSeconds ? Math.floor(minSeconds / 60) : null;
  const maxMinutes = maxSeconds ? Math.floor(maxSeconds / 60) : null;

  if (minMinutes && maxMinutes) {
    return `${minMinutes}-${maxMinutes}m`;
  } else if (minMinutes) {
    return `≥${minMinutes}m`;
  } else if (maxMinutes) {
    return `≤${maxMinutes}m`;
  }
  return '';
};

const DurationFilterChip: React.FC<DurationFilterChipProps> = ({
  minDuration,
  maxDuration,
  isMobile,
}) => {
  const hasDurationFilter = minDuration || maxDuration;

  if (!hasDurationFilter) {
    return null;
  }

  const durationLabel = formatDuration(minDuration, maxDuration, isMobile);

  return (
    <Tooltip title={`Channel download duration filter: ${durationLabel}`}>
      <Chip
        icon={<AccessTimeIcon size={16} />}
        label={durationLabel}
        size="small"
        variant="outlined"
        color="primary"
        style={{ fontSize: '0.65rem' }}
      />
    </Tooltip>
  );
};

export default DurationFilterChip;
