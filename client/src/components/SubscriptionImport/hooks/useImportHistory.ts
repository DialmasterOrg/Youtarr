import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ImportJobSummary } from '../../../types/subscriptionImport';

interface ImportsResponse {
  imports: ImportJobSummary[];
}

export function useImportHistory(token: string) {
  const [imports, setImports] = useState<ImportJobSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(() => {
    if (!token) return;
    setLoading(true);
    axios.get<ImportsResponse>('/api/subscriptions/imports', {
      headers: { 'x-access-token': token },
    })
      .then((res) => setImports(res.data.imports || []))
      .catch(() => {
        // Silently fail; recent imports are non-critical
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { imports, loading, refetch: fetchHistory };
}
