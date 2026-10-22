import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ExternalRequestReview } from '../../../types/externalRequest';
import { canApproveRequest, canRejectRequest, requestError, ReviewAction } from '../requestPolicy';

interface ReviewState {
  selected: ExternalRequestReview | null;
  detailLoading: boolean;
  action: ReviewAction | null;
  // True when the action was started from the details dialog, so cancelling
  // returns there instead of closing back to the list.
  actionFromDetails: boolean;
  reason: string;
  actionError: string | null;
  submitting: boolean;
  grantToRequestingKey: boolean;
}

const EMPTY_REVIEW: ReviewState = {
  selected: null,
  detailLoading: false,
  action: null,
  actionFromDetails: false,
  reason: '',
  actionError: null,
  submitting: false,
  grantToRequestingKey: true,
};

const canTakeAction = (request: ExternalRequestReview, action: ReviewAction) =>
  action === 'approve' ? canApproveRequest(request) : canRejectRequest(request);

export function useRequestReview(token: string, refresh: () => void) {
  const [review, setReview] = useState(EMPTY_REVIEW);
  const sequence = useRef(0);
  const submitting = useRef(false);

  useEffect(() => {
    ++sequence.current;
    setReview(EMPTY_REVIEW);
    return () => {
      ++sequence.current;
    };
  }, [token]);

  const openDetail = useCallback(
    async (request: ExternalRequestReview) => {
      if (submitting.current) return;
      const current = ++sequence.current;
      setReview({ ...EMPTY_REVIEW, selected: request, detailLoading: true });
      try {
        const response = await axios.get<ExternalRequestReview>(`/api/external-requests/${request.id}`, {
          headers: { 'x-access-token': token },
        });
        if (current === sequence.current) {
          setReview((state) => ({ ...state, selected: response.data, detailLoading: false }));
        }
      } catch (error) {
        if (current === sequence.current) {
          setReview((state) => ({
            ...state,
            detailLoading: false,
            actionError: requestError(error, 'Unable to load request details'),
          }));
        }
      }
    },
    [token]
  );

  const beginInlineAction = useCallback((request: ExternalRequestReview, action: ReviewAction) => {
    if (submitting.current || !canTakeAction(request, action)) return;
    ++sequence.current;
    setReview({ ...EMPTY_REVIEW, selected: request, action, grantToRequestingKey: true });
  }, []);

  const beginDetailAction = useCallback((action: ReviewAction) => {
    if (submitting.current) return;
    setReview((state) => {
      if (!state.selected || state.detailLoading || !canTakeAction(state.selected, action)) return state;
      return {
        ...state,
        action,
        actionFromDetails: true,
        reason: '',
        actionError: null,
        grantToRequestingKey: true,
      };
    });
  }, []);

  const closeDetails = useCallback(() => {
    if (submitting.current) return;
    ++sequence.current;
    setReview(EMPTY_REVIEW);
  }, []);

  const { actionFromDetails } = review;
  const cancelAction = useCallback(() => {
    if (submitting.current) return;
    if (actionFromDetails) {
      setReview((state) => ({ ...EMPTY_REVIEW, selected: state.selected }));
      return;
    }
    ++sequence.current;
    setReview(EMPTY_REVIEW);
  }, [actionFromDetails]);

  const submitAction = useCallback(async () => {
    const { selected, action, reason, grantToRequestingKey } = review;
    if (!selected || !action || submitting.current) return;
    if (action === 'reject' && !reason.trim()) return;
    const current = sequence.current;
    submitting.current = true;
    setReview((state) => ({ ...state, submitting: true, actionError: null }));
    try {
      const payload =
        action === 'reject'
          ? { reason: reason.trim() }
          : selected.type === 'channel'
            ? { grantToRequestingKey }
            : {};
      const response = await axios.post<ExternalRequestReview>(
        `/api/external-requests/${selected.id}/${action}`,
        payload,
        { headers: { 'x-access-token': token } }
      );
      if (current !== sequence.current) return;
      setReview({ ...EMPTY_REVIEW, selected: response.data });
      refresh();
    } catch (error) {
      if (current === sequence.current) {
        setReview((state) => ({ ...state, actionError: requestError(error, `Unable to ${action} request`) }));
      }
    } finally {
      submitting.current = false;
      if (current === sequence.current) setReview((state) => ({ ...state, submitting: false }));
    }
  }, [refresh, review, token]);

  // Keeps an open details dialog in step with the queue's background refreshes.
  const syncFromList = useCallback((requests: ExternalRequestReview[]) => {
    setReview((state) => {
      if (!state.selected || state.action || state.submitting || state.detailLoading) return state;
      const fresh = requests.find((request) => request.id === state.selected?.id);
      return fresh && fresh.updatedAt !== state.selected.updatedAt ? { ...state, selected: fresh } : state;
    });
  }, []);

  const setReason = useCallback((reason: string) => setReview((state) => ({ ...state, reason })), []);
  const setGrantToRequestingKey = useCallback(
    (grantToRequestingKey: boolean) => setReview((state) => ({ ...state, grantToRequestingKey })),
    []
  );

  return {
    ...review,
    openDetail,
    beginInlineAction,
    beginDetailAction,
    closeDetails,
    cancelAction,
    submitAction,
    syncFromList,
    setReason,
    setGrantToRequestingKey,
  };
}
