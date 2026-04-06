import { useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios';
import { ImportSource, PreviewResponse } from '../../../types/subscriptionImport';

export function usePreviewUpload(token: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (source: ImportSource, file: File): Promise<PreviewResponse> => {
    setLoading(true);
    setError(null);
    const endpoint = source === 'takeout'
      ? '/api/subscriptions/preview/takeout'
      : '/api/subscriptions/preview/cookies';
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post<PreviewResponse>(endpoint, formData, {
        headers: { 'x-access-token': token, 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } catch (err: unknown) {
      const message = err instanceof AxiosError
        ? err.response?.data?.error || err.message
        : 'Upload failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { loading, error, upload };
}
