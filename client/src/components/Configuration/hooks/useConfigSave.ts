import { useCallback } from 'react';
import { ConfigState, SnackbarState } from '../types';
import { CONFIG_UPDATED_EVENT } from '../../../hooks/useConfig';

interface UseConfigSaveParams {
  token: string | null;
  config: ConfigState;
  setInitialConfig: React.Dispatch<React.SetStateAction<ConfigState | null>>;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
  hasPlexServerConfigured: boolean;
  checkPlexConnection: () => void;
}

export const useConfigSave = ({
  token,
  config,
  setInitialConfig,
  setSnackbar,
  hasPlexServerConfigured,
  checkPlexConnection,
}: UseConfigSaveParams) => {
  const saveConfig = useCallback(async () => {
    try {
      const response = await fetch('/updateconfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token || '',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        // Update initial snapshot to current config so unsaved flag resets
        setInitialConfig(config);

        if (typeof window !== 'undefined') {
          const configUpdatedEvent = new CustomEvent<ConfigState>(CONFIG_UPDATED_EVENT, {
            detail: config,
          });
          window.dispatchEvent(configUpdatedEvent);
        }

        setSnackbar({
          open: true,
          message: 'Configuration saved successfully',
          severity: 'success'
        });

        // Re-check Plex connection if IP changed
        if (hasPlexServerConfigured) {
          checkPlexConnection();
        }
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save configuration',
        severity: 'error'
      });
    }
  }, [token, config, setInitialConfig, setSnackbar, hasPlexServerConfigured, checkPlexConnection]);

  return {
    saveConfig,
  };
};
