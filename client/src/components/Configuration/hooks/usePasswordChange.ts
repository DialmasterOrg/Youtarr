import { useState, useCallback } from 'react';
import axios from 'axios';
import { SnackbarState } from '../types';

interface UsePasswordChangeParams {
  token: string | null;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
}

export const usePasswordChange = ({
  token,
  setSnackbar,
}: UsePasswordChangeParams) => {
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handlePasswordFieldChange = useCallback((field: 'current' | 'new' | 'confirm', value: string) => {
    if (field === 'current') {
      setCurrentPassword(value);
    } else if (field === 'new') {
      setNewPassword(value);
    } else {
      setConfirmNewPassword(value);
    }
  }, []);

  const handlePasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      setSnackbar({
        open: true,
        message: 'Passwords do not match',
        severity: 'error'
      });
      return;
    }

    if (newPassword.length < 8) {
      setSnackbar({
        open: true,
        message: 'Password must be at least 8 characters',
        severity: 'error'
      });
      return;
    }

    try {
      const response = await axios.post('/auth/change-password', {
        currentPassword,
        newPassword
      }, {
        headers: {
          'x-access-token': token || '',
        }
      });

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: 'Password updated successfully',
          severity: 'success'
        });
        setShowPasswordChange(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to update password',
        severity: 'error'
      });
    }
  }, [token, currentPassword, newPassword, confirmNewPassword, setSnackbar]);

  return {
    showPasswordChange,
    setShowPasswordChange,
    currentPassword,
    newPassword,
    confirmNewPassword,
    handlePasswordFieldChange,
    handlePasswordSubmit,
  };
};
