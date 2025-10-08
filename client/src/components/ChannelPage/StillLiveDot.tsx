import React, { useState } from 'react';
import { Tooltip, Chip } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

interface StillLiveDotProps {
  isMobile?: boolean;
  onMobileClick?: (message: string) => void;
}

function StillLiveDot({ isMobile = false, onMobileClick }: StillLiveDotProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const message = "Cannot download while still airing";

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isMobile && onMobileClick) {
      onMobileClick(message);
    } else {
      setTooltipOpen(!tooltipOpen);
      // Auto-close tooltip after 2 seconds
      setTimeout(() => setTooltipOpen(false), 2000);
    }
  };

  const liveDot = (
    <Chip
      icon={<FiberManualRecordIcon sx={{ fontSize: 12, animation: 'pulse 2s infinite' }} />}
      label="LIVE"
      size="small"
      onClick={handleClick}
      sx={{
        bgcolor: 'error.main',
        color: 'white',
        fontWeight: 'bold',
        cursor: 'pointer',
        '&:hover': {
          bgcolor: 'error.dark',
        },
        '@keyframes pulse': {
          '0%': {
            opacity: 1,
          },
          '50%': {
            opacity: 0.6,
          },
          '100%': {
            opacity: 1,
          },
        },
      }}
    />
  );

  if (isMobile) {
    return liveDot;
  }

  return (
    <Tooltip
      title={message}
      open={tooltipOpen}
      onClose={() => setTooltipOpen(false)}
      disableHoverListener
      disableFocusListener
      disableTouchListener
    >
      {liveDot}
    </Tooltip>
  );
}

export default StillLiveDot;
