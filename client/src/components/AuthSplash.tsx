import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  LinearProgress,
} from '@mui/material';
import { useThemeEngine } from '../contexts/ThemeEngineContext';
import axios from 'axios';

interface AuthSplashProps {
  setToken: (token: string) => void;
}

export const AuthSplash: React.FC<AuthSplashProps> = ({ setToken }) => {
  const { themeMode } = useThemeEngine();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPlayful = themeMode === 'playful';
  const isNeumorphic = themeMode === 'neumorphic';
  const isLinear = themeMode === 'linear';

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
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isLinear
          ? 'linear-gradient(135deg, #09090b 0%, #1a1a1f 100%)'
          : isNeumorphic
            ? '#E0E5EC'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={isLinear ? 0 : isNeumorphic ? 0 : 8}
          sx={{
            p: isPlayful ? 5 : 4,
            borderRadius: isPlayful
              ? 'var(--radius-ui)'
              : isLinear
                ? 'var(--radius-ui)'
                : 'var(--radius-ui)',
            border: isPlayful
              ? '4px solid var(--border-strong)'
              : isLinear
                ? '1px solid rgba(255, 255, 255, 0.1)'
                : 'none',
            boxShadow: isLinear
              ? '0 8px 32px rgba(0, 0, 0, 0.5)'
              : isNeumorphic
                ? '20px 20px 40px rgba(163, 177, 198, 0.6), -20px -20px 40px rgba(255, 255, 255, 0.6)'
                : '0 20px 60px rgba(0, 0, 0, 0.3)',
            bgcolor: isLinear
              ? 'rgba(18, 18, 20, 0.95)'
              : isNeumorphic
                ? '#E0E5EC'
                : 'background.paper',
            backdropFilter: isLinear ? 'blur(20px)' : 'none',
            transform: isPlayful ? 'rotate(-0.5deg)' : 'none',
          }}
        >
          {/* Logo/Branding */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography
              variant="h3"
              component="h1"
              sx={{
                fontFamily: 'var(--font-display)',
                fontWeight: isPlayful ? 800 : 700,
                fontSize: isPlayful ? '3rem' : '2.5rem',
                mb: 1,
                color: 'text.primary',
                letterSpacing: isLinear ? '0.02em' : 'normal',
                textShadow: isNeumorphic
                  ? '2px 2px 4px rgba(163, 177, 198, 0.4), -2px -2px 4px rgba(255, 255, 255, 0.4)'
                  : isLinear
                    ? '0 2px 10px rgba(102, 126, 234, 0.5)'
                    : 'none',
              }}
            >
              Youtarr
            </Typography>
            <Typography
              variant="subtitle1"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                fontSize: isLinear ? '0.9rem' : '1rem',
                fontFamily: 'var(--font-body)',
              }}
            >
              {isLinear
                ? '> Authentication Required'
                : isNeumorphic
                  ? 'Sign in to continue'
                  : 'Welcome back'}
            </Typography>
          </Box>

          {/* Login Form */}
          <Box component="form" onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 'var(--radius-input)',
                },
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 'var(--radius-input)',
                },
              }}
            />

            {error && (
              <Alert
                severity="error"
                sx={{
                  mt: 2,
                  borderRadius: 'var(--radius-ui)',
                  border: '1px solid',
                  borderColor: 'error.main',
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
              sx={{
                mt: 3,
                py: 1.5,
                fontWeight: 700,
                fontSize: '1.1rem',
                borderRadius: 'var(--radius-ui)',
                textTransform: isLinear ? 'uppercase' : 'none',
                letterSpacing: isLinear ? '0.1em' : 'normal',
                boxShadow: isNeumorphic
                  ? '10px 10px 20px rgba(163, 177, 198, 0.6), -10px -10px 20px rgba(255, 255, 255, 0.6)'
                  : undefined,
                '&:hover': {
                  transform: isPlayful ? 'scale(1.02)' : 'none',
                  boxShadow: isNeumorphic
                    ? '5px 5px 10px rgba(163, 177, 198, 0.6), -5px -5px 10px rgba(255, 255, 255, 0.6)'
                    : undefined,
                },
              }}
            >
              {loading ? 'Signing in...' : isLinear ? 'Execute' : 'Sign In'}
            </Button>

            {loading && (
              <LinearProgress
                sx={{
                  mt: 2,
                  borderRadius: 'var(--radius-ui)',
                }}
              />
            )}
          </Box>

          {/* Footer */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              mt: 3,
              color: 'text.secondary',
              fontFamily: 'var(--font-body)',
            }}
          >
            {isLinear ? '© Youtarr v1.0' : 'Powered by Youtarr'}
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};
