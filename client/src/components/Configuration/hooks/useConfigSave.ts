import { useCallback, useState } from 'react';
import { SCHEDULE_FIELDS, ScheduleFieldErrors } from '../schedules';
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

async function getSaveError(response: Response): Promise<{ error: string; fieldErrors: ScheduleFieldErrors }> {
  try {
    const body = await response.json();
    const fieldErrors: ScheduleFieldErrors = {};
    for (const { key } of SCHEDULE_FIELDS) {
      if (typeof body?.fieldErrors?.[key] === 'string') fieldErrors[key] = body.fieldErrors[key];
    }
    if (typeof body?.error === 'string' && body.error.trim()) {
      return { error: body.error, fieldErrors };
    }
  } catch {
    // Fall through when the server didn't return JSON.
  }
  return { error: 'Failed to save configuration', fieldErrors: {} };
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
  const [fieldErrors, setFieldErrors] = useState<ScheduleFieldErrors>({});
  const clearFieldErrors = (updates: Partial<ConfigState>) => {
    setFieldErrors((current) => {
      const next = { ...current };
      for (const { key } of SCHEDULE_FIELDS) {
        if (key in updates) delete next[key];
      }
      return next;
    });
  };

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
        const failure = await getSaveError(response);
        setFieldErrors(failure.fieldErrors);
        setSnackbar({
          open: true,
          message: failure.error,
          severity: 'error'
        });
        return false;
      }

      setFieldErrors({});
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
    fieldErrors,
    clearFieldErrors,
  };
};
