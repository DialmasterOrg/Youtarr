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

  const bannerContent = (
    <>
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
    </>
  );

  if (placement === 'inline') {
    return (
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 15,
          maxHeight: isVisible ? 96 : 0,
          opacity: isVisible ? 1 : 0,
          overflow: 'hidden',
          marginBottom: isVisible ? 12 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          transform: isVisible ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'max-height 180ms ease, opacity 140ms ease, margin-bottom 180ms ease, transform 180ms ease',
        }}
      >
        <div
          style={{
            position: 'relative',
            backgroundColor: 'var(--card)',
            border: `2px solid ${accentBorderColor}`,
            boxShadow: 'var(--shadow-soft)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            borderRadius: 'var(--radius-ui)',
          }}
        >
          {bannerContent}
        </div>
      </div>
    );
  }

  return (
    <Slide
      direction="down"
      in={isVisible}
      mountOnEnter={false}
      unmountOnExit={false}
    >
      <div
        style={{
          position: 'fixed',
          top: 'calc(64px + var(--shell-gap, 0px))',
          left: 0,
          right: 0,
          zIndex: 1302,
          backgroundColor: 'var(--card)',
          borderBottom: `2px solid ${accentBorderColor}`,
          borderTop: '1px solid transparent',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          borderRadius: 0,
          marginBottom: 0,
        }}
      >
        {bannerContent}
      </div>
    </Slide>
  );
};

