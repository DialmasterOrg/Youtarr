import React, { useState, useEffect } from "react";
import {
  SelectChangeEvent,
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
  const isMobile = useMediaQuery('(max-width: 599px)');

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
              <div style={{ marginTop: '16px' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveSelection}
                  disabled={selectedLibrary === ""}
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
