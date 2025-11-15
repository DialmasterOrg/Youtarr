import { useState, useEffect, useCallback } from 'react';
import { ConfigState, PlatformManagedState, DeploymentEnvironment } from '../components/Configuration/types';
import { DEFAULT_CONFIG } from '../config/configSchema';

// Simple type for components that only need basic config fields
export interface AppConfig {
  preferredResolution?: string;
  [key: string]: any;
}

interface UseConfigResult {
  config: ConfigState;
  initialConfig: ConfigState | null;
  isPlatformManaged: PlatformManagedState;
  deploymentEnvironment: DeploymentEnvironment;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setConfig: React.Dispatch<React.SetStateAction<ConfigState>>;
  setInitialConfig: React.Dispatch<React.SetStateAction<ConfigState | null>>;
}

export function useConfig(token: string | null): UseConfigResult {
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [initialConfig, setInitialConfig] = useState<ConfigState | null>(null);
  const [isPlatformManaged, setIsPlatformManaged] = useState<PlatformManagedState>({
    plexUrl: false,
    authEnabled: true,
    useTmpForDownloads: false
  });
  const [deploymentEnvironment, setDeploymentEnvironment] = useState<DeploymentEnvironment>({
    platform: null,
    isWsl: false,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!token) return;

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
          isWsl: !!env.isWsl
        });
        delete data.deploymentEnvironment;
      } else {
        setDeploymentEnvironment({
          platform: null,
          isWsl: false
        });
      }

      // Apply defaults
      const resolvedConfig = {
        ...data,
        writeChannelPosters: data.writeChannelPosters ?? true,
        writeVideoNfoFiles: data.writeVideoNfoFiles ?? true,
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

  return {
    config,
    initialConfig,
    isPlatformManaged,
    deploymentEnvironment,
    loading,
    error,
    refetch: fetchConfig,
    setConfig,
    setInitialConfig,
  };
}
