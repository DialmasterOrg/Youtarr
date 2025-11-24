import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

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
        icon={<HelpOutlineIcon />}
        label="Filters"
        size="small"
        variant="outlined"
        color="secondary"
        onClick={(e) => onRegexClick(e, titleFilterRegex)}
        sx={{ fontSize: '0.65rem', cursor: 'pointer', '& .MuiChip-icon': { ml: 0.3 } }}
        data-testid="regex-filter-chip"
      />
    </Tooltip>
  );
};

export default TitleFilterChip;
