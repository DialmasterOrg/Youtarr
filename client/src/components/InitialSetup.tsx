import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  Container,
  LinearProgress,
  AlertTitle
} from '@mui/material';
import axios from 'axios';

interface InitialSetupProps {
  onSetupComplete: (token: string) => void;
}

const InitialSetup: React.FC<InitialSetupProps> = ({ onSetupComplete }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLocalhost, setIsLocalhost] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if we're on localhost
    axios.get('/setup/status')
      .then(response => {
        setIsLocalhost(response.data.isLocalhost);
        // Don't redirect if setup is not required - let the user complete setup
        // or navigate away on their own
      })
      .catch(err => {
        console.error('Setup status check failed:', err);
      });
  }, []);

  const passwordStrength = (pwd: string): string => {
    if (pwd.length < 8) return 'Too short';
    if (pwd.length < 12) return 'Fair';
    if (pwd.length < 16) return 'Good';
    return 'Strong';
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/setup/create-auth', {
        username,
        password
      });

      localStorage.setItem('authToken', response.data.token);
      onSetupComplete(response.data.token);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  if (isLocalhost === false) {
    return (
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
          <Typography variant="h5" color="error" gutterBottom>
            🔒 Security Protection Active
          </Typography>
          <Typography variant="body1" paragraph>
            Initial password setup must be performed from the server itself.
          </Typography>
          <Typography variant="body2" paragraph>
            Please access Youtarr directly from the server machine at:
          </Typography>
          <Alert severity="info">
            http://localhost:3087
          </Alert>
          <Typography variant="body2" sx={{ mt: 2 }}>
            This security measure prevents unauthorized users from claiming your Youtarr instance.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Typography variant="h4" gutterBottom>
          Welcome to Youtarr Setup
        </Typography>

        <Alert severity="info" sx={{ mb: 3 }}>
          <AlertTitle>Important</AlertTitle>
          <Typography variant="body2" paragraph>
            Youtarr uses local authentication by default. Plex is optional.
          </Typography>
          <Typography variant="body2">
            Initial setup requires access via localhost<br />
            If you do not have access to the app via localhost, you should stop the application<br />
            and set AUTH_PRESET_USERNAME and AUTH_PRESET_PASSWORD environment variables instead,<br />
            then restart the application.
          </Typography>
        </Alert>

        <Box component="form" onSubmit={handleSetup}>
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
            helperText="Choose a username for login"
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            helperText={`Password strength: ${password ? passwordStrength(password) : 'Enter password'}`}
          />

          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            margin="normal"
            required
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3 }}
            disabled={loading || isLocalhost === null}
          >
            {loading ? 'Setting up...' : 'Complete Setup'}
          </Button>

          {loading && <LinearProgress sx={{ mt: 2 }} />}
        </Box>

        <Typography variant="caption" sx={{ mt: 3, display: 'block', textAlign: 'center' }}>
          After setup, you can access Youtarr from anywhere with these credentials.
        </Typography>
      </Paper>
    </Container>
  );
};

export default InitialSetup;