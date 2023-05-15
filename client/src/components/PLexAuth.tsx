import React, { useState } from 'react';
import { Button } from '@mui/material';

interface PlexAuthProps {
    clientId: string;
}

const PlexAuth: React.FC<PlexAuthProps> = ({ clientId }) => {
  const [token, setToken] = useState<string | null>(null);
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
          authWindow?.close();
        }
      }, 5000);
    } catch (error: any) {
      setError(`Error: ${error.message}`);
    }
  };

  return (
    <div>
      <Button variant="contained" onClick={handleAuthClick}>Get New Plex API KEY</Button>
      {token && <p>Authenticated successfully</p>}
      {error && <p>{error}</p>}
    </div>
  );
};

export default PlexAuth;
