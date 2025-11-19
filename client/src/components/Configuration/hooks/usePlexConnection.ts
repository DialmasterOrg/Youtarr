import { useState, useEffect, useCallback } from 'react';
import { ConfigState, PlexConnectionStatus, SnackbarState } from '../types';

interface UsePlexConnectionParams {
  token: string | null;
  config: ConfigState;
  setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
  setInitialConfig: React.Dispatch<React.SetStateAction<ConfigState | null>>;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
  hasPlexServerConfigured: boolean;
}

export const usePlexConnection = ({
  token,
  config,
  setConfig,
  setInitialConfig,
  setSnackbar,
  hasPlexServerConfigured,
}: UsePlexConnectionParams) => {
  const [plexConnectionStatus, setPlexConnectionStatus] = useState<PlexConnectionStatus>('not_tested');
  const [openPlexLibrarySelector, setOpenPlexLibrarySelector] = useState(false);
  const [openPlexAuthDialog, setOpenPlexAuthDialog] = useState(false);
  const [didInitialPlexCheck, setDidInitialPlexCheck] = useState(false);

  const checkPlexConnection = useCallback(() => {
    if (hasPlexServerConfigured) {
      fetch('/getplexlibraries', {
        headers: {
          'x-access-token': token || '',
        },
      })
        .then((response) => response.json())
        .then((data) => {
          setPlexConnectionStatus(Array.isArray(data) && data.length > 0 ? 'connected' : 'not_connected');
        })
        .catch(() => {
          setPlexConnectionStatus('not_connected');
        });
    }
  }, [hasPlexServerConfigured, token]);

  // On first load after config arrives, check Plex connection if values exist
  useEffect(() => {
    if (!didInitialPlexCheck && hasPlexServerConfigured && config.plexApiKey) {
      checkPlexConnection();
      setDidInitialPlexCheck(true);
    }
  }, [didInitialPlexCheck, hasPlexServerConfigured, config.plexApiKey, checkPlexConnection]);

  const testPlexConnection = async () => {
    if (!hasPlexServerConfigured) {
      setSnackbar({
        open: true,
        message: 'Please enter your Plex server address before testing the connection.',
        severity: 'warning'
      });
      return;
    }

    if (!config.plexApiKey) {
      setSnackbar({
        open: true,
        message: 'Please enter your Plex API Key',
        severity: 'warning'
      });
      return;
    }

    const rawPortInput = (config.plexPort ?? '').toString().trim();
    const digitsOnlyPort = rawPortInput.replace(/[^0-9]/g, '');
    let normalizedPort = '32400';

    if (digitsOnlyPort.length > 0) {
      const portNumber = Number.parseInt(digitsOnlyPort, 10);
      if (!Number.isNaN(portNumber)) {
        const clampedPort = Math.min(65535, Math.max(1, portNumber));
        normalizedPort = String(clampedPort);
      }
    }

    if (config.plexPort !== normalizedPort) {
      setConfig((prev) => ({
        ...prev,
        plexPort: normalizedPort
      }));
    }

    setPlexConnectionStatus('testing');

    try {
      // Send the unsaved form values as query parameters for testing
      const params = new URLSearchParams({
        testApiKey: config.plexApiKey
      });

      if (config.plexIP) {
        params.set('testIP', config.plexIP);
      }

      params.set('testPort', normalizedPort);
      params.set('testUseHttps', String(config.plexViaHttps));

      const response = await fetch(`/getplexlibraries?${params}`, {
        headers: {
          'x-access-token': token || '',
        },
      });
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        setPlexConnectionStatus('connected');
        // Plex credentials are auto-saved. Update initial snapshot for those fields.
        setInitialConfig((prev) => (
          prev
            ? { ...prev, plexIP: config.plexIP, plexApiKey: config.plexApiKey, plexPort: normalizedPort, plexViaHttps: config.plexViaHttps }
            : { ...config, plexPort: normalizedPort }
        ));
        setSnackbar({
          open: true,
          message: 'Plex connection successful! Credentials saved automatically.',
          severity: 'success'
        });
      } else {
        setPlexConnectionStatus('not_connected');
        setSnackbar({
          open: true,
          message: 'Could not retrieve Plex libraries. Check your settings.',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error testing Plex connection:', error);
      setPlexConnectionStatus('not_connected');
      setSnackbar({
        open: true,
        message: 'Failed to connect to Plex server. Check IP and API key.',
        severity: 'error'
      });
    }
  };

  const openLibrarySelector = () => {
    setOpenPlexLibrarySelector(true);
  };

  const closeLibrarySelector = () => {
    setOpenPlexLibrarySelector(false);
  };

  const setLibraryId = ({
    libraryId,
  }: {
    libraryId: string;
    libraryTitle: string;
  }) => {
    setConfig((prev) => ({
      ...prev,
      plexYoutubeLibraryId: libraryId,
    }));

    closeLibrarySelector();
  };

  const handlePlexAuthSuccess = (apiKey: string) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      plexApiKey: apiKey
    }));
    setPlexConnectionStatus('not_tested');
    setSnackbar({
      open: true,
      message: 'Plex API Key obtained successfully! Click "Test Connection" to verify and save.',
      severity: 'success'
    });
  };

  return {
    plexConnectionStatus,
    setPlexConnectionStatus,
    openPlexLibrarySelector,
    openPlexAuthDialog,
    setOpenPlexAuthDialog,
    checkPlexConnection,
    testPlexConnection,
    openLibrarySelector,
    closeLibrarySelector,
    setLibraryId,
    handlePlexAuthSuccess,
  };
};
