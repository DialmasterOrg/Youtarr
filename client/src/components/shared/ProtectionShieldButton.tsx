import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { SxProps, Theme } from '@mui/material/styles';

type ShieldVariant = 'overlay' | 'inline';
type ShieldSize = 'small' | 'medium';

interface ProtectionShieldButtonProps {
  isProtected: boolean;
  onClick: (e: React.MouseEvent) => void;
  variant?: ShieldVariant;
  size?: ShieldSize;
  sx?: SxProps<Theme>;
}

function ProtectionShieldButton({
  isProtected,
  onClick,
  variant = 'overlay',
  size = 'medium',
  sx,
}: ProtectionShieldButtonProps) {
  const tooltipText = isProtected ? 'Remove protection' : 'Protect from auto-deletion';

  const overlayStyles: SxProps<Theme> = {
    bgcolor: isProtected ? 'primary.main' : 'rgba(0,0,0,0.5)',
    color: isProtected ? 'white' : 'grey.500',
    padding: size === 'small' ? 0.3 : 0.5,
    opacity: isProtected ? 1 : 0.6,
    '&:hover': {
      bgcolor: isProtected ? 'primary.dark' : 'rgba(0,0,0,0.8)',
      opacity: 1,
    },
    transition: 'all 0.2s',
    boxShadow: isProtected ? '0 0 6px rgba(25,118,210,0.5)' : 'none',
  };

  const inlineStyles: SxProps<Theme> = {
    color: isProtected ? 'primary.main' : 'action.active',
    opacity: isProtected ? 1 : 0.5,
    '&:hover': {
      color: 'primary.main',
      bgcolor: 'primary.light',
    },
  };

  const baseStyles = variant === 'overlay' ? overlayStyles : inlineStyles;
  const iconFontSize = size === 'small' ? 14 : 16;

  return (
    <Tooltip title={tooltipText} arrow>
      <IconButton
        aria-label={tooltipText}
        onClick={onClick}
        sx={[
          baseStyles,
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
        size="small"
      >
        {isProtected
          ? (variant === 'inline'
              ? <ShieldIcon fontSize="small" />
              : <ShieldIcon sx={{ fontSize: iconFontSize }} />)
          : (variant === 'inline'
              ? <ShieldOutlinedIcon fontSize="small" />
              : <ShieldOutlinedIcon sx={{ fontSize: iconFontSize }} />)
        }
      </IconButton>
    </Tooltip>
  );
}

export default ProtectionShieldButton;
