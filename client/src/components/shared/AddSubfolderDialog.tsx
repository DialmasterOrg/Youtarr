import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';

const MAX_SUBFOLDER_LENGTH = 100;
const VALID_NAME_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

interface AddSubfolderDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (subfolderName: string) => void;
  existingSubfolders: string[];
}

/**
 * Dialog for adding a new subfolder name.
 * Validates input and returns the cleaned subfolder name.
 */
export function AddSubfolderDialog({
  open,
  onClose,
  onAdd,
  existingSubfolders,
}: AddSubfolderDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setInputValue('');
      setValidationError(null);
    }
  }, [open]);

  // Validate input and return cleaned value
  const validateInput = useCallback(
    (value: string): { isValid: boolean; cleanedValue: string; error: string | null } => {
      const cleaned = value.trim();

      // Check empty
      if (!cleaned) {
        return { isValid: false, cleanedValue: '', error: 'Subfolder name cannot be empty' };
      }

      // Reserved prefix
      if (cleaned.startsWith('__')) {
        return {
          isValid: false,
          cleanedValue: cleaned,
          error: 'Subfolder names cannot start with __ (reserved prefix)',
        };
      }

      // Check length
      if (cleaned.length > MAX_SUBFOLDER_LENGTH) {
        return {
          isValid: false,
          cleanedValue: cleaned,
          error: `Name cannot exceed ${MAX_SUBFOLDER_LENGTH} characters`,
        };
      }

      // Check invalid characters (must match server rule)
      if (!VALID_NAME_REGEX.test(cleaned)) {
        return {
          isValid: false,
          cleanedValue: cleaned,
          error: 'Subfolder name can only contain letters, numbers, spaces, hyphens, and underscores',
        };
      }

      // Path traversal safety
      if (cleaned.includes('..') || cleaned.includes('/') || cleaned.includes('\\')) {
        return {
          isValid: false,
          cleanedValue: cleaned,
          error: 'Invalid subfolder name',
        };
      }

      // Check duplicates (case-insensitive)
      const lowerCleaned = cleaned.toLowerCase();
      const isDuplicate = existingSubfolders.some((folder) => {
        const existingClean = folder.replace(/^__/, '').trim().toLowerCase();
        return existingClean === lowerCleaned;
      });

      if (isDuplicate) {
        return {
          isValid: false,
          cleanedValue: cleaned,
          error: 'A subfolder with this name already exists',
        };
      }

      return { isValid: true, cleanedValue: cleaned, error: null };
    },
    [existingSubfolders]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);

    // Validate on change
    const { error } = validateInput(newValue);
    setValidationError(error);
  };

  const handleAdd = () => {
    const { isValid, cleanedValue } = validateInput(inputValue);
    if (isValid) {
      onAdd(cleanedValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      const { isValid } = validateInput(inputValue);
      if (isValid) {
        handleAdd();
      }
    }
  };

  const { isValid } = validateInput(inputValue);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Subfolder</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Subfolder Name"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          error={!!validationError}
          helperText={
            validationError || 'Enter a name for the new subfolder (e.g., Sports, Music)'
          }
          InputLabelProps={{ shrink: true }}
          inputProps={{
            maxLength: MAX_SUBFOLDER_LENGTH,
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd} variant="contained" disabled={!isValid}>
          Add Subfolder
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddSubfolderDialog;
