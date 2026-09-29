import { useCallback, useState } from 'react';
import axios from 'axios';
import { CookieTestResult } from '../types';

const FALLBACK_ERROR = 'Could not run the cookie test. Check the server logs.';

export function useCookieTest(token: string | null) {
  const [result, setResult] = useState<CookieTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [testedAt, setTestedAt] = useState<Date | null>(null);

  const runTest = useCallback(async () => {
    setTesting(true);
    setResult(null);
    try {
      const response = await axios.post<CookieTestResult>(
        '/api/cookies/test',
        {},
        { headers: { 'x-access-token': token || '' } }
      );
      setResult(response.data);
    } catch (error: unknown) {
      // 400 (no active file), 409 (already running), and 429 all carry { error }.
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      setResult({ ok: false, error: message || FALLBACK_ERROR });
    } finally {
      setTestedAt(new Date());
      setTesting(false);
    }
  }, [token]);

  return { result, testing, testedAt, runTest };
}
