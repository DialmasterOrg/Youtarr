import { useCallback, useState } from 'react';
import axios from 'axios';

export interface YtdlpArgsValidationResult {
  ok: boolean;
  message?: string;
  stderr?: string;
}

interface UseYtdlpArgsValidationReturn {
  validating: boolean;
  result: YtdlpArgsValidationResult | null;
  validate: (args: string) => Promise<void>;
  reset: () => void;
}

export function useYtdlpArgsValidation(token: string | null): UseYtdlpArgsValidationReturn {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<YtdlpArgsValidationResult | null>(null);

  const validate = useCallback(async (args: string) => {
    setValidating(true);
    try {
      const response = await axios.post<YtdlpArgsValidationResult>(
        '/api/ytdlp/validate-args',
        { args },
        { headers: { 'x-access-token': token || '' } }
      );
      setResult(response.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosErr.response?.status === 400 && axiosErr.response.data?.error) {
        setResult({ ok: false, stderr: axiosErr.response.data.error });
      } else {
        setResult({ ok: false, stderr: 'Validation failed; please try again' });
      }
    } finally {
      setValidating(false);
    }
  }, [token]);

  const reset = useCallback(() => setResult(null), []);

  return { validating, result, validate, reset };
}
