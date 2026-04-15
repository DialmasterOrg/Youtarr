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
import { useThemeEngine } from '../contexts/ThemeEngineContext';
import youtarrWordmark from '../Youtarr_text.png';

const getAxiosErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return 'Login failed. Please try again.';
  }

  if (error.response?.data?.requiresSetup) {
    window.location.href = '/setup';
    return null;
  }

  if (error.response?.status === 429) {
    return error.response?.data?.error
      || error.response?.data?.message
      || 'Too many login attempts. Please try again later.';
  }

  if (error.response?.status === 401) {
    return 'Invalid username or password';
  }

  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  return 'Login failed. Please try again.';
};

interface AuthSplashProps {
  setToken: (token: string) => void;
}

export const AuthSplash: React.FC<AuthSplashProps> = ({ setToken }) => {
  const { showHeaderLogo, showHeaderWordmark } = useThemeEngine();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const showPlainTitle = !showHeaderWordmark;

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
    } catch (err: unknown) {
      const nextError = getAxiosErrorMessage(err);
      if (nextError) {
        setError(nextError);
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
            <div
              style={AUTH_TITLE_STYLE}
              aria-label="Youtarr brand"
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: showHeaderLogo ? 12 : 0,
                  flexWrap: 'wrap',
                  minHeight: 'var(--auth-title-font-size)',
                }}
              >
                {showHeaderLogo && (
                  <img
                    src="/logo192.png"
                    alt="Youtarr logo"
                    style={{
                      width: 52,
                      height: 52,
                      objectFit: 'contain',
                      flexShrink: 0,
                    }}
                  />
                )}
                {showHeaderWordmark ? (
                  <img
                    src={youtarrWordmark}
                    alt="Youtarr"
                    style={{
                      height: 'calc(var(--auth-title-font-size) + 0.15rem)',
                      maxWidth: 'min(100%, 260px)',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                ) : showPlainTitle ? (
                  <Typography variant="h3" component="h1" style={AUTH_TITLE_STYLE}>
                    Youtarr
                  </Typography>
                ) : null}
              </div>
            </div>
            <Typography
              variant="subtitle1"
              style={AUTH_SUBTITLE_STYLE}
              color="text.secondary"
            >
              Login below
            </Typography>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} style={{ ['--field-label-background' as string]: 'var(--auth-surface-background)' }}>
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
