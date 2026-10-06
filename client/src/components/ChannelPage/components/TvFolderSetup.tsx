import React, { useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '../../ui';
import { LibraryLayout } from '../../../types/tvShows';

export const DEFAULT_TV_FOLDER_NAME = 'TV Shows';
export const EMPTY_FOLDER_NAME_MESSAGE = 'Enter a folder name.';
const SETUP_FAILED_MESSAGE = "Couldn't set up the TV folder.";

export interface TvFolderSetupProps {
  /** Registers the subfolder; rejects with the server's message */
  createSubfolder: (name: string) => Promise<void>;
  /** Sets a folder's layout; rejects with the server's message */
  setFolderLayout: (name: string, layout: LibraryLayout) => Promise<void>;
  /** Switches the channel into the new folder; rejects with the server's message */
  onSwitch: (layout: LibraryLayout, folder: string) => Promise<void>;
  disabled?: boolean;
}

/** Inline step that creates a TV folder and moves the channel into it. */
function TvFolderSetup({ createSubfolder, setFolderLayout, onSwitch, disabled = false }: TvFolderSetupProps) {
  const [name, setName] = useState(DEFAULT_TV_FOLDER_NAME);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedName = name.trim();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedName) {
      setError(EMPTY_FOLDER_NAME_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createSubfolder(trimmedName);
      await setFolderLayout(trimmedName, 'tv');
      await onSwitch('tv', trimmedName);
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : SETUP_FAILED_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-[var(--radius-ui)] border border-border p-3"
    >
      <Box className="flex flex-col gap-1">
        <Typography variant="body2" className="font-semibold">
          Set up a TV folder
        </Typography>
        <Typography variant="caption" color="text.secondary">
          TV shows are saved in a library folder of their own. Create one to switch this channel to it.
        </Typography>
      </Box>
      <TextField
        label="Folder name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        size="small"
        fullWidth
        disabled={busy || disabled}
        error={error === EMPTY_FOLDER_NAME_MESSAGE}
        helperText={trimmedName ? `Saved as __${trimmedName} in your downloads folder.` : undefined}
      />
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Box>
        <Button type="submit" variant="contained" size="small" loading={busy} disabled={disabled}>
          Create TV folder
        </Button>
      </Box>
    </Box>
  );
}

export default TvFolderSetup;
