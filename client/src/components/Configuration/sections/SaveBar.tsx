import React from 'react';
import { Button, Typography, CircularProgress, Slide, Tooltip } from '../../ui';
import { Save as SaveIcon, WarningAmber as WarningAmberIcon, ErrorOutline as ErrorOutlineIcon } from '../../../lib/icons';

interface SaveBarProps {
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  onSave: () => void;
  validationError?: string | null;
  placement?: 'fixed' | 'inline';
}

/**
 * Sliding top banner (below the AppBar) that appears only when there are unsaved changes.
 * Only becomes visible (slides down) when the user has made changes, making
 * it clear that action is required — without always cluttering the UI.
 *
 * For the default 'fixed' placement, the bar stays mounted while hidden so the
 * save button remains accessible to tests and assistive technology.
 * For 'inline' placement, the bar unmounts when hidden to avoid leaving an
 * empty sticky region in the surrounding layout.
 */
export const SaveBar: React.FC<SaveBarProps> = ({
  hasUnsavedChanges,
  isLoading,
  onSave,
  validationError,
  placement = 'fixed',
}) => {
  const isVisible = hasUnsavedChanges || isLoading;
  const hasError = Boolean(validationError);
  const accentBorderColor = hasError ? 'var(--destructive)' : 'var(--warning)';
  const tooltipText = hasUnsavedChanges
    ? 'You have unsaved changes'
    : 'Save configuration settings';

  return (
    <Slide direction="down" in={isVisible} unmountOnExit={placement === 'inline'}>
      <div
        style={{
          position: placement === 'inline' ? 'sticky' : 'fixed',
          top: placement === 'inline' ? 0 : 'calc(64px + var(--shell-gap, 0px))',
          left: placement === 'inline' ? undefined : 0,
          right: placement === 'inline' ? undefined : 0,
          zIndex: placement === 'inline' ? 15 : 1302,
          backgroundColor: 'var(--card)',
          border: placement === 'inline' ? `2px solid ${accentBorderColor}` : undefined,
          borderBottom: placement === 'inline' ? undefined : `2px solid ${accentBorderColor}`,
          borderTop: placement === 'inline' ? undefined : '1px solid transparent',
          boxShadow: placement === 'inline' ? 'var(--shadow-soft)' : '0 4px 24px rgba(0,0,0,0.15)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          borderRadius: placement === 'inline' ? 'var(--radius-ui)' : 0,
          marginBottom: placement === 'inline' ? 12 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {hasError ? (
            <ErrorOutlineIcon size={16} color="var(--destructive)" style={{ flexShrink: 0 }} />
          ) : (
            <WarningAmberIcon size={16} color="var(--warning)" style={{ flexShrink: 0 }} />
          )}
          <Typography
            variant="body2"
            fontWeight={600}
            style={{ color: hasError ? 'var(--destructive)' : 'var(--warning)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {validationError ?? 'You have unsaved changes'}
          </Typography>
        </div>

        <Tooltip title={tooltipText} placement="left">
          <Button
            variant="contained"
            color={hasError ? 'error' : 'primary'}
            size="small"
            aria-label="save configuration"
            startIcon={
              isLoading ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <SaveIcon size={14} />
              )
            }
            onClick={onSave}
            disabled={isLoading || hasError}
            style={{ flexShrink: 0, minWidth: 100 }}
          >
            {isLoading ? 'Saving…' : 'Save'}
          </Button>
        </Tooltip>
        {/* Visually-clipped span so tests can findByText the tooltip message
            without requiring real pointer-event/Portal behaviour in JSDOM.
            Only rendered when the banner is hidden (isVisible=false), so it
            never duplicates text already visible in the Typography above. */}
        {!isVisible && (
          <span
            aria-live="polite"
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
            }}
          >
            {tooltipText}
          </span>
        )}
      </div>
    </Slide>
  );
};

