import React from 'react';
import { Chip, Tooltip } from '../ui';
import { Tv as TvIcon } from '../../lib/icons';
import { SHARED_STATUS_CHIP_SMALL_STYLE, SHARED_COMPACT_CHIP_OVERRIDES } from './chipStyles';
import type { EpisodeInfo } from '../../types/tvShows';

interface EpisodeChipProps {
  episode: EpisodeInfo | null | undefined;
  compact?: boolean;
}

/** SxxEyy of a video saved as a TV episode; nothing for other videos. */
function EpisodeChip({ episode, compact = false }: EpisodeChipProps) {
  if (!episode) return null;
  const description = episode.showName ? `${episode.showName}, ${episode.code}` : episode.code;
  const style = compact
    ? { ...SHARED_STATUS_CHIP_SMALL_STYLE, ...SHARED_COMPACT_CHIP_OVERRIDES }
    : SHARED_STATUS_CHIP_SMALL_STYLE;
  return (
    <Tooltip title={`TV episode: ${description}`}>
      <Chip
        size="small"
        icon={<TvIcon size={14} />}
        label={episode.code}
        variant="outlined"
        style={style}
        aria-label={`TV episode ${description}`}
        data-testid="episode-chip"
      />
    </Tooltip>
  );
}

export default EpisodeChip;
