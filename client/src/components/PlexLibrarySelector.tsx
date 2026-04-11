import React, { useState, useEffect } from "react";
import {
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Modal,
  Select,
  MenuItem,
  Button,
  Card,
  Box,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
    <Modal open={open} onClose={handleClose} onBackdropClick={handleClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isMobile ? "85vw" : 400,
          bgcolor: "background.paper",
          boxShadow: 24,
          p: 4,
        }}
      >
        <Card elevation={0}>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
          <h2>Select a Plex Library</h2>
          {plexError ? (
            <Box sx={{ color: 'error.main', mb: 2 }}>
              <p>Unable to connect to Plex server. Please check:</p>
              <ul style={{ fontSize: 'small' }}>
                <li>Plex server is running</li>
                <li>Plex IP address is correct in configuration</li>
                <li>Plex API key is valid</li>
              </ul>
              <p>Note: Without connecting to Plex, downloading videos will still work, but you will not be able to refresh the library in Plex.</p>
            </Box>
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
            <Box sx={{ mt: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveSelection}
                disabled={isSaveDisabled}
              >
                Save Selection
              </Button>
            </Box>
          )}
        </Card>
      </Box>
    </Modal>
  );
}

export default PlexLibrarySelector;
