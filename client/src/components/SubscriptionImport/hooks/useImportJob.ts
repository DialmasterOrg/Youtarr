import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { ImportJobDetail } from '../../../types/subscriptionImport';

const POLL_INTERVAL_MS = 3000;

export function useImportJob(jobId: string | null, token: string) {
  const [jobDetail, setJobDetail] = useState<ImportJobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const fetchJob = useCallback(async () => {
    if (!jobId || !token) return;
    try {
      const res = await axios.get<ImportJobDetail>(`/api/subscriptions/imports/${jobId}`, {
        headers: { 'x-access-token': token },
      });
      setJobDetail(res.data);
      if (res.data.status !== 'In Progress') {
        clearPolling();
      }
    } catch {
      // Silently continue polling; API errors are transient
    } finally {
      setLoading(false);
    }
  }, [jobId, token, clearPolling]);

  useEffect(() => {
    if (!jobId) {
      setJobDetail(null);
      return;
    }
    setLoading(true);
    fetchJob();
    intervalRef.current = setInterval(fetchJob, POLL_INTERVAL_MS);
    return () => {
      clearPolling();
    };
  }, [jobId, fetchJob, clearPolling]);

  return { jobDetail, loading };
}
