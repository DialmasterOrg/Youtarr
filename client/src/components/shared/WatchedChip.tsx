import React from 'react';
import { Chip, Tooltip } from '../ui';
import { Eye } from 'lucide-react';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_COMPACT_CHIP_OVERRIDES } from './chipStyles';
import { MEDIA_SERVER_LABELS } from '../../utils/mediaServerLabels';

interface WatchedChipProps {
  watchedBy: string[];
  compact?: boolean;
}

function WatchedChip({ watchedBy, compact = false }: WatchedChipProps) {
  if (watchedBy.length === 0) return null;
  const servers = watchedBy.map((s) => MEDIA_SERVER_LABELS[s] || s).join(', ');
  const label = `Watched on ${servers}`;
  const style = compact
    ? { ...SHARED_STATUS_CHIP_SMALL_STYLE, ...SHARED_COMPACT_CHIP_OVERRIDES }
    : SHARED_STATUS_CHIP_SMALL_STYLE;
  return (
    <Tooltip title={label}>
      <Chip
        size="small"
        icon={<Eye size={14} />}
        label="Watched"
        color="success"
        variant="outlined"
        style={style}
        aria-label={label}
        data-testid="watched-chip"
      />
    </Tooltip>
  );
}

export default WatchedChip;
