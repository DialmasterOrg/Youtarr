import axios from 'axios';
import { ReorganizeChange } from '../../../types/reorganize';

/** Thrown for a change the server sends to the reorganize preview instead of saving. */
export class ReorganizeRequiredError extends Error {
  readonly change: ReorganizeChange;

  constructor(message: string, change: ReorganizeChange) {
    super(message);
    this.name = 'ReorganizeRequiredError';
    this.change = change;
  }
}

interface ErrorBody {
  error?: unknown;
  reorganizeRequired?: unknown;
  change?: unknown;
  code?: unknown;
}

/** The change to preview from a refusal body, or null for any other refusal. */
export function reorganizeChangeOf(body: unknown): ReorganizeChange | null {
  const data = body as ErrorBody | null | undefined;
  if (!data || data.reorganizeRequired !== true || !data.change || typeof data.change !== 'object') return null;
  return data.change as ReorganizeChange;
}

/** The server's refusal message from an axios error, or the fallback. */
export function serverMessageOf(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ErrorBody | undefined;
    if (typeof data?.error === 'string' && data.error) return data.error;
  }
  return fallback;
}

/** The server's error code from an axios error, if any. */
export function serverCodeOf(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const code = (err.response?.data as ErrorBody | undefined)?.code;
  return typeof code === 'string' ? code : null;
}

/**
 * The error to throw for a failed request: a ReorganizeRequiredError when the
 * server asked for the reorganize preview, else an Error with its message.
 */
export function toRequestError(err: unknown, fallback: string): Error {
  const message = serverMessageOf(err, fallback);
  const change = axios.isAxiosError(err) ? reorganizeChangeOf(err.response?.data) : null;
  return change ? new ReorganizeRequiredError(message, change) : new Error(message);
}

export function isReorganizeRequired(err: unknown): err is ReorganizeRequiredError {
  return err instanceof ReorganizeRequiredError;
}
