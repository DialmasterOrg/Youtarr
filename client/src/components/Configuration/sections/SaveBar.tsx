import React from 'react';
import { Box, Button, Typography, CircularProgress, Slide } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

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
      <Box
        sx={{
          position: 'fixed',
          top: 'calc(64px + var(--shell-gap, 0px))',
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.drawer + 2,
          bgcolor: 'background.paper',
          borderBottom: '2px solid',
          borderTop: '1px solid',
          borderColor: hasError ? 'error.main' : 'warning.main',
          borderTopColor: 'transparent',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          px: { xs: 2, sm: 4 },
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          {hasError ? (
            <ErrorOutlineIcon color="error" fontSize="small" sx={{ flexShrink: 0 }} />
          ) : (
            <WarningAmberIcon color="warning" fontSize="small" sx={{ flexShrink: 0 }} />
          )}
          <Typography
            variant="body2"
            fontWeight={600}
            color={hasError ? 'error.main' : 'warning.main'}
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {validationError ?? 'You have unsaved changes'}
          </Typography>
        </Box>

        <Button
          variant="contained"
          color={hasError ? 'error' : 'primary'}
          size="small"
          startIcon={
            isLoading ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <SaveIcon />
            )
          }
          onClick={onSave}
          disabled={isLoading || hasError}
          sx={{ flexShrink: 0, minWidth: 100 }}
        >
          {isLoading ? 'Saving…' : 'Save'}
        </Button>
      </Box>
    </Slide>
  );
};

