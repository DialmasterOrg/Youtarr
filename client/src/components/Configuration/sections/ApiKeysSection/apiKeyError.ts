import axios from 'axios';

export function apiKeyError(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return typeof error.response?.data?.error === 'string' ? error.response.data.error : fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
