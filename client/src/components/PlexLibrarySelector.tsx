import React, { useState, useEffect } from 'react';
import { SelectChangeEvent, InputLabel, Modal, Select, MenuItem, Button, Card, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

interface PlexLibrarySelectorProps {
  open: boolean;
  handleClose: () => void;
  setLibraryId: (id: string, path: string) => void;
  token: string | null;
}

interface PlexLibrary {
  id: string;
  title: string;
  locations: {
    id: string;
    path: string;
  }[];
}

function PlexLibrarySelector({ open, handleClose, setLibraryId, token }: PlexLibrarySelectorProps) {
  const [libraries, setLibraries] = useState<PlexLibrary[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<string>('');
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [locations, setLocations] = useState<{ id: string; path: string; }[]>([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));


  useEffect(() => {
    fetch(`/getplexlibraries`, {
      headers: {
        'x-access-token': token || ''
      }
    })
      .then(response => response.json())
      .then(data => setLibraries(data));
  }, [open]);

  const handleLibraryChange = (event: SelectChangeEvent<string>) => {
    const libraryId = event.target.value as string;
    setSelectedLibrary(libraryId);

    const library = libraries.find(lib => lib.id === libraryId);
    if (library) {
      setLocations(library.locations);
    } else {
      setLocations([]);
    }
  };

  const handlePathChange = (event: SelectChangeEvent<string>) => {
    setSelectedPath(event.target.value);
  };

  const handleSaveSelection = () => {
    setLibraryId(selectedLibrary, formatPath(selectedPath));
  };

  function formatPath(path: string): string {
    return '/' + path.replace(/:\\/g, "/").replace(/^[a-z]:/i, (match) => match[0].toLowerCase());
  }

  return (
    <Modal open={open} onClose={handleClose} onBackdropClick={handleClose}>
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: isMobile ? '85vw' : 400,
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 4
      }}>
        <Card>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <CloseIcon />
          </IconButton>
          <h2>Select a Plex Library</h2>
          <InputLabel id="select-plex-library">Select a Plex Library</InputLabel>
          <Select
            fullWidth
            value={selectedLibrary}
            onChange={handleLibraryChange}
            label='Select a Plex Library'
            labelId='select-plex-library'
          >
            {libraries.map((library) => (
              <MenuItem value={library.id} key={library.id}>
                {library.title}
              </MenuItem>
            ))}
          </Select>
          <InputLabel id="select-plex-path">Select a Path</InputLabel>
          <Select
            fullWidth
            value={selectedPath}
            onChange={handlePathChange}
            label='Select a Path'
            labelId='select-plex-path'
          >
            {locations.length === 0 ?
              <MenuItem value="">
                No library selected
              </MenuItem>
              :
              locations.map((location) => (
                <MenuItem value={location.path} key={location.id}>
                  {location.path}
                </MenuItem>
              ))
            }
          </Select>
          <Box style={{ marginTop: '15px' }}>
            <Button variant="contained" color="primary"  onClick={handleSaveSelection} disabled={selectedLibrary === '' || selectedPath === ''}>
            Save Selection
          </Button>
          </Box>

        </Card>
      </Box>
    </Modal>
  );
}

export default PlexLibrarySelector;
