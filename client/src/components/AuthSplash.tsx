import React, { useState } from 'react';
import {
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
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

interface AuthSplashProps {
  setToken: (token: string) => void;
}

export const AuthSplash: React.FC<AuthSplashProps> = ({ setToken }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await axios.post('/auth/login', {
        username,
        password,
      });

      const { token } = response.data;
      localStorage.setItem('authToken', token);
      setToken(token);
      window.location.href = '/channels';
    } catch (err: any) {
      if (err.response?.data?.requiresSetup) {
        window.location.href = '/setup';
      } else if (err.response?.status === 429) {
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            'Too many login attempts. Please try again later.'
        );
      } else if (err.response?.status === 401) {
        setError('Invalid username or password');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={AUTH_VIEWPORT_STYLE}>
      <div style={AUTH_CONTAINER_STYLE}>
        <Paper elevation={0} style={AUTH_SURFACE_STYLE}>
          {/* Logo/Branding */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Typography
              variant="h3"
              component="h1"
              style={AUTH_TITLE_STYLE}
            >
              Youtarr
            </Typography>
            <Typography
              variant="subtitle1"
              style={AUTH_SUBTITLE_STYLE}
              color="text.secondary"
            >
              Login below
            </Typography>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              autoFocus
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
            />

            {error && (
              <Alert
                severity="error"
                style={{
                  marginTop: 16,
                  borderRadius: 'var(--radius-ui)',
                  border: '1px solid var(--destructive)',
                }}
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
              {loading ? 'Signing in...' : 'Login'}
            </Button>

            {loading && (
              <LinearProgress
                style={{
                  marginTop: 16,
                  borderRadius: 'var(--radius-ui)',
                }}
              />
            )}
          </form>

          {/* Footer */}
          <Typography
            variant="caption"
            style={AUTH_FOOTER_STYLE}
            color="text.secondary"
          >
            Youtarr v{packageJson.version}
          </Typography>
        </Paper>
      </div>
    </div>
  );
};
