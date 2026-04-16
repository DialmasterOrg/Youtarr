import React from 'react';
import {
  Button,
  TextField,
  Alert,
  Typography,
} from '../../ui';
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
        <Alert severity="info" style={{ marginTop: 16 }}>
          <Typography variant="body2">
            Username and password authentication is managed by your platform deployment or environment configuration.
            To change your login credentials, update the authentication settings in your platform's configuration or .env file.
          </Typography>
        </Alert>
      </ConfigurationCard>
    );
  }

  return (
    <ConfigurationCard title="Account & Security">
      <div style={{ marginTop: 16 }}>
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
          <form onSubmit={handlePasswordSubmit}>
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
            <div style={{ marginTop: 16 }}>
              <Button type="submit" variant="contained" style={{ marginRight: 8 }}>
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
            </div>
          </form>
        )}
      </div>
    </ConfigurationCard>
  );
};
