import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import type { MembersAccessState } from '../../../../types/ChannelVideo';

interface MembersAccessCheckResponse {
  membersAccess: MembersAccessState | null;
}

interface UseMembersAccessCheckReturn {
  // The result of the last check for this video; undefined until one finishes.
  data: MembersAccessState | null | undefined;
  loading: boolean;
  error: string | null;
  check: () => Promise<void>;
}

const FALLBACK_ERROR = 'Could not check access. Try again later.';

function errorMessage(err: unknown): string {
  const response = (err as { response?: { status?: number; data?: { error?: string } } })?.response;
  if (response?.status === 429) return 'Too many checks. Wait a minute and try again.';
  return response?.data?.error || FALLBACK_ERROR;
}

// Asks the server to check, with the configured cookies, whether a members-only
// video can be downloaded. The answer is recorded server-side for downloads.
export const useMembersAccessCheck = (
  youtubeId: string,
  token: string | null
): UseMembersAccessCheckReturn => {
  const [data, setData] = useState<MembersAccessState | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A different video starts with no result.
  useEffect(() => {
    setData(undefined);
    setError(null);
    setLoading(false);
  }, [youtubeId]);

  const check = useCallback(async () => {
    if (!youtubeId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post<MembersAccessCheckResponse>(
        `/api/videos/${youtubeId}/members-access/check`,
        {},
        { headers: { 'x-access-token': token } }
      );
      setData(res.data.membersAccess ?? null);
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [youtubeId, token]);

  return { data, loading, error, check };
};
