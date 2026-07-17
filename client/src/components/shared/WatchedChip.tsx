import React from 'react';
import { Chip, Tooltip } from '../ui';
import { Eye } from 'lucide-react';
import { SHARED_STATUS_CHIP_SMALL_STYLE } from './chipStyles';
import { MEDIA_SERVER_LABELS } from '../../utils/mediaServerLabels';

interface WatchedChipProps {
  watchedBy: string[];
}

function WatchedChip({ watchedBy }: WatchedChipProps) {
  if (watchedBy.length === 0) return null;
  const servers = watchedBy.map((s) => MEDIA_SERVER_LABELS[s] || s).join(', ');
  const label = `Watched on ${servers}`;
  return (
    <Tooltip title={label}>
      <span aria-label={label}>
        <Chip
          size="small"
          icon={<Eye size={14} />}
          label="Watched"
          color="success"
          variant="outlined"
          style={SHARED_STATUS_CHIP_SMALL_STYLE}
        />
      </span>
    </Tooltip>
  );
}

export default WatchedChip;
