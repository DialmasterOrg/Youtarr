import React, { useState } from 'react';
import { Button, TextField, Alert, Box } from '@mui/material';
import axios from 'axios';
import { locationUtils } from 'src/utils/location';

interface LocalLoginProps {
  setToken: (token: string) => void;
}

const redirectTo = (path: string) => {
  locationUtils.setHref(path);
};

const LocalLogin: React.FC<LocalLoginProps> = ({ setToken }) => {
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
        password
      });

      const { token } = response.data;
      localStorage.setItem('authToken', token);
      setToken(token);
      redirectTo('/configuration');
    } catch (err: any) {
      if (err.response?.data?.requiresSetup) {
        redirectTo('/setup');
      } else if (err.response?.status === 429) {
        // Rate limited - show the specific message from server
        setError(err.response?.data?.error || err.response?.data?.message || 'Too many login attempts. Please try again later.');
      } else if (err.response?.status === 401) {
        // Invalid credentials
        setError('Invalid username or password');
      } else if (err.response?.data?.error) {
        // Other server errors with specific messages
        setError(err.response.data.error);
      } else {
        // Generic error fallback
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleLogin} sx={{ mt: 2 }}>
      <TextField
        fullWidth
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        margin="normal"
        required
        autoFocus
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
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      <Button
        type="submit"
        fullWidth
        variant="contained"
        sx={{ mt: 3 }}
        disabled={loading}
      >
        {loading ? 'Logging in...' : 'Login'}
      </Button>
    </Box>
  );
};

export default LocalLogin;