import React, { useState } from 'react';
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
  const [setupToken, setSetupToken] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const isLoopbackHost = hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]';
  const showInsecureRemoteWarning =
    typeof window !== 'undefined' &&
    window.location.protocol !== 'https:' &&
    !isLoopbackHost;

  const passwordStrength = (pwd: string): string => {
    if (pwd.length < 8) return 'Too short';
    if (pwd.length < 12) return 'Fair';
    if (pwd.length < 16) return 'Good';
    return 'Strong';
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!setupToken.trim()) {
      setError('Setup token is required');
      return;
    }

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
        token: setupToken.trim(),
        username,
        password,
      });

      localStorage.setItem('authToken', response.data.token);
      onSetupComplete(response.data.token);
    } catch (err: unknown) {
      const message =
        (axios.isAxiosError(err) && err.response?.data?.error) ||
        'Setup failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={AUTH_VIEWPORT_STYLE}>
      <div style={AUTH_CONTAINER_STYLE}>
        <Paper elevation={0} style={AUTH_SURFACE_STYLE}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Typography variant="h3" component="h1" style={AUTH_TITLE_STYLE}>
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

          <Alert severity="info" style={{ marginBottom: 24, borderRadius: 'var(--radius-ui)' }}>
            <AlertTitle>Setup token required</AlertTitle>
            <Typography variant="body2">
              Find your one-time setup token in the container logs (<code>docker logs youtarr</code>)
              or in the <code>config/setup-token</code> file inside your Youtarr data volume.
            </Typography>
            <Typography variant="body2" style={{ marginTop: 8 }}>
              If you are running headless and cannot retrieve the token, set <code>AUTH_PRESET_USERNAME</code> and{' '}
              <code>AUTH_PRESET_PASSWORD</code> in your <code>.env</code> file, then restart Youtarr.
            </Typography>
          </Alert>

          {showInsecureRemoteWarning && (
            <Alert severity="warning" style={{ marginBottom: 24, borderRadius: 'var(--radius-ui)' }}>
              <AlertTitle>Trusted network only</AlertTitle>
              <Typography variant="body2">
                This page is using plain HTTP. Continue only from your private LAN, VPN, or SSH tunnel;
                use HTTPS before exposing Youtarr outside your network.
              </Typography>
            </Alert>
          )}

          <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <TextField
              fullWidth
              label="Setup Token"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              required
              helperText="Paste the 64-character token from your container logs or config/setup-token"
              inputProps={{ autoCapitalize: 'off', autoComplete: 'off' }}
            />

            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              helperText="Choose a username for login"
              inputProps={{ autoCapitalize: 'off' }}
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              helperText={`Password strength: ${password ? passwordStrength(password) : 'Enter password'}`}
            />

            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {error && (
              <Alert
                severity="error"
                style={{ borderRadius: 'var(--radius-ui)', border: '1px solid var(--destructive)' }}
              >
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              style={AUTH_PRIMARY_BUTTON_STYLE}
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </Button>

            {loading && <LinearProgress style={{ borderRadius: 'var(--radius-ui)' }} />}
          </form>

          <Typography
            variant="caption"
            color="text.secondary"
            style={AUTH_FOOTER_STYLE}
          >
            After setup, you can access Youtarr normally.
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
