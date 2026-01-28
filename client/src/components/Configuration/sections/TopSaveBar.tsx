import React from 'react';
import {
  Box,
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  useTheme,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SaveIcon from '@mui/icons-material/Save';

interface TopSaveBarProps {
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  onSave: () => void;
  validationError?: string | null;
}

/**
 * Top status bar for configuration changes and save actions
 */
export const TopSaveBar: React.FC<TopSaveBarProps> = ({
  hasUnsavedChanges,
  isLoading,
  onSave,
  validationError,
}) => {
  const theme = useTheme();

  // Don't show if no changes and no error
  if (!hasUnsavedChanges && !validationError && !isLoading) {
    return null;
  }

  const isError = Boolean(validationError);
  const severity = isError ? 'error' : hasUnsavedChanges ? 'warning' : 'success';

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        mb: 2,
      }}
    >
      <Alert
        severity={severity}
        icon={
          isLoading ? (
            <CircularProgress size={20} sx={{ color: 'inherit' }} />
          ) : isError ? (
            <ErrorIcon />
          ) : hasUnsavedChanges ? (
            <SaveIcon />
          ) : (
            <CheckCircleIcon />
          )
        }
        action={
          hasUnsavedChanges && !isError && !isLoading ? (
            <Button
              color="inherit"
              size="small"
              onClick={onSave}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={16} /> : <SaveIcon />}
              sx={{ display: 'inline-flex', alignItems: 'center' }}
            >
              Save Changes
            </Button>
          ) : null
        }
        sx={{
          borderRadius: 'var(--radius-ui)',
          display: 'flex',
          alignItems: 'center',
          '& .MuiAlert-message': {
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <AlertTitle sx={{ fontWeight: 600, mb: 0 }}>
            {isLoading
              ? 'Saving configuration…'
              : isError
                ? 'Configuration Error'
                : hasUnsavedChanges
                  ? 'You have unsaved changes'
                  : 'Configuration saved successfully'}
          </AlertTitle>
          {validationError && <span>{validationError}</span>}
        </Box>
      </Alert>
    </Box>
  );
};
