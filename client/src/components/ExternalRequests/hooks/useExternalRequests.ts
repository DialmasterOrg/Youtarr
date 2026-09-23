import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ExternalRequestReview, ExternalRequestReviewPage, ExternalRequestRequester } from '../../../types/externalRequest';

export type ReviewAction = 'approve' | 'reject';
export interface ExternalRequestFilters { status: string; apiKeyId: string; requestType: string; }
const getError = (error: unknown, fallback: string) => axios.isAxiosError<{ error?: string }>(error) ? error.response?.data?.error || fallback : error instanceof Error ? error.message : fallback;

export function useExternalRequests(token: string) {
  const [filters, setFilters] = useState<ExternalRequestFilters>({ status: '', apiKeyId: '', requestType: '' });
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<ExternalRequestReview[]>([]);
  const [requesters, setRequesters] = useState<ExternalRequestRequester[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState<ExternalRequestReview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [grantToRequestingKey, setGrantToRequestingKey] = useState(true);
  const detailSequence = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const response = await axios.get<ExternalRequestReviewPage>('/api/external-requests', { headers: { 'x-access-token': token }, params: { page, pageSize: 25, ...(filters.status ? { status: filters.status } : {}), ...(filters.apiKeyId ? { apiKeyId: filters.apiKeyId } : {}), ...(filters.requestType ? { requestType: filters.requestType } : {}) }, signal });
      const body = response.data; const normalizedTotalPages = Math.max(1, body.pagination.totalPages || 0);
      setRequests(body.data); setRequesters(body.filterOptions.requesters); setTotalPages(normalizedTotalPages);
      if (page > normalizedTotalPages) setPage(normalizedTotalPages);
    } catch (loadError) { if (!axios.isCancel(loadError) && !signal?.aborted) setError(getError(loadError, 'Unable to load requests')); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [filters.apiKeyId, filters.requestType, filters.status, page, reloadToken, token]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const openDetail = useCallback(async (request: ExternalRequestReview) => {
    const sequence = ++detailSequence.current; setSelected(request); setAction(null); setActionError(null); setDetailLoading(true);
    try { const response = await axios.get<ExternalRequestReview>(`/api/external-requests/${request.id}`, { headers: { 'x-access-token': token } }); if (sequence === detailSequence.current) setSelected(response.data); }
    catch (detailError) { if (sequence === detailSequence.current) setActionError(getError(detailError, 'Unable to load request details')); }
    finally { if (sequence === detailSequence.current) setDetailLoading(false); }
  }, [token]);
  const beginInlineAction = useCallback((request: ExternalRequestReview, nextAction: ReviewAction) => {
    if (submitting || request.status !== 'pending') return;
    ++detailSequence.current; setSelected(request); setDetailLoading(false); setActionError(null); setReason(''); setGrantToRequestingKey(true); setAction(nextAction);
  }, [submitting]);
  const closeDetails = useCallback(() => { ++detailSequence.current; setSelected(null); setAction(null); setReason(''); setGrantToRequestingKey(true); setActionError(null); setDetailLoading(false); }, []);
  const cancelAction = useCallback(() => { if (!submitting) { ++detailSequence.current; setSelected(null); setAction(null); setReason(''); setGrantToRequestingKey(true); setActionError(null); setDetailLoading(false); } }, [submitting]);
  const submitAction = useCallback(async () => {
    if (!selected || !action) return; setSubmitting(true); setActionError(null);
    try { const payload = action === 'reject' ? { reason } : selected.type === 'channel' ? { grantToRequestingKey } : {}; const response = await axios.post<ExternalRequestReview>(`/api/external-requests/${selected.id}/${action}`, payload, { headers: { 'x-access-token': token } }); setSelected(response.data); setAction(null); setReason(''); setGrantToRequestingKey(true); setReloadToken((value) => value + 1); }
    catch (submitError) { setActionError(getError(submitError, `Unable to ${action} request`)); } finally { setSubmitting(false); }
  }, [action, grantToRequestingKey, reason, selected, token]);
  const setFilter = useCallback((name: keyof ExternalRequestFilters, value: string) => { setFilters((current) => ({ ...current, [name]: value })); setPage(1); }, []);
  const refresh = useCallback(() => setReloadToken((value) => value + 1), []);
  return { requests, requesters, page, totalPages, loading, error, filters, selected, detailLoading, action, reason, actionError, submitting, grantToRequestingKey, setPage, setReason, setAction, setActionError, setGrantToRequestingKey, setFilter, refresh, openDetail, beginInlineAction, closeDetails, cancelAction, submitAction };
}
