import React from 'react';
import { Chip, Tooltip } from '../ui';
import { AlertTriangle } from 'lucide-react';
import { SHARED_THEMED_CHIP_SMALL_STYLE } from '../shared/chipStyles';

interface FailedVideoChipProps {
  count: number;
  diagnosisTitles?: string[];
}

function FailedVideoChip({ count, diagnosisTitles = [] }: FailedVideoChipProps) {
  const tooltip =
    diagnosisTitles.length > 0
      ? diagnosisTitles.join('; ')
      : `${count} download${count !== 1 ? 's' : ''} failed`;

  return (
    <Tooltip title={tooltip} enterTouchDelay={0}>
      <Chip
        size="small"
        icon={<AlertTriangle size={12} />}
        label={`${count} failed`}
        color="warning"
        variant="filled"
        style={SHARED_THEMED_CHIP_SMALL_STYLE}
      />
    </Tooltip>
  );
}

export default FailedVideoChip;
