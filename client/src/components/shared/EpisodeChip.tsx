import React from 'react';
import { Chip, Tooltip } from '../ui';
import { Tv as TvIcon } from '../../lib/icons';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_COMPACT_CHIP_OVERRIDES } from './chipStyles';
import type { EpisodeInfo } from '../../types/tvShows';

interface EpisodeChipProps {
  episode: EpisodeInfo | null | undefined;
  compact?: boolean;
  /** The episode a title show gives a video that isn't downloaded yet */
  planned?: boolean;
}

/** SxxEyy of a video saved (or planned) as a TV episode; nothing for other videos. */
function EpisodeChip({ episode, compact = false, planned = false }: EpisodeChipProps) {
  if (!episode) return null;
  const description = episode.showName ? `${episode.showName}, ${episode.code}` : episode.code;
  const style = compact
    ? { ...SHARED_STATUS_CHIP_SMALL_STYLE, ...SHARED_COMPACT_CHIP_OVERRIDES }
    : SHARED_STATUS_CHIP_SMALL_STYLE;
  const label = planned ? `Planned TV episode ${description}, once downloaded` : `TV episode ${description}`;
  return (
    <Tooltip title={planned ? `Planned TV episode: ${description}, once downloaded` : `TV episode: ${description}`}>
      <Chip
        size="small"
        icon={<TvIcon size={14} />}
        label={episode.code}
        variant="outlined"
        style={planned ? { ...style, borderStyle: 'dashed' } : style}
        aria-label={label}
        data-testid="episode-chip"
      />
    </Tooltip>
  );
}

export default EpisodeChip;
