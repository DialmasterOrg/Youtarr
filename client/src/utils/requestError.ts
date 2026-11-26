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
