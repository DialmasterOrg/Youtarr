import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Chip,
  Box,
  FormControlLabel,
  Switch,
} from '../../ui';

interface StatusBannerConfig {
  enabled: boolean;
  label: string;
  onToggle: (enabled: boolean) => void;
  onText?: string;
  offText?: string;
  toggleTestId?: string;
}

interface ConfigurationAccordionProps {
  title: string;
  chipLabel?: string;
  chipColor?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  defaultExpanded?: boolean;
  statusBanner?: StatusBannerConfig;
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
  statusBanner,
  children,
}) => {
  const statusText = statusBanner
    ? (statusBanner.enabled ? (statusBanner.onText || 'On') : (statusBanner.offText || 'Off'))
    : null;

  return (
    <Accordion elevation={1} defaultExpanded={defaultExpanded} style={{ marginBottom: 24 }}>
      <AccordionSummary>
        <Typography variant="h6" style={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {chipLabel && (
          <Chip
            label={chipLabel}
            color={chipColor}
            size="small"
            style={{ marginRight: 8 }}
          />
        )}
      </AccordionSummary>
      <AccordionDetails>
        {statusBanner && (
          <Box
            className="mb-4"
            style={{
              border: 'var(--border-weight) solid var(--border)',
              borderRadius: 'var(--radius-ui)',
              backgroundColor: 'var(--muted)',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="body2" style={{ fontWeight: 600 }}>
              {statusText}
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={statusBanner.enabled}
                  onChange={(event) => statusBanner.onToggle(event.target.checked)}
                  inputProps={statusBanner.toggleTestId ? ({ 'data-testid': statusBanner.toggleTestId } as any) : undefined}
                />
              }
              label={statusBanner.label}
              style={{ marginRight: 0 }}
            />
          </Box>
        )}
        {children}
      </AccordionDetails>
    </Accordion>
  );
};
