import { useState, useEffect, useCallback, useRef } from 'react';
import { ConfigState, PlatformManagedState, DeploymentEnvironment, LoggingStatus } from '../components/Configuration/types';
import { DEFAULT_CONFIG } from '../config/configSchema';
import { mergeServerChange } from '../utils/configPatch';
import { folderKey } from '../utils/libraryLayouts';

export const CONFIG_UPDATED_EVENT = 'config-updated';
/**
 * A field the server saved outside the Settings form (detail: the saved
 * fields). The saved copy takes the field as is; the draft takes only what
 * the server changed since that copy, so an open Settings page keeps its
 * unsaved edits, including edits to the same list, and its next save carries
 * the server's change.
 */
export const CONFIG_PATCHED_EVENT = 'config-patched';

type PlexMapping = ConfigState['plexSubfolderLibraryMappings'][number];
const mappingKey = (mapping: PlexMapping) => folderKey(mapping.subfolder);

// The draft after a server-side change: keyed lists are merged entry by entry
// against the saved copy they were edited from; other fields are replaced.
function patchDraft(draft: ConfigState, baseline: ConfigState | null, patch: Partial<ConfigState>): ConfigState {
  const next = { ...draft, ...patch };
  if (patch.plexSubfolderLibraryMappings) {
    next.plexSubfolderLibraryMappings = mergeServerChange(
      draft.plexSubfolderLibraryMappings,
      baseline?.plexSubfolderLibraryMappings,
      patch.plexSubfolderLibraryMappings,
      mappingKey
    );
  }
  return next;
}

interface UseConfigResult {
  config: ConfigState;
  initialConfig: ConfigState | null;
  isPlatformManaged: PlatformManagedState;
  deploymentEnvironment: DeploymentEnvironment;
  loggingStatus: LoggingStatus | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
  setInitialConfig: React.Dispatch<React.SetStateAction<ConfigState | null>>;
}

export function useConfig(token: string | null): UseConfigResult {
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [initialConfig, setInitialConfig] = useState<ConfigState | null>(null);
  // The saved copy as the patch handler sees it (state updaters can't read each other).
  const initialConfigRef = useRef<ConfigState | null>(null);
  initialConfigRef.current = initialConfig;
  const [isPlatformManaged, setIsPlatformManaged] = useState<PlatformManagedState>({
    plexUrl: false,
    authEnabled: true,
    useTmpForDownloads: false,
    ytdlpUpdates: false
  });
  const [deploymentEnvironment, setDeploymentEnvironment] = useState<DeploymentEnvironment>({
    platform: null,
    isWsl: false,
  });
  const [loggingStatus, setLoggingStatus] = useState<LoggingStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/getconfig', {
        headers: {
          'x-access-token': token,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract and handle isPlatformManaged
      if (data.isPlatformManaged) {
        setIsPlatformManaged(data.isPlatformManaged);
        delete data.isPlatformManaged;
      }

      // Extract and handle deploymentEnvironment
      if (data.deploymentEnvironment) {
        const env = data.deploymentEnvironment;
        setDeploymentEnvironment({
          platform: env.platform ?? null,
          timezone: env.timezone ?? null,
          isWsl: !!env.isWsl
        });
        delete data.deploymentEnvironment;
      } else {
        setDeploymentEnvironment({
          platform: null,
          isWsl: false
        });
      }

      // Read-only server status; never part of the config that gets saved
      setLoggingStatus(data.logging ?? null);
      delete data.logging;

      // Spread DEFAULT_CONFIG first so fields missing from the server response
      // (stale config pre-dating a new field) fall back to defaults instead of undefined.
      const resolvedConfig = {
        ...DEFAULT_CONFIG,
        ...data,
        writeChannelPosters: data.writeChannelPosters ?? true,
        writeVideoNfoFiles: data.writeVideoNfoFiles ?? true,
        writeVideoFanart: data.writeVideoFanart ?? false,
        plexPort: data.plexPort ? String(data.plexPort) : '32400'
      };

      setConfig(resolvedConfig);
      setInitialConfig(resolvedConfig);
    } catch (err) {
      console.error('Failed to fetch config:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleConfigUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<ConfigState | undefined>;
      const updatedConfig = customEvent.detail;

      if (updatedConfig) {
        setConfig(updatedConfig);
        setInitialConfig(updatedConfig);
        setLoading(false);
        setError(null);
      } else {
        fetchConfig();
      }
    };

    const handleConfigPatched = (event: Event) => {
      const patch = (event as CustomEvent<Partial<ConfigState> | undefined>).detail;
      if (!patch) return;
      const baseline = initialConfigRef.current;
      setConfig((prev) => patchDraft(prev, baseline, patch));
      setInitialConfig((prev) => (prev ? { ...prev, ...patch } : prev));
    };

    window.addEventListener(CONFIG_UPDATED_EVENT, handleConfigUpdated);
    window.addEventListener(CONFIG_PATCHED_EVENT, handleConfigPatched);

    return () => {
      window.removeEventListener(CONFIG_UPDATED_EVENT, handleConfigUpdated);
      window.removeEventListener(CONFIG_PATCHED_EVENT, handleConfigPatched);
    };
  }, [fetchConfig]);

  return {
    config,
    initialConfig,
    isPlatformManaged,
    deploymentEnvironment,
    loggingStatus,
    loading,
    error,
    refetch: fetchConfig,
    setConfig,
    setInitialConfig,
  };
}
