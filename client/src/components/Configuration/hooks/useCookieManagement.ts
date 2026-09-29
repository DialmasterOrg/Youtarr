import { useState, useEffect, useCallback } from 'react';
import { CONFIG_UPDATED_EVENT } from '../../../hooks/useConfig';
import { ConfigState, CookieStatus, SnackbarState } from '../types';

interface UseCookieManagementParams {
  token: string | null;
  setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
}

export const useCookieManagement = ({
  token,
  setConfig,
  setSnackbar,
}: UseCookieManagementParams) => {
  const [cookieStatus, setCookieStatus] = useState<CookieStatus | null>(null);
  const [uploadingCookie, setUploadingCookie] = useState(false);

  const refreshCookieStatus = useCallback(async () => {
    if (token) {
      await fetch('/api/cookies/status', {
        headers: {
          'x-access-token': token,
        },
      })
        .then((response) => response.json())
        .then((data) => {
          setCookieStatus(data);
        })
        .catch((error) => console.error('Error fetching cookie status:', error));
    }
  }, [token]);

  // Fetch cookie status on mount; externally managed files can also be refreshed.
  useEffect(() => {
    void refreshCookieStatus();
  }, [refreshCookieStatus]);

  // Saving Enable Cookies changes which file is active, and so its details.
  useEffect(() => {
    const refresh = () => { void refreshCookieStatus(); };
    window.addEventListener(CONFIG_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CONFIG_UPDATED_EVENT, refresh);
  }, [refreshCookieStatus]);

  // Keep external-source warnings and recovery visible while Settings is open.
  const externalPath = cookieStatus?.external?.path;
  useEffect(() => {
    if (!token || !externalPath) return;
    const interval = setInterval(() => { void refreshCookieStatus(); }, 30000);
    return () => clearInterval(interval);
  }, [token, externalPath, refreshCookieStatus]);

  const uploadCookieFile = useCallback(async (file: File) => {
    setUploadingCookie(true);
    const formData = new FormData();
    formData.append('cookieFile', file);

    try {
      const response = await fetch('/api/cookies/upload', {
        method: 'POST',
        headers: {
          'x-access-token': token || '',
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setCookieStatus(data.cookieStatus);
        setConfig(prev => ({
          ...prev,
          cookiesEnabled: data.cookieStatus.cookiesEnabled,
          customCookiesUploaded: data.cookieStatus.customCookiesUploaded,
        }));
        setSnackbar({
          open: true,
          message: 'Cookie file uploaded successfully',
          severity: 'success'
        });
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: error.error || 'Failed to upload cookie file',
          severity: 'error'
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to upload cookie file',
        severity: 'error'
      });
    } finally {
      setUploadingCookie(false);
    }
  }, [token, setConfig, setSnackbar]);

  const deleteCookies = useCallback(async () => {
    try {
      const response = await fetch('/api/cookies', {
        method: 'DELETE',
        headers: {
          'x-access-token': token || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCookieStatus(data.cookieStatus);
        setConfig(prev => ({
          ...prev,
          customCookiesUploaded: false,
        }));
        setSnackbar({
          open: true,
          message: 'Custom cookies deleted',
          severity: 'success'
        });
      } else {
        throw new Error('Failed to delete cookies');
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete cookies',
        severity: 'error'
      });
    }
  }, [token, setConfig, setSnackbar]);

  return {
    cookieStatus,
    refreshCookieStatus,
    uploadingCookie,
    uploadCookieFile,
    deleteCookies,
  };
};
