import React, { useRef } from 'react';
import { Chip, Tooltip } from '../ui';
import { Lock as LockIcon } from '../../lib/icons';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_COMPACT_CHIP_OVERRIDES } from './chipStyles';
import type { MembersAccessState } from '../../types/ChannelVideo';
import { getMembersAccessInfo } from '../../utils/videoStatus';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export interface MembersAccessChipProps {
  // From the listing row; null or undefined reads as "members only, no cookies".
  access: MembersAccessState | null | undefined;
  compact?: boolean;
}

// One chip for members-only videos on the channel and playlist pages, so both
// say the same thing in the same colors.
function MembersAccessChip({ access, compact = false }: MembersAccessChipProps) {
  const info = getMembersAccessInfo(access);
  const style: React.CSSProperties = {
    ...SHARED_STATUS_CHIP_SMALL_STYLE,
    ...(compact ? SHARED_COMPACT_CHIP_OVERRIDES : {}),
    backgroundColor: 'transparent',
    color: info.color,
    borderColor: info.color,
    minWidth: 'fit-content',
  };
  // As in AvailabilityChip: a tap that opens the tooltip must not also select
  // the card underneath; mouse clicks pass through.
  const lastPointerType = useRef('mouse');
  const tapOpensTooltip = useMediaQuery('(pointer: coarse)');

  return (
    <Tooltip title={info.description} enterTouchDelay={0}>
      <span
        className="inline-flex"
        onPointerDown={(event) => { lastPointerType.current = event.pointerType; }}
        onClick={(event) => {
          if (tapOpensTooltip && lastPointerType.current !== 'mouse') event.stopPropagation();
        }}
      >
        <Chip
          size="small"
          variant="outlined"
          icon={<LockIcon size={12} />}
          label={info.label}
          style={style}
          data-testid="members-access-chip"
        />
      </span>
    </Tooltip>
  );
}

export default MembersAccessChip;
