import React, { useState, useEffect } from "react";
import {
  SelectChangeEvent,
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

interface PlexLibrarySelectorProps {
  open: boolean;
  handleClose: () => void;
  setLibraryId: (selection: {
    libraryId: string;
    libraryTitle: string;
  }) => void;
  token: string | null;
}

interface PlexLibrary {
  id: string;
  title: string;
}

function PlexLibrarySelector({
  open,
  handleClose,
  setLibraryId,
  token,
}: PlexLibrarySelectorProps) {
  const [libraries, setLibraries] = useState<PlexLibrary[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<string>("");
  const [plexError, setPlexError] = useState<boolean>(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    if (!open) return;

    setPlexError(false);
    fetch(`/getplexlibraries`, {
      headers: {
        "x-access-token": token || "",
      },
    })
      .then((response) => {
        if (!response.ok) {
          console.error("Failed to fetch Plex libraries");
          setLibraries([]);
          setPlexError(true);
          return [];
        }
        return response.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setLibraries(data);
          setPlexError(false);
        } else {
          setLibraries([]);
          setPlexError(true);
        }
      })
      .catch((error) => {
        console.error("Error fetching Plex libraries:", error);
        setLibraries([]);
        setPlexError(true);
      });
  }, [open, token]);

  useEffect(() => {
    if (!open) {
      setSelectedLibrary("");
    }
  }, [open]);

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
            <>
              <InputLabel id="select-plex-library">
                Select a Plex Library
              </InputLabel>
              <Select
                fullWidth
                value={selectedLibrary}
                onChange={handleLibraryChange}
                label="Select a Plex Library"
                labelId="select-plex-library"
              >
                {libraries.length === 0 ? (
                  <MenuItem value="" disabled>
                    No libraries available
                  </MenuItem>
                ) : (
                  libraries.map((library) => (
                    <MenuItem value={library.id} key={library.id}>
                      {library.title}
                    </MenuItem>
                  ))
                )}
              </Select>
            </>
          )}
          {!plexError && (
            <>
              <Box style={{ marginTop: "16px" }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveSelection}
                  disabled={selectedLibrary === ""}
                >
                  Save Selection
                </Button>
              </Box>
            </>
          )}
        </Card>
      </Box>
    </Modal>
  );
}

export default PlexLibrarySelector;
