import React from 'react';
import { Chip, Tooltip } from '../ui';
import { AlertCircle } from 'lucide-react';
import { SHARED_THEMED_CHIP_SMALL_STYLE } from '../shared/chipStyles';

const DEFAULT_TOOLTIP = 'Video file not found on disk. It may have been deleted or moved.';

interface MissingVideoChipProps {
  label?: string;
  tooltip?: string;
}

function MissingVideoChip({ label = 'Missing', tooltip = DEFAULT_TOOLTIP }: MissingVideoChipProps) {
  return (
    <Tooltip title={tooltip} enterTouchDelay={0}>
      <Chip
        size="small"
        icon={<AlertCircle size={12} />}
        label={label}
        color="error"
        variant="filled"
        style={SHARED_THEMED_CHIP_SMALL_STYLE}
      />
    </Tooltip>
  );
}

export default MissingVideoChip;
