import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

interface ConfigurationAccordionProps {
  title: string;
  chipLabel?: string;
  chipColor?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * Reusable accordion wrapper with consistent styling for configuration sections
 */
export const ConfigurationAccordion: React.FC<ConfigurationAccordionProps> = ({
  title,
  chipLabel,
  chipColor = 'default',
  children,
}) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
          {title}
        </Typography>
        {chipLabel && (
          <Chip
            label={chipLabel}
            color={chipColor}
            size="small"
            sx={{ mr: 1 }}
          />
        )}
      </Box>
      {children}
    </Box>
  );
};
