import { useCallback, useState } from 'react';
import axios from 'axios';
import { CustomArgEntry } from '../types';

export interface YtdlpArgsValidationResult {
  ok: boolean;
  message?: string;
  stderr?: string;
  warnings?: CustomArgEntry[];
  blocked?: CustomArgEntry[];
  errors?: string[];
}

interface ValidateArgsResponse {
  ok?: boolean;
  message?: string;
  stderr?: string;
  warnings?: CustomArgEntry[];
}

interface ValidateArgsError {
  error?: string;
  customArgsCheck?: {
    blocked?: CustomArgEntry[];
    warnings?: CustomArgEntry[];
    errors?: string[];
  };
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
      const response = await axios.post<ValidateArgsResponse>(
        '/api/ytdlp/validate-args',
        { args },
        { headers: { 'x-access-token': token || '' } }
      );
      setResult({
        ok: response.data.ok ?? false,
        message: response.data.message,
        stderr: response.data.stderr,
        warnings: response.data.warnings ?? [],
      });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: ValidateArgsError } };
      const data = axiosErr.response?.data;
      if (axiosErr.response?.status === 400 && data?.error) {
        setResult({
          ok: false,
          stderr: data.error,
          blocked: data.customArgsCheck?.blocked ?? [],
          warnings: data.customArgsCheck?.warnings ?? [],
          errors: data.customArgsCheck?.errors ?? [],
        });
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
