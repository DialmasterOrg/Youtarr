import React from 'react';
import { Tooltip, IconButton } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

interface InfoTooltipProps {
  text: string;
  onMobileClick?: (text: string) => void;
}

/**
 * Reusable info icon tooltip component
 * - Desktop: Shows tooltip on hover
 * - Mobile: Triggers callback to show snackbar
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, onMobileClick }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile && onMobileClick) {
      onMobileClick(text);
    }
  };

  if (isMobile) {
    return (
      <IconButton
        size="small"
        sx={{ ml: 0.5, p: 0.5, color: 'var(--foreground)' }}
        onClick={handleClick}
      >
        <InfoIcon fontSize="small" />
      </IconButton>
    );
  }

  return (
    <Tooltip title={text} arrow placement="top">
      <IconButton size="small" sx={{ ml: 0.5, p: 0.5, color: 'var(--foreground)' }}>
        <InfoIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};
