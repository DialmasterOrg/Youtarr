import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContentBody,
  DialogContentText,
  DialogActions,
  Button,
} from '../../ui';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

interface UnsavedChangesDialogProps {
  open: boolean;
  isSaving: boolean;
  validationError: string | null;
  onDiscard: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  open,
  isSaving,
  validationError,
  onDiscard,
  onCancel,
  onSave,
}) => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const saveDisabled = isSaving || Boolean(validationError);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" disableEscapeKeyDown={isSaving}>
      <DialogTitle>Unsaved changes</DialogTitle>
      <DialogContentBody>
        <DialogContentText>
          You have unsaved configuration changes. What do you want to do?
        </DialogContentText>
        {validationError && (
          <p
            role="alert"
            className="mt-3 text-sm font-medium text-destructive"
          >
            {validationError}
          </p>
        )}
      </DialogContentBody>
      <DialogActions
        className={isMobile ? 'flex-col-reverse items-stretch gap-2' : undefined}
      >
        <Button
          variant="ghost"
          color="error"
          onClick={onDiscard}
          disabled={isSaving}
          fullWidth={isMobile}
        >
          Discard changes
        </Button>
        <Button
          variant="outlined"
          color="inherit"
          onClick={onCancel}
          disabled={isSaving}
          autoFocus
          fullWidth={isMobile}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onSave}
          disabled={saveDisabled}
          loading={isSaving}
          fullWidth={isMobile}
        >
          Save and continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UnsavedChangesDialog;
