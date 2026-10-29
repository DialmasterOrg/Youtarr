import React from 'react';
import { Chip } from '../../../../components/ui';
import { Tv as TvIcon } from '../../../../lib/icons';
import { SHARED_CHANNEL_META_CHIP_STYLE, SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE } from '../../../shared/chipStyles';

/** Marks a channel whose videos are saved as a TV show. */
const TvChip: React.FC = () => (
  <Chip
    data-testid="tv-chip"
    size="small"
    color="default"
    icon={<TvIcon size={14} style={{ color: 'var(--channel-meta-chip-icon)' }} data-testid="TvIcon" />}
    label="TV"
    title="Saved as a TV show"
    style={{ ...SHARED_CHANNEL_META_CHIP_STYLE, ...SHARED_CHANNEL_META_DEFAULT_SURFACE_STYLE }}
  />
);

export default TvChip;
