import React from 'react';
import { Chip, Tooltip } from '../ui';
import {
  AlertCircle as ErrorOutlineIcon,
  CheckCircle as CheckCircleIcon,
  Trash2 as DeletedIcon,
} from 'lucide-react';
import { SHARED_THEMED_CHIP_SMALL_STYLE, SHARED_COMPACT_CHIP_OVERRIDES } from './chipStyles';
import type { RemovalState } from '../../utils/videoRemoval';

export interface AvailabilityChipProps {
  // present = Available; missing = red, a file was expected and not found;
  // deleted = neutral, Youtarr removed the file (or the user marked it deleted).
  state: RemovalState;
  // Plain-language explanation (see utils/videoRemoval describeRow); shown on hover or tap.
  tooltip?: string;
  // Replaces the state's label, e.g. a "2 missing" summary count.
  label?: string;
  compact?: boolean;
}

interface Variant {
  label: string;
  tooltip: string;
  color: 'success' | 'error' | 'default';
  variant: 'filled' | 'outlined';
  icon: React.ReactNode;
  style: React.CSSProperties;
}

const VARIANTS: Record<RemovalState, Variant> = {
  present: {
    label: 'Available',
    tooltip: 'Video file exists on disk',
    color: 'success',
    variant: 'filled',
    icon: <CheckCircleIcon size={12} />,
    style: {
      ...SHARED_THEMED_CHIP_SMALL_STYLE,
      backgroundColor: 'var(--success)',
      color: 'var(--success-foreground)',
    },
  },
  missing: {
    label: 'Missing',
    tooltip: 'Video file not found on disk',
    color: 'error',
    variant: 'filled',
    icon: <ErrorOutlineIcon size={12} />,
    style: {
      ...SHARED_THEMED_CHIP_SMALL_STYLE,
      backgroundColor: 'var(--destructive)',
      color: 'var(--destructive-foreground)',
    },
  },
  deleted: {
    label: 'Deleted',
    tooltip: 'Video file was deleted',
    color: 'default',
    variant: 'outlined',
    icon: <DeletedIcon size={12} data-testid="DeletedChipIcon" />,
    style: {
      ...SHARED_THEMED_CHIP_SMALL_STYLE,
      backgroundColor: 'transparent',
      color: 'var(--muted-foreground)',
    },
  },
};

function AvailabilityChip({ state, tooltip, label, compact = false }: AvailabilityChipProps) {
  const variant = VARIANTS[state];
  const style = compact ? { ...variant.style, ...SHARED_COMPACT_CHIP_OVERRIDES } : variant.style;

  return (
    <Tooltip title={tooltip ?? variant.tooltip} enterTouchDelay={0}>
      <Chip
        size="small"
        icon={variant.icon}
        label={label ?? variant.label}
        color={variant.color}
        variant={variant.variant}
        style={style}
      />
    </Tooltip>
  );
}

export default AvailabilityChip;
