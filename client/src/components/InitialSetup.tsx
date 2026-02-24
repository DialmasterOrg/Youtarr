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
      <div style={bgStyle}>
        <div style={{ width: '100%', maxWidth: 600, padding: '0 16px', boxSizing: 'border-box' }}>
          <Paper
            elevation={isLinear ? 0 : isNeumorphic ? 0 : 8}
            style={{
              padding: 32,
              borderRadius: 'var(--radius-ui)',
              backgroundColor: isLinear ? 'rgba(18, 18, 20, 0.95)' : isNeumorphic ? '#E0E5EC' : 'var(--card)',
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
            <Typography variant="body2" style={{ marginTop: 16 }}>
              This security measure prevents unauthorized users from claiming your Youtarr instance.
            </Typography>
          </Paper>
        </div>
      </div>
    );
  }

  return (
    <div style={bgStyle}>
      <div style={{ width: '100%', maxWidth: 600, padding: '0 16px', boxSizing: 'border-box' }}>
        <Paper
          elevation={isLinear ? 0 : isNeumorphic ? 0 : 8}
          style={{
            padding: isPlayful ? 40 : 32,
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
            backgroundColor: isLinear
              ? 'rgba(18, 18, 20, 0.95)'
              : isNeumorphic
                ? '#E0E5EC'
                : 'var(--card)',
            backdropFilter: isLinear ? 'blur(20px)' : 'none',
            transform: isPlayful ? 'rotate(-0.5deg)' : 'none',
          }}
        >
          {/* Branding */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Typography
              variant="h3"
              component="h1"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: isPlayful ? 800 : 700,
                fontSize: isPlayful ? '3rem' : '2.5rem',
                marginBottom: 8,
              }}
            >
              Welcome to Youtarr Setup
            </Typography>
            <Typography
              variant="subtitle1"
              color="text.secondary"
              style={{
                fontWeight: 500,
                fontFamily: 'var(--font-body)',
              }}
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
              style={{
                marginTop: 24,
                paddingTop: 12,
                paddingBottom: 12,
                fontWeight: 700,
                fontSize: '1.1rem',
                borderRadius: 'var(--radius-ui)',
                textTransform: isLinear ? 'uppercase' : 'none',
                letterSpacing: isLinear ? '0.1em' : 'normal',
              }}
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
            </Button>

            {loading && <LinearProgress style={{ marginTop: 16, borderRadius: 'var(--radius-ui)' }} />}
          </form>

          {/* Footer */}
          <Typography
            variant="caption"
            color="text.secondary"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 24,
              fontFamily: 'var(--font-body)',
            }}
          >
            After setup, you can access Youtarr from anywhere.
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 4,
              fontFamily: 'var(--font-body)',
            }}
          >
            Youtarr v{packageJson.version}
          </Typography>
        </Paper>
      </div>
    </div>
  );
};

export default InitialSetup;