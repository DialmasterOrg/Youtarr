import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Typography,
  Alert,
  AlertTitle,
  Paper,
  LinearProgress,
} from './ui';
import axios from 'axios';
import packageJson from '../../package.json';
import {
  AUTH_CONTAINER_STYLE,
  AUTH_FOOTER_STYLE,
  AUTH_PRIMARY_BUTTON_STYLE,
  AUTH_SUBTITLE_STYLE,
  AUTH_SURFACE_STYLE,
  AUTH_TITLE_STYLE,
  AUTH_VIEWPORT_STYLE,
} from './authSurfaceStyles';

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
    axios.get('/setup/status')
      .then(response => {
        setIsLocalhost(response.data.isLocalhost);
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
      <div style={AUTH_VIEWPORT_STYLE}>
        <div style={AUTH_CONTAINER_STYLE}>
          <Paper elevation={0} style={AUTH_SURFACE_STYLE}>
            <Typography variant="h5" color="error" gutterBottom>
              🔒 Security Protection Active
            </Typography>
            <Typography variant="body1" paragraph>
              Initial password setup must be performed from the server itself.
            </Typography>
            <Alert severity="info">
              http://localhost:3087
            </Alert>
            <Typography variant="body2" style={{ marginTop: 16 }}>
              This security measure prevents unauthorized users from claiming your Youtarr instance.
            </Typography>
          </Paper>
        </div>
      </div>
    );
  }

  return (
    <div style={AUTH_VIEWPORT_STYLE}>
      <div style={AUTH_CONTAINER_STYLE}>
        <Paper elevation={0} style={AUTH_SURFACE_STYLE}>
          {/* Branding */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Typography
              variant="h3"
              component="h1"
              style={AUTH_TITLE_STYLE}
            >
              Welcome to Youtarr Setup
            </Typography>
            <Typography
              variant="subtitle1"
              color="text.secondary"
              style={AUTH_SUBTITLE_STYLE}
            >
              First-time Setup
            </Typography>
          </div>

          {/* Info alert */}
          <Alert severity="info" style={{ marginBottom: 24, borderRadius: 'var(--radius-ui)' }}>
            <AlertTitle>Important</AlertTitle>
            <Typography variant="body2">
              Youtarr uses local authentication by default. Initial setup requires access via localhost.
            </Typography>
          </Alert>

          {/* Form */}
          <form onSubmit={handleSetup}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              helperText="Choose a username for login"
              inputProps={{ autoCapitalize: 'off' }}
              style={{ marginBottom: '16px' }}
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
              style={{ marginBottom: '16px' }}
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
              <Alert
                severity="error"
                style={{ marginTop: 16, borderRadius: 'var(--radius-ui)', border: '1px solid var(--destructive)' }}
              >
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading || isLocalhost === null}
              style={AUTH_PRIMARY_BUTTON_STYLE}
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </Button>

            {loading && <LinearProgress style={{ marginTop: 16, borderRadius: 'var(--radius-ui)' }} />}
          </form>

          {/* Footer */}
          <Typography
            variant="caption"
            color="text.secondary"
            style={AUTH_FOOTER_STYLE}
          >
            After setup, you can access Youtarr from anywhere.
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            style={{ ...AUTH_FOOTER_STYLE, marginTop: 4 }}
          >
            Youtarr v{packageJson.version}
          </Typography>
        </Paper>
      </div>
    </div>
  );
};

export default InitialSetup;