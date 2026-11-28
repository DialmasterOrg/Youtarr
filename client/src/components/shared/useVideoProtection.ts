import { useState, useCallback } from 'react';
import axios from 'axios';
import { serverErrorMessage } from '../../utils/requestError';

interface UseVideoProtectionReturn {
  toggleProtection: (videoId: number, currentState: boolean) => Promise<boolean | undefined>;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  clearMessages: () => void;
}

export const useVideoProtection = (token: string | null): UseVideoProtectionReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  const toggleProtection = useCallback(async (
    videoId: number,
    currentState: boolean
  ): Promise<boolean | undefined> => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const newState = !currentState;

    try {
      const response = await axios.patch(
        `/api/videos/${videoId}/protected`,
        { protected: newState },
        { headers: { 'x-access-token': token || '' } }
      );

      setSuccessMessage(
        newState
          ? 'Video protected from auto-deletion'
          : 'Video protection removed'
      );
      return response.data.protected;
    } catch (err: unknown) {
      setError(serverErrorMessage(err, 'Failed to update protection status'));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    toggleProtection,
    loading,
    error,
    successMessage,
    clearMessages,
  };
};
