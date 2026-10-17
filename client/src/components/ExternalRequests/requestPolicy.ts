import axios from 'axios';
import { ExternalRequestReview } from '../../types/externalRequest';

export type ReviewAction = 'approve' | 'reject';

export const canApproveRequest = (request: ExternalRequestReview) =>
  request.status === 'pending' || (request.status === 'approved' && !request.job);

export const canRejectRequest = (request: ExternalRequestReview) => request.status === 'pending';

export const requestError = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    if (error.response?.data?.error) return error.response.data.error;
    if (error.response?.status === 403) return 'Your session cannot review this request.';
    if (error.response?.status === 404) return 'This request is no longer available.';
    if (error.response?.status === 409) return 'This request has changed. Refresh to see its current status.';
    if (error.response?.status === 503) return 'Work capacity is temporarily unavailable. Retry this action.';
    return fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export const requestDateLabel = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};
