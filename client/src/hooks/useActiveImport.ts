import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ImportJobSummary } from '../types/subscriptionImport';

export function useActiveImport(token: string | null) {
  const [activeImport, setActiveImport] = useState<ImportJobSummary | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  return { activeImport, loading, refetch: fetchActive };
}
