export interface RequestErrorSummary {
  message: string;
  // The HTTP status, when the server answered.
  status?: number;
}

// What is safe to log about a failed request. An axios error also carries the
// request it was for, session token header included, so it is never logged whole.
export function describeRequestError(err: unknown): RequestErrorSummary {
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === 'number' ? { message, status } : { message };
}

// What to show the user for a failed request: the server's `{ error }` text when
// it sent one, otherwise the fallback. Never the transport's own message
// ("Request failed with status code 502").
export function serverErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: unknown } } } | null)?.response?.data?.error;
  return typeof message === 'string' && message ? message : fallback;
}
