import React from 'react';
import {
  Typography,
  Box,
  FormControlLabel,
  Switch,
  Chip,
} from '../../ui';

interface StatusBannerConfig {
  enabled: boolean;
  label?: string;
  onToggle?: (enabled: boolean) => void;
  onText?: string;
  offText?: string;
  toggleTestId?: string;
  showToggle?: boolean;
  successWhenEnabled?: boolean;
}

interface ConfigurationAccordionProps {
  title: string;
  chipLabel?: string;
  chipColor?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  /** @deprecated No longer has effect — sections are always expanded */
  defaultExpanded?: boolean;
  statusBanner?: StatusBannerConfig;
  children: React.ReactNode;
}

/**
 * Configuration section container — always fully visible (no collapse).
 */
export const ConfigurationAccordion: React.FC<ConfigurationAccordionProps> = ({
  title,
  chipLabel,
  chipColor = 'default',
  statusBanner,
  children,
}) => {
  const statusText = statusBanner
    ? (statusBanner.enabled ? (statusBanner.onText || 'On') : (statusBanner.offText || 'Off'))
    : null;
  const bannerUsesSuccessVisual = Boolean(statusBanner?.enabled && (statusBanner.successWhenEnabled ?? true));
  const showStatusToggle = Boolean(statusBanner?.showToggle ?? statusBanner?.onToggle);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Section header */}
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          width: '100%',
          paddingBottom: 12,
          borderBottom: '1px solid var(--border)',
          marginBottom: 16,
        }}
      >
        <Typography component="h3" variant="h6" style={{ flexGrow: 1 }}>
          {title}
        </Typography>
        {chipLabel && <Chip label={chipLabel} color={chipColor} size="small" />}
      </Box>

      {/* Optional status banner */}
      {statusBanner && (
        <Box
          className="mb-4"
          style={{
            border: `var(--border-weight) solid ${bannerUsesSuccessVisual ? 'var(--success)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-ui)',
            backgroundColor: bannerUsesSuccessVisual ? 'color-mix(in srgb, var(--success) 12%, var(--card))' : 'var(--muted)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <Typography
            variant="body2"
            style={{
              fontWeight: 600,
              color: bannerUsesSuccessVisual ? 'var(--success)' : 'inherit',
            }}
          >
            {statusText}
          </Typography>
          {showStatusToggle && statusBanner.onToggle && (
            <Box
              style={{
                border: `var(--border-weight) solid ${statusBanner.enabled ? 'var(--success)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--radius-ui)',
                padding: '2px 8px',
                backgroundColor: 'var(--card)',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={statusBanner.enabled}
                    onChange={(event) => statusBanner.onToggle?.(event.target.checked)}
                    inputProps={statusBanner.toggleTestId ? ({ 'data-testid': statusBanner.toggleTestId } as any) : undefined}
                  />
                }
                label={statusBanner.label || 'Enabled'}
                style={{ marginRight: 0 }}
              />
            </Box>
          )}
        </Box>
      )}

      {children}
    </div>
  );
};
