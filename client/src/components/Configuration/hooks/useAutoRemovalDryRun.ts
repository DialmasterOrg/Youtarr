import { useCallback } from 'react';
import { AutoRemovalDryRunResult } from '../types';

interface UseAutoRemovalDryRunParams {
  token: string | null;
}

interface AutoRemovalDryRunConfig {
  autoRemovalEnabled: boolean;
  autoRemovalVideoAgeThreshold: string;
  autoRemovalFreeSpaceThreshold: string;
  autoRemovalWatchedEnabled?: boolean;
  autoRemovalWatchedMinDaysSinceWatched?: string;
  autoRemovalWatchedMinVideoAgeDays?: string;
  autoRemovalKeepRecentCount?: number;
}

export const useAutoRemovalDryRun = ({ token }: UseAutoRemovalDryRunParams) => {
  const runDryRun = useCallback(async (config: AutoRemovalDryRunConfig): Promise<AutoRemovalDryRunResult> => {
    const response = await fetch('/api/auto-removal/dry-run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token || '',
      },
      body: JSON.stringify({
        autoRemovalEnabled: config.autoRemovalEnabled,
        autoRemovalVideoAgeThreshold: config.autoRemovalVideoAgeThreshold || '',
        autoRemovalFreeSpaceThreshold: config.autoRemovalFreeSpaceThreshold || '',
        autoRemovalWatchedEnabled: config.autoRemovalWatchedEnabled ?? false,
        autoRemovalWatchedMinDaysSinceWatched: config.autoRemovalWatchedMinDaysSinceWatched || '',
        autoRemovalWatchedMinVideoAgeDays: config.autoRemovalWatchedMinVideoAgeDays || '',
        autoRemovalKeepRecentCount: config.autoRemovalKeepRecentCount ?? 0
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
      const message = payload?.error || 'Failed to preview automatic removal';
      throw new Error(message);
    }

    return payload as AutoRemovalDryRunResult;
  }, [token]);

  return {
    runDryRun,
  };
};
