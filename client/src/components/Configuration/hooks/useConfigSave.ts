import { useCallback, useState } from 'react';
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

async function getSaveErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }
  } catch {
    // Fall through to the generic message when the server did not return JSON.
  }
  return 'Failed to save configuration';
}

export const useConfigSave = ({
  token,
  config,
  setInitialConfig,
  setSnackbar,
  hasPlexServerConfigured,
  checkPlexConnection,
}: UseConfigSaveParams) => {
  const [isSaving, setIsSaving] = useState(false);

  const saveConfig = useCallback(async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const response = await fetch('/updateconfig', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-token': token || '',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        setSnackbar({
          open: true,
          message: await getSaveErrorMessage(response),
          severity: 'error'
        });
        return false;
      }

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

      if (hasPlexServerConfigured) {
        checkPlexConnection();
      }

      return true;
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to save configuration',
        severity: 'error'
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [token, config, setInitialConfig, setSnackbar, hasPlexServerConfigured, checkPlexConnection]);

  return {
    saveConfig,
    isSaving,
  };
};
