import React, { useState } from 'react';
import { Button } from '@mui/material';

interface PlexAuthProps {
    setToken: React.Dispatch<React.SetStateAction<string | null>>;
}

const PlexAuth: React.FC<PlexAuthProps> = ({ setToken }) => {
  //const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAuthClick = async () => {
    try {
      // Request the server to generate a PIN and get the auth URL
      const res = await fetch('/plex/auth-url');
      const { authUrl, pinId } = await res.json();

      // Open the Plex auth page
      const authWindow = window.open(authUrl, '_blank');
      if (authWindow) {
        authWindow.focus();
      }

      // Poll the server every 5 seconds to check if the PIN is claimed
      const intervalId = setInterval(async () => {
        const res = await fetch(`/plex/check-pin/${pinId}`);
        const { authToken } = await res.json();
        if (authToken) {
          clearInterval(intervalId);
          setToken(authToken);
          localStorage.setItem('plexAuthToken', authToken);
          authWindow?.close();
          window.location.href = '/configuration';
        }
      }, 5000);
    } catch (error: any) {
      setError(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <Button variant="contained" onClick={handleAuthClick}>Login Via Plex</Button>
      {error && <p>{error}</p>}
    </div>
  );
};

export default PlexAuth;
