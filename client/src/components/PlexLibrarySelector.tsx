import React, { useState, useEffect } from "react";
import {
  SelectChangeEvent,
  Alert,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Dialog,
  DialogActions,
  DialogContentBody,
  DialogTitle,
  Typography,
} from "./ui";
import useMediaQuery from "../hooks/useMediaQuery";
import { PlexLibrary } from "../utils/plexLibraries";

interface PlexLibrarySelectorProps {
  open: boolean;
  handleClose: () => void;
  setLibraryId: (selection: {
    libraryId: string;
    libraryTitle: string;
  }) => void;
  libraries: PlexLibrary[];
  currentLibraryId?: string;
}

function PlexLibrarySelector({
  open,
  handleClose,
  setLibraryId,
  libraries,
  currentLibraryId,
}: PlexLibrarySelectorProps) {
  const [selectedLibrary, setSelectedLibrary] = useState<string>("");
  const isMobile = useMediaQuery('(max-width: 599px)');

  const plexError = libraries.length === 0;

  // Reset selection when the modal closes so the next open starts clean.
  useEffect(() => {
    if (!open) {
      setSelectedLibrary("");
    }
  }, [open]);

  // Pre-select the currently configured library once libraries are available.
  // The `prev || currentLibraryId` guard ensures we do not clobber a user's
  // manual pick if this effect re-fires (e.g. libraries reference changes)
  // while the modal is still open.
  useEffect(() => {
    if (!open || !currentLibraryId) return;
    if (libraries.some((lib) => lib.id === currentLibraryId)) {
      setSelectedLibrary((prev) => prev || currentLibraryId);
    }
  }, [open, currentLibraryId, libraries]);

  const handleLibraryChange = (event: SelectChangeEvent<string>) => {
    const libraryId = event.target.value as string;
    setSelectedLibrary(libraryId);
  };

  const handleSaveSelection = () => {
    const library = libraries.find((lib) => lib.id === selectedLibrary);
    setLibraryId({
      libraryId: selectedLibrary,
      libraryTitle: library?.title || '',
    });
    setSelectedLibrary("");
  };

  const isSaveDisabled =
    selectedLibrary === "" || selectedLibrary === currentLibraryId;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      className={isMobile ? 'w-[85vw]' : undefined}
    >
      <DialogTitle onClose={handleClose}>Select a Plex Library</DialogTitle>
      <DialogContentBody>
        {plexError ? (
          <Alert severity="warning">
            <Box>
              <Typography variant="body2" className="mb-2">
                Unable to connect to Plex server. Please check:
              </Typography>
              <ul className="list-disc pl-5 text-sm">
                <li>Plex server is running</li>
                <li>Plex IP address is correct in configuration</li>
                <li>Plex API key is valid</li>
              </ul>
              <Typography variant="body2" className="mt-3">
                Without connecting to Plex, downloading videos will still work, but you will not be able to refresh the library in Plex.
              </Typography>
            </Box>
          </Alert>
        ) : (
          <FormControl fullWidth>
            <InputLabel id="select-plex-library">Plex Library</InputLabel>
            <Select
              value={selectedLibrary}
              onChange={handleLibraryChange}
              label="Plex Library"
              labelId="select-plex-library"
            >
              {libraries.map((library) => (
                <MenuItem value={library.id} key={library.id}>
                  {library.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContentBody>
      {!plexError && (
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSaveSelection}
            disabled={isSaveDisabled}
          >
            Save Selection
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

export default PlexLibrarySelector;
