import React, { useState, useEffect } from 'react';
import { InputLabel, Modal, Select, MenuItem, Button, Card, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface PlexLibrarySelectorProps {
  open: boolean;
  handleClose: () => void;
  setLibraryId: (id: string) => void;
  token: string | null;
}

interface PlexLibrary {
  id: string;
  title: string;
}

function PlexLibrarySelector({ open, handleClose, setLibraryId, token }: PlexLibrarySelectorProps) {
  const [libraries, setLibraries] = useState<PlexLibrary[]>([]);

  useEffect(() => {
    fetch(`/getplexlibraries`, {
      headers: {
        'x-access-token': token || ''
      }
    })
      .then(response => response.json())
      .then(data => setLibraries(data));
  }, [open]);

  return (
    <Modal open={open} onClose={handleClose} onBackdropClick={handleClose}>
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
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
            onChange={(event) => setLibraryId(event.target.value as string)}
            label='Select a Plex Library'
            labelId='select-plex-library'
          >
            {libraries.map((library) => (
              <MenuItem value={library.id} key={library.id}>
                {library.title}
              </MenuItem>
            ))}
          </Select>
        </Card>
      </Box>
    </Modal>
  );
}

export default PlexLibrarySelector;
