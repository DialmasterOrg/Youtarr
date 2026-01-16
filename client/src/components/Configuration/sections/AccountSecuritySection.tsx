import React from 'react';
import {
  Box,
  Button,
  TextField,
  Alert,
  Typography,
} from '@mui/material';
import { ConfigurationCard } from '../common/ConfigurationCard';
import { usePasswordChange } from '../hooks/usePasswordChange';
import { SnackbarState } from '../types';

interface AccountSecuritySectionProps {
  token: string | null;
  envAuthApplied: boolean;
  authEnabled: boolean;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
}

export const AccountSecuritySection: React.FC<AccountSecuritySectionProps> = ({
  token,
  envAuthApplied,
  authEnabled,
  setSnackbar,
}) => {
  const {
    showPasswordChange,
    setShowPasswordChange,
    currentPassword,
    newPassword,
    confirmNewPassword,
    handlePasswordFieldChange,
    handlePasswordSubmit,
  } = usePasswordChange({ token, setSnackbar });

  const showAccountSection = authEnabled !== false && !envAuthApplied;

  if (!showAccountSection) {
    return (
      <ConfigurationCard title="Account & Security">
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            Username and password authentication is managed by your platform deployment or environment configuration.
            To change your login credentials, update the authentication settings in your platform&apos;s configuration or .env file.
          </Typography>
        </Alert>
      </ConfigurationCard>
    );
  }

  return (
    <ConfigurationCard title="Account & Security">
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Change Password
        </Typography>

        {!showPasswordChange ? (
          <Button
            variant="outlined"
            onClick={() => setShowPasswordChange(true)}
          >
            Change Password
          </Button>
        ) : (
          <Box component="form" onSubmit={handlePasswordSubmit}>
            <TextField
              fullWidth
              type="password"
              label="Current Password"
              value={currentPassword}
              onChange={(e) => handlePasswordFieldChange('current', e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              type="password"
              label="New Password"
              value={newPassword}
              onChange={(e) => handlePasswordFieldChange('new', e.target.value)}
              margin="normal"
              required
              helperText="Minimum 8 characters"
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm New Password"
              value={confirmNewPassword}
              onChange={(e) => handlePasswordFieldChange('confirm', e.target.value)}
              margin="normal"
              required
              error={confirmNewPassword !== '' && newPassword !== confirmNewPassword}
              helperText={
                confirmNewPassword !== '' && newPassword !== confirmNewPassword
                  ? "Passwords don't match"
                  : ''
              }
            />
            <Box sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" sx={{ mr: 1 }}>
                Update Password
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setShowPasswordChange(false);
                  handlePasswordFieldChange('current', '');
                  handlePasswordFieldChange('new', '');
                  handlePasswordFieldChange('confirm', '');
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </ConfigurationCard>
  );
};
