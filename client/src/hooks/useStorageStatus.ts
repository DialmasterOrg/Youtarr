import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export interface StorageData {
  availableGB: string;
  percentFree: number;
  totalGB: string;
}

interface UseStorageStatusOptions {
  checkOnly?: boolean;
  poll?: boolean;
  pollInterval?: number;
}

interface UseStorageStatusResult {
  data: StorageData | null;
  available: boolean | null;
  loading: boolean;
  error: boolean;
}

export const useStorageStatus = (
  token: string | null,
  options: UseStorageStatusOptions = {}
): UseStorageStatusResult => {
  const { checkOnly = false, poll = false, pollInterval = 120000 } = options;

  const [data, setData] = useState<StorageData | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStorageStatus = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get('/storage-status', {
        headers: {
          'x-access-token': token,
        },
      });

      if (checkOnly) {
        // For checkOnly mode, just verify if availableGB exists
        setAvailable(response.data && response.data.availableGB !== undefined);
      } else {
        // For full data mode, store the entire response
        setData(response.data);
      }

      setError(false);
    } catch (err) {
      console.error('Failed to fetch storage status:', err);
      setError(true);

      if (checkOnly) {
        setAvailable(false);
      }
    } finally {
      setLoading(false);
    }
  }, [token, checkOnly]);

  useEffect(() => {
    fetchStorageStatus();

    if (poll) {
      const interval = setInterval(fetchStorageStatus, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStorageStatus, poll, pollInterval]);

  return {
    data,
    available,
    loading,
    error,
  };
};
