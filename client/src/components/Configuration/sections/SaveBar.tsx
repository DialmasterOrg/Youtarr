import React from 'react';
import { Button, Typography, CircularProgress, Slide } from '../../ui';
import { Save as SaveIcon, WarningAmber as WarningAmberIcon, ErrorOutline as ErrorOutlineIcon } from '../../../lib/icons';

interface SaveBarProps {
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  onSave: () => void;
  validationError?: string | null;
}

/**
 * Sliding top banner (below the AppBar) that appears only when there are unsaved changes.
 * Only becomes visible (slides down) when the user has made changes, making
 * it clear that action is required — without always cluttering the UI.
 */
export const SaveBar: React.FC<SaveBarProps> = ({
  hasUnsavedChanges,
  isLoading,
  onSave,
  validationError,
}) => {
  const isVisible = hasUnsavedChanges || isLoading;
  const hasError = Boolean(validationError);

  return (
    <Slide direction="down" in={isVisible} mountOnEnter unmountOnExit>
      <div
        style={{
          position: 'fixed',
          top: 'calc(64px + var(--shell-gap, 0px))',
          left: 0,
          right: 0,
          zIndex: 1302,
          backgroundColor: 'var(--card)',
          borderBottom: `2px solid ${hasError ? 'var(--destructive)' : 'var(--warning)'}`,
          borderTop: '1px solid transparent',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
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

        <Button
          variant="contained"
          color={hasError ? 'error' : 'primary'}
          size="small"
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
      </div>
    </Slide>
  );
};

