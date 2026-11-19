import React, { useState, useEffect, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { LIBRARY_FOLDERS_PATH } from '../../utils/libraryLayouts';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '../ui';

const MAX_SUBFOLDER_LENGTH = 100;
const VALID_NAME_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

interface AddSubfolderDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (subfolderName: string) => void;
  existingSubfolders: string[];
}

/**
 * Dialog for adding a new library folder name.
 * Validates input and returns the cleaned library folder name.
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
        return { isValid: false, cleanedValue: '', error: 'Library folder name cannot be empty' };
      }

      // Reserved prefix
      if (cleaned.startsWith('__')) {
        return {
          isValid: false,
          cleanedValue: cleaned,
          error: 'Library folder names cannot start with __ (reserved prefix)',
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
          error: 'Library folder name can only contain letters, numbers, spaces, hyphens, and underscores',
        };
      }

      // Path traversal safety
      if (cleaned.includes('..') || cleaned.includes('/') || cleaned.includes('\\')) {
        return {
          isValid: false,
          cleanedValue: cleaned,
          error: 'Invalid library folder name',
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
          error: 'A library folder with this name already exists',
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
      <DialogTitle>Add library folder</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Library folder name"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          error={!!validationError}
          helperText={
            validationError || 'Enter a name for the new library folder (e.g., Sports, Music)'
          }
          InputLabelProps={{ shrink: true }}
          inputProps={{
            maxLength: MAX_SUBFOLDER_LENGTH,
          }}
          style={{ marginTop: 8 }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Creates a Videos folder. To make a TV show folder, use{' '}
          <RouterLink
            to={LIBRARY_FOLDERS_PATH}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline max-md:inline-flex max-md:min-h-[44px] max-md:items-center"
          >
            Settings &gt; Library folders
            <span className="sr-only"> (opens in a new tab)</span>
          </RouterLink>
          .
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleAdd} variant="contained" disabled={!isValid}>
          Add library folder
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddSubfolderDialog;
