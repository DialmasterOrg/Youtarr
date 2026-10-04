import { useCallback, useState } from 'react';
import { SCHEDULE_FIELDS, ScheduleFieldErrors } from '../schedules';
import { ConfigState, SnackbarState } from '../types';
import { CONFIG_UPDATED_EVENT } from '../../../hooks/useConfig';
import { ReorganizeChange } from '../../../types/reorganize';
import { reorganizeChangeOf } from '../../shared/Reorganize/reorganizeErrors';

interface UseConfigSaveParams {
  token: string | null;
  config: ConfigState;
  setInitialConfig: React.Dispatch<React.SetStateAction<ConfigState | null>>;
  setSnackbar: React.Dispatch<React.SetStateAction<SnackbarState>>;
  hasPlexServerConfigured: boolean;
  checkPlexConnection: () => void;
}

interface SaveFailure {
  error: string;
  fieldErrors: ScheduleFieldErrors;
  /** A default subfolder change that moves downloads, to review in the reorganize dialog */
  reorganizeChange: ReorganizeChange | null;
}

async function getSaveError(response: Response): Promise<SaveFailure> {
  try {
    const body = await response.json();
    const fieldErrors: ScheduleFieldErrors = {};
    for (const { key } of SCHEDULE_FIELDS) {
      if (typeof body?.fieldErrors?.[key] === 'string') fieldErrors[key] = body.fieldErrors[key];
    }
    if (typeof body?.error === 'string' && body.error.trim()) {
      return { error: body.error, fieldErrors, reorganizeChange: reorganizeChangeOf(body) };
    }
  } catch {
    // Fall through when the server didn't return JSON.
  }
  return { error: 'Failed to save configuration', fieldErrors: {}, reorganizeChange: null };
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
  const [reorganizeChange, setReorganizeChange] = useState<ReorganizeChange | null>(null);
  const clearReorganizeChange = useCallback(() => setReorganizeChange(null), []);

  /**
   * Read the saved default subfolder back into the saved baseline: the server
   * undoes a reorganize's change when no video could be moved, so it is read
   * rather than assumed, when the review closes and again when the move ends.
   * Resolves to the saved value, or null when the read failed.
   */
  const readBackDefaultSubfolder = useCallback(async (): Promise<string | null> => {
    if (!token) return null;
    try {
      const response = await fetch('/getconfig', { headers: { 'x-access-token': token } });
      if (!response.ok) return null;
      const data = await response.json();
      const saved = typeof data?.defaultSubfolder === 'string' ? data.defaultSubfolder : '';
      setInitialConfig((current) => (current ? { ...current, defaultSubfolder: saved } : current));
      return saved;
    } catch {
      return null;
    }
  }, [token, setInitialConfig]);

  /** Close out the reorganize dialog, reading the saved default back when it was for one. */
  const finishReorganize = useCallback(async (): Promise<string | null> => {
    const change = reorganizeChange;
    setReorganizeChange(null);
    if (!change || change.type !== 'defaultSubfolder') return null;
    return readBackDefaultSubfolder();
  }, [reorganizeChange, readBackDefaultSubfolder]);
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
        if (failure.reorganizeChange) {
          setReorganizeChange(failure.reorganizeChange);
          return false;
        }
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
    reorganizeChange,
    clearReorganizeChange,
    finishReorganize,
    readBackDefaultSubfolder,
  };
};
