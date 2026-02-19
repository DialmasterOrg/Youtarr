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
  AlertTitle,
} from '@mui/material';
import axios from 'axios';
import { useThemeEngine } from '../contexts/ThemeEngineContext';
import packageJson from '../../package.json';

interface InitialSetupProps {
  onSetupComplete: (token: string) => void;
}

const InitialSetup: React.FC<InitialSetupProps> = ({ onSetupComplete }) => {
  const { themeMode } = useThemeEngine();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLocalhost, setIsLocalhost] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const isPlayful = themeMode === 'playful';
  const isNeumorphic = themeMode === 'neumorphic';
  const isLinear = themeMode === 'linear';

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

  const bgStyle = {
    position: 'fixed' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: isLinear
      ? 'linear-gradient(135deg, #09090b 0%, #1a1a1f 100%)'
      : isNeumorphic
        ? '#E0E5EC'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  };

  if (isLocalhost === false) {
    return (
      <Box sx={bgStyle}>
        <Container maxWidth="sm">
          <Paper
            elevation={isLinear ? 0 : isNeumorphic ? 0 : 8}
            sx={{
              p: 4,
              borderRadius: 'var(--radius-ui)',
              bgcolor: isLinear ? 'rgba(18, 18, 20, 0.95)' : isNeumorphic ? '#E0E5EC' : 'background.paper',
              border: isLinear ? '1px solid rgba(255, 255, 255, 0.1)' : isPlayful ? '4px solid var(--border-strong)' : 'none',
            }}
          >
            <Typography variant="h5" color="error" gutterBottom>
              🔒 Security Protection Active
            </Typography>
            <Typography variant="body1" paragraph>
              Initial password setup must be performed from the server itself.
            </Typography>
            <Alert severity="info">
              http://localhost:3087
            </Alert>
            <Typography variant="body2" sx={{ mt: 2 }}>
              This security measure prevents unauthorized users from claiming your Youtarr instance.
            </Typography>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={bgStyle}>
      <Container maxWidth="sm">
        <Paper
          elevation={isLinear ? 0 : isNeumorphic ? 0 : 8}
          sx={{
            p: isPlayful ? 5 : 4,
            borderRadius: 'var(--radius-ui)',
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
          {/* Branding */}
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
              }}
            >
              Youtarr
            </Typography>
            <Typography
              variant="subtitle1"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
              }}
            >
              First-time Setup
            </Typography>
          </Box>

          {/* Info alert */}
          <Alert severity="info" sx={{ mb: 3, borderRadius: 'var(--radius-ui)' }}>
            <AlertTitle>Create your admin account</AlertTitle>
            <Typography variant="body2">
              Set your login credentials to secure your Youtarr instance. Access via localhost is required for this step.
            </Typography>
          </Alert>

          {/* Form */}
          <Box component="form" onSubmit={handleSetup}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              helperText="Choose a username for login"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 'var(--radius-input)' } }}
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
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 'var(--radius-input)' } }}
            />

            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              margin="normal"
              required
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 'var(--radius-input)' } }}
            />

            {error && (
              <Alert
                severity="error"
                sx={{ mt: 2, borderRadius: 'var(--radius-ui)', border: '1px solid', borderColor: 'error.main' }}
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
              sx={{
                mt: 3,
                py: 1.5,
                fontWeight: 700,
                fontSize: '1.1rem',
                borderRadius: 'var(--radius-ui)',
                textTransform: isLinear ? 'uppercase' : 'none',
                letterSpacing: isLinear ? '0.1em' : 'normal',
              }}
            >
              {loading ? 'Setting up...' : 'Create Account'}
            </Button>

            {loading && <LinearProgress sx={{ mt: 2, borderRadius: 'var(--radius-ui)' }} />}
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
            Youtarr v{packageJson.version}
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default InitialSetup;