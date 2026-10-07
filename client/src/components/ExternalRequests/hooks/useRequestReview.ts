import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ExternalRequestReview } from '../../../types/externalRequest';
import { canApproveRequest, canRejectRequest, requestError, ReviewAction } from '../requestPolicy';

interface ReviewState {
  selected: ExternalRequestReview | null;
  detailLoading: boolean;
  action: ReviewAction | null;
  reason: string;
  actionError: string | null;
  submitting: boolean;
  grantToRequestingKey: boolean;
}
const EMPTY_REVIEW: ReviewState = {
  selected: null, detailLoading: false, action: null, reason: '',
  actionError: null, submitting: false, grantToRequestingKey: true,
};

export function useRequestReview(token: string, refresh: () => void) {
  const [review, setReview] = useState(EMPTY_REVIEW);
  const sequence = useRef(0);
  const submitting = useRef(false);
  useEffect(() => {
    ++sequence.current;
    setReview(EMPTY_REVIEW);
    return () => { ++sequence.current; };
  }, [token]);

  const openDetail = useCallback(async (request: ExternalRequestReview) => {
    if (submitting.current) return;
    const current = ++sequence.current;
    setReview({ ...EMPTY_REVIEW, selected: request, detailLoading: true });
    try {
      const response = await axios.get<ExternalRequestReview>(`/api/external-requests/${request.id}`, {
        headers: { 'x-access-token': token },
      });
      if (current === sequence.current) {
        setReview(state => ({ ...state, selected: response.data, detailLoading: false }));
      }
    } catch (error) {
      if (current === sequence.current) {
        setReview(state => ({ ...state, detailLoading: false,
          actionError: requestError(error, 'Unable to load request details') }));
      }
    }
  }, [token]);

  const beginInlineAction = useCallback((request: ExternalRequestReview, action: ReviewAction) => {
    if (submitting.current || !(action === 'approve' ? canApproveRequest(request) : canRejectRequest(request))) return;
    ++sequence.current;
    setReview({ ...EMPTY_REVIEW, selected: request, action,
      grantToRequestingKey: request.status === 'approved' ? request.grantToRequestingKey !== false : true });
  }, []);

  const closeDetails = useCallback(() => {
    if (submitting.current) return;
    ++sequence.current;
    setReview(EMPTY_REVIEW);
  }, []);

  const submitAction = useCallback(async () => {
    const { selected, action, reason, grantToRequestingKey } = review;
    if (!selected || !action || submitting.current) return;
    if (action === 'reject' && !reason.trim()) return;
    const current = sequence.current;
    submitting.current = true;
    setReview(state => ({ ...state, submitting: true, actionError: null }));
    try {
      const payload = action === 'reject' ? { reason: reason.trim() }
        : selected.type === 'channel' ? { grantToRequestingKey } : {};
      const response = await axios.post<ExternalRequestReview>(`/api/external-requests/${selected.id}/${action}`,
        payload, { headers: { 'x-access-token': token } });
      if (current !== sequence.current) return;
      setReview({ ...EMPTY_REVIEW, selected: response.data });
      refresh();
    } catch (error) {
      if (current === sequence.current) {
        setReview(state => ({ ...state, actionError: requestError(error, `Unable to ${action} request`) }));
      }
    } finally {
      submitting.current = false;
      if (current === sequence.current) setReview(state => ({ ...state, submitting: false }));
    }
  }, [refresh, review, token]);

  return {
    ...review, openDetail, beginInlineAction, closeDetails, cancelAction: closeDetails, submitAction,
    setReason: (reason: string) => setReview(state => ({ ...state, reason })),
    setGrantToRequestingKey: (grantToRequestingKey: boolean) => setReview(state => ({ ...state, grantToRequestingKey })),
  };
}
