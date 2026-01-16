import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface PlexAuthDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (apiKey: string) => void;
  currentApiKey?: string;
}

const PlexAuthDialog: React.FC<PlexAuthDialogProps> = ({
  open,
  onClose,
  onSuccess,
  currentApiKey,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePlexAuth = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Request the server to generate a PIN and get the auth URL
      const res = await fetch('/plex/auth-url');
      if (!res.ok) {
        throw new Error('Failed to get Plex authentication URL');
      }
      const { authUrl, pinId } = await res.json();

      // Open the Plex auth page
      const authWindow = window.open(authUrl, '_blank');
      if (authWindow) {
        authWindow.focus();
      }

      let attempts = 0;
      const maxAttempts = 30; // 2.5 minutes total

      // Poll the server every 5 seconds to check if the PIN is claimed
      const intervalId = setInterval(async () => {
        try {
          const checkRes = await fetch(`/plex/check-pin/${pinId}`);
          const { authToken } = await checkRes.json();
          
          if (authToken) {
            clearInterval(intervalId);
            authWindow?.close();
            
            if (authToken === 'invalid') {
              setError('Invalid Plex Account. You must use the Plex account that has access to your Plex server.');
              setLoading(false);
            } else {
              // Success!
              setSuccess(true);
              setLoading(false);
              onSuccess(authToken);
              
              // Close dialog after a brief delay to show success
              setTimeout(() => {
                onClose();
              }, 1500);
            }
          } else {
            attempts++;
            if (attempts >= maxAttempts) {
              clearInterval(intervalId);
              setError('Authentication timeout. Please try again.');
              authWindow?.close();
              setLoading(false);
            }
          }
        } catch (err) {
          clearInterval(intervalId);
          setError('Failed to check authentication status. Please try again.');
          authWindow?.close();
          setLoading(false);
        }
      }, 5000);
    } catch (error: any) {
      setError(`Error: ${error.message}`);
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {success ? 'Success!' : 'Get Plex API Key'}
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Plex API Key obtained successfully!
            </Typography>
            <Typography variant="body1" sx={{ mt: 2 }}>
              Your API key has been added to the configuration.
            </Typography>
            <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
              <strong>Next step:</strong>
              <br />Click &quot;Test Connection&quot; to verify and auto-save your Plex credentials
            </Alert>
          </Box>
        ) : (
          <>
            <Typography variant="body1" paragraph>
              This will open a new window to authenticate with your Plex account and automatically 
              obtain an API key for your Plex server.
            </Typography>
            
            {currentApiKey && (
              <Alert severity="info" sx={{ mb: 2 }}>
                You already have a Plex API key configured. Getting a new one will replace the existing key.
              </Alert>
            )}
            
            <Typography variant="body2" color="text.secondary" paragraph>
              <strong>Important:</strong> You must use the same Plex account that has administrative 
              access to your Plex Media Server.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <CircularProgress size={20} sx={{ mr: 2 }} />
                <Typography variant="body2">
                  Waiting for Plex authentication... Please complete the login in the popup window.
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {!success && (
          <>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handlePlexAuth} 
              variant="contained" 
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Authenticate with Plex'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PlexAuthDialog;