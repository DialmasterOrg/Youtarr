import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

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
  defaultExpanded = false,
  children,
}) => {
  return (
    <Accordion elevation={1} defaultExpanded={defaultExpanded} sx={{ mb: 3 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
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
      </AccordionSummary>
      <AccordionDetails>
        {children}
      </AccordionDetails>
    </Accordion>
  );
};
