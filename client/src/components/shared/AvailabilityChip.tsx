import React from 'react';
import { Chip, Tooltip } from '../ui';
import {
  AlertCircle as ErrorOutlineIcon,
  CheckCircle as CheckCircleIcon,
} from 'lucide-react';
import { SHARED_THEMED_CHIP_SMALL_STYLE } from './chipStyles';

export interface AvailabilityChipProps {
  isAvailable: boolean;
  compact?: boolean;
}

const baseAvailableStyle: React.CSSProperties = {
  ...SHARED_THEMED_CHIP_SMALL_STYLE,
  backgroundColor: 'var(--success)',
  color: 'var(--success-foreground)',
};

const baseMissingStyle: React.CSSProperties = {
  ...SHARED_THEMED_CHIP_SMALL_STYLE,
  backgroundColor: 'var(--destructive)',
  color: 'var(--destructive-foreground)',
};

const COMPACT_OVERRIDES: React.CSSProperties = {
  height: 20,
  fontSize: '0.65rem',
};

function AvailabilityChip({ isAvailable, compact = false }: AvailabilityChipProps) {
  const baseStyle = isAvailable ? baseAvailableStyle : baseMissingStyle;
  const style = compact ? { ...baseStyle, ...COMPACT_OVERRIDES } : baseStyle;
  const tooltip = isAvailable ? 'Video file exists on disk' : 'Video file not found on disk';
  const label = isAvailable ? 'Available' : 'Missing';
  const icon = isAvailable ? <CheckCircleIcon size={12} /> : <ErrorOutlineIcon size={12} />;

  return (
    <Tooltip title={tooltip} enterTouchDelay={0}>
      <Chip
        size="small"
        icon={icon}
        label={label}
        color={isAvailable ? 'success' : 'error'}
        variant="filled"
        style={style}
      />
    </Tooltip>
  );
}

export default AvailabilityChip;
