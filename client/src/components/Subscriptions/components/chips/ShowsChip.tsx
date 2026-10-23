import React from 'react';
import { Chip } from '../../../../components/ui';
import { MovieOutlined as ShowsIcon } from '../../../../lib/icons';
import { SHARED_CHANNEL_META_CHIP_STYLE, SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE } from '../../../shared/chipStyles';

interface ShowsChipProps {
  /** The channel's active title shows */
  count: number;
}

/** Marks a channel with title shows (shows built from its video titles). */
const ShowsChip: React.FC<ShowsChipProps> = ({ count }) => {
  if (!count) return null;
  return (
    <Chip
      data-testid="shows-chip"
      size="small"
      color="default"
      icon={<ShowsIcon size={14} style={{ color: 'var(--channel-meta-chip-icon)' }} />}
      label={`${count} ${count === 1 ? 'show' : 'shows'}`}
      title="Title shows: series built from this channel's video titles"
      style={{ ...SHARED_CHANNEL_META_CHIP_STYLE, ...SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE }}
    />
  );
};

export default ShowsChip;
