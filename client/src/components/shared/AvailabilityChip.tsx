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
import {
  getStatusChipStyle,
  getStatusChipVariant,
  getStatusColor,
  getStatusLabel,
  VideoStatus,
} from '../../utils/videoStatus';
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

// The video status each state is colored and labelled as; only "Available"
// differs from the status's own label.
const STATUS: Record<RemovalState, VideoStatus> = {
  present: 'downloaded',
  missing: 'missing',
  deleted: 'deleted',
};

const VARIANTS: Record<RemovalState, { label?: string; tooltip: string; icon: React.ReactNode }> = {
  present: { label: 'Available', tooltip: 'Video file exists on disk', icon: <CheckCircleIcon size={12} /> },
  missing: { tooltip: 'Video file not found on disk', icon: <MissingIcon size={12} data-testid="CloudOffIcon" /> },
  deleted: { tooltip: 'Video file was deleted', icon: <DeletedIcon size={12} data-testid="DeletedChipIcon" /> },
};

function AvailabilityChip({ state, tooltip, label, compact = false }: AvailabilityChipProps) {
  const variant = VARIANTS[state];
  const status = STATUS[state];
  const style = {
    ...SHARED_THEMED_CHIP_SMALL_STYLE,
    ...getStatusChipStyle(status),
    ...(compact ? SHARED_COMPACT_CHIP_OVERRIDES : undefined),
  };
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
          label={label ?? variant.label ?? getStatusLabel(status)}
          color={getStatusColor(status)}
          variant={getStatusChipVariant(status)}
          style={style}
        />
      </span>
    </Tooltip>
  );
}

export default AvailabilityChip;
