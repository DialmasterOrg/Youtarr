import React from 'react';
import { Chip, Tooltip } from '../../../../components/ui';
import { HelpOutline as HelpOutlineIcon } from '../../../../lib/icons';

interface TitleFilterChipProps {
  titleFilterRegex: string | null | undefined;
  onRegexClick: (event: React.MouseEvent<HTMLElement>, regex: string) => void;
  isMobile: boolean;
}

const TitleFilterChip: React.FC<TitleFilterChipProps> = ({
  titleFilterRegex,
  onRegexClick,
  isMobile,
}) => {
  if (!titleFilterRegex) {
    return null;
  }

  return (
    <Tooltip title="Title filter for channel downloads">
      <Chip
        icon={<HelpOutlineIcon size={16} data-testid="HelpOutlineIcon" />}
        label="Filters"
        size="small"
        variant="outlined"
        color="secondary"
        onClick={(e) => onRegexClick(e, titleFilterRegex)}
        style={{ fontSize: '0.65rem', cursor: 'pointer' }}
        data-testid="regex-filter-chip"
      />
    </Tooltip>
  );
};

export default TitleFilterChip;
