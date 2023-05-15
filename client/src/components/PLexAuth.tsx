import React, { useState } from 'react';
import { Button } from '@mui/material';

interface PlexAuthProps {
    clientId: string;
}

const PlexAuth: React.FC<PlexAuthProps> = ({ clientId }) => {
  const [authStatus, setAuthStatus] = useState('');

// TODO: Note, that the code below DOES NOT WORK
// I should use the documentation at https://forums.plex.tv/t/authenticating-with-plex/609370

  const handleAuth = async () => {
    console.log('Clicky!!!');
    try {
      // Open a new window for the Plex login page
      const authWindow = window.open(
        `https://app.plex.tv/auth#?clientID=${clientId}&context[device][product]=YouTubePlexArr`,
        '_blank',
        "width=600,height=600"
      );

      // Poll the Plex API until we get a token
      const intervalId = setInterval(async () => {
        try {
            // If the pop-up window has been closed, stop checking
            if (!authWindow || authWindow.closed) {
              clearInterval(intervalId);
            }
            // If the pop-up window's URL includes the Plex token, extract it
            else if (authWindow.location.href.includes("code=")) {
              const url = new URL(authWindow.location.href);
              const token = url.searchParams.get("code");
              alert(`Authenticated successfully. Plex token: ${token}`);
              authWindow.close();
              clearInterval(intervalId);
            }
          } catch (error) {
            console.error(error);
          }

      }, 1000);
    } catch (error) {
        if (error instanceof Error) {
            setAuthStatus(`Authentication failed: ${error.message}`);
        } else {
            setAuthStatus(`Authentication failed: ${String(error)}`);
        }    
    }
  };

  return (
    <div>
      <Button onClick={handleAuth}>Auth to Plex</Button>
      {authStatus && <p>{authStatus}</p>}
    </div>
  );
};

export default PlexAuth;
