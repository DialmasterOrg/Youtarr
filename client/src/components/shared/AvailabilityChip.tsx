import React, { useRef } from 'react';
import { Chip, Tooltip } from '../ui';
import {
  CheckCircle as CheckCircleIcon,
  CloudOff as MissingIcon,
  Trash2 as DeletedIcon,
} from 'lucide-react';
import { SHARED_THEMED_CHIP_SMALL_STYLE, SHARED_COMPACT_CHIP_OVERRIDES } from './chipStyles';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { RemovalState } from '../../utils/videoRemoval';
import { REMOVAL_TOOLTIP_CLASS } from './RemovalDescription';

export interface AvailabilityChipProps {
  // present = Available; missing = red, a file was expected and not found;
  // deleted = neutral, Youtarr removed the file (or the user marked it deleted).
  state: RemovalState;
  // Plain-language explanation (see RemovalDescription); shown on hover or tap.
  tooltip?: React.ReactNode;
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
    icon: <MissingIcon size={12} data-testid="CloudOffIcon" />,
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
  // On a touch device a tap opens the tooltip (the only way to read the reason
  // on a phone), so it must not also select or expand the row underneath.
  // Mouse clicks still pass through, as rows that expand on click expect, and
  // so do taps where the tooltip does not open on tap: the same query as Tooltip.
  const lastPointerType = useRef('mouse');
  const tapOpensTooltip = useMediaQuery('(pointer: coarse)');

  return (
    <Tooltip title={tooltip ?? variant.tooltip} enterTouchDelay={0} className={REMOVAL_TOOLTIP_CLASS}>
      <span
        className="inline-flex"
        onPointerDown={(event) => { lastPointerType.current = event.pointerType; }}
        onClick={(event) => {
          if (tapOpensTooltip && lastPointerType.current !== 'mouse') event.stopPropagation();
        }}
      >
        <Chip
          size="small"
          icon={variant.icon}
          label={label ?? variant.label}
          color={variant.color}
          variant={variant.variant}
          style={style}
        />
      </span>
    </Tooltip>
  );
}

export default AvailabilityChip;
