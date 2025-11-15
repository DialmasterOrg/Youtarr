import React from 'react';
import { Fab, Tooltip, Badge } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';

interface SaveBarProps {
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  onSave: () => void;
  validationError?: string | null;
}

/**
 * Floating action button for saving configuration
 */
export const SaveBar: React.FC<SaveBarProps> = ({
  hasUnsavedChanges,
  isLoading,
  onSave,
  validationError,
}) => {
  const getTooltipTitle = () => {
    if (validationError) return validationError;
    if (hasUnsavedChanges) return 'You have unsaved changes';
    return 'Save configuration settings';
  };

  return (
    <Tooltip
      title={getTooltipTitle()}
      placement="left"
    >
      <Badge
        color="warning"
        variant="dot"
        invisible={!hasUnsavedChanges}
        sx={{
          '& .MuiBadge-badge': {
            animation: hasUnsavedChanges ? 'pulse 1.5s infinite' : 'none',
            '@keyframes pulse': {
              '0%': {
                boxShadow: '0 0 0 0 rgba(237, 108, 2, 0.7)',
              },
              '70%': {
                boxShadow: '0 0 0 10px rgba(237, 108, 2, 0)',
              },
              '100%': {
                boxShadow: '0 0 0 0 rgba(237, 108, 2, 0)',
              },
            },
          },
        }}
      >
        <Fab
          variant="extended"
          color={hasUnsavedChanges ? 'warning' : 'primary'}
          onClick={onSave}
          disabled={isLoading || Boolean(validationError)}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: (theme) => theme.zIndex.drawer + 2,
          }}
          aria-label="save configuration"
        >
          <SaveIcon sx={{ mr: 1 }} />
          Save
        </Fab>
      </Badge>
    </Tooltip>
  );
};
