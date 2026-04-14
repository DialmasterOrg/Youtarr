import React, { useState, useEffect } from "react";
import {
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Card,
  Dialog,
  DialogContent,
} from "./ui";
import { Close as CloseIcon } from "../lib/icons";
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogContent>
        <Card elevation={0} style={{ position: 'relative', width: isMobile ? '85vw' : undefined }}>  
          <button
            aria-label="close"
            onClick={handleClose}
            style={{
              position: 'absolute',
              right: 8,
              top: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--muted-foreground)',
            }}
          >
            <CloseIcon size={20} />
          </button>
          <h2>Select a Plex Library</h2>
          {plexError ? (
            <div style={{ color: 'var(--destructive)', marginBottom: 16 }}>
              <p>Unable to connect to Plex server. Please check:</p>
              <ul style={{ fontSize: 'small' }}>
                <li>Plex server is running</li>
                <li>Plex IP address is correct in configuration</li>
                <li>Plex API key is valid</li>
              </ul>
              <p>Note: Without connecting to Plex, downloading videos will still work, but you will not be able to refresh the library in Plex.</p>
            </div>
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
          {!plexError && (
          <>
              <div style={{ marginTop: '16px' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveSelection}
                  disabled={isSaveDisabled}
                >
                  Save Selection
                </Button>
              </div>
            </>
          )}
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export default PlexLibrarySelector;
