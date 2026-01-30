import React from 'react';
import { Box, BoxProps } from '@mui/material';
import { ThemeMode } from '../../themes';

interface ActionBarProps extends BoxProps {
  variant: ThemeMode;
  compact?: boolean;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  variant,
  compact = false,
  className,
  children,
  ...rest
}) => {
  const classes = [
    'action-bar',
    `action-bar--${variant}`,
    compact ? 'action-bar--compact' : null,
    className || null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Box className={classes} {...rest}>
      {children}
    </Box>
  );
};
