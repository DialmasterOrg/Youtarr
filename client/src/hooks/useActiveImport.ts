import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { ImportJobSummary } from '../types/subscriptionImport';

const POLL_INTERVAL_MS = 5000;

export function useActiveImport(token: string | null) {
  const [activeImport, setActiveImport] = useState<ImportJobSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActive = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get<ImportJobSummary>('/api/subscriptions/imports/active', {
        headers: { 'x-access-token': token },
        validateStatus: (status) => status === 200 || status === 204,
      });
      setActiveImport(res.status === 204 ? null : res.data);
    } catch {
      setActiveImport(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial fetch
  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  // Poll while an import is in progress
  useEffect(() => {
    if (activeImport?.status === 'In Progress') {
      intervalRef.current = setInterval(fetchActive, POLL_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeImport?.status, fetchActive]);

  return { activeImport, loading, refetch: fetchActive };
}
