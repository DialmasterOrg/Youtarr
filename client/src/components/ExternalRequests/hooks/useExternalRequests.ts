import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ExternalRequestReview, ExternalRequestReviewPage } from '../../../types/externalRequest';
import { useRequestReview } from './useRequestReview';
import { requestError } from '../requestPolicy';

export type { ReviewAction } from '../requestPolicy';

const PAGE_SIZE = 25;
// Approved and processing requests advance in a background executor, so the
// queue refreshes itself while any of them is on screen.
const ACTIVE_POLL_INTERVAL_MS = 5000;
const isInFlight = (request: ExternalRequestReview) =>
  request.status === 'approved' || request.status === 'processing';

export interface ExternalRequestFilters {
  status: string;
  apiKeyId: string;
  requestType: string;
}

const EMPTY_FILTERS: ExternalRequestFilters = { status: '', apiKeyId: '', requestType: '' };

const EMPTY_PAGE: ExternalRequestReviewPage = {
  data: [],
  pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 },
  filterOptions: { requesters: [] },
};

export function useExternalRequests(token: string) {
  const [filters, setFilters] = useState<ExternalRequestFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // silent reloads (background polls) keep the current rows on screen.
  const [reload, setReload] = useState({ count: 0, silent: false });
  const loadSequence = useRef(0);
  const refresh = useCallback(() => setReload((current) => ({ count: current.count + 1, silent: false })), []);
  const review = useRequestReview(token, refresh);
  const { syncFromList } = review;

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++loadSequence.current;
    const current = () => sequence === loadSequence.current && !controller.signal.aborted;
    if (!reload.silent) {
      setLoading(true);
      setError(null);
    }
    axios
      .get<ExternalRequestReviewPage>('/api/external-requests', {
        headers: { 'x-access-token': token },
        params: {
          page,
          pageSize: PAGE_SIZE,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.apiKeyId ? { apiKeyId: filters.apiKeyId } : {}),
          ...(filters.requestType ? { requestType: filters.requestType } : {}),
        },
        signal: controller.signal,
      })
      .then((response) => {
        if (!current()) return;
        // A review action can empty the last page; step back to the new last page.
        const totalPages = Math.max(1, response.data.pagination.totalPages);
        if (page > totalPages) {
          setPage(totalPages);
          return;
        }
        setData(response.data);
        syncFromList(response.data.data);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!current() || axios.isCancel(loadError)) return;
        // A failed background poll keeps the rows shown and tries again on the next tick.
        if (reload.silent) {
          setData((previous) => ({ ...previous }));
          return;
        }
        setError(requestError(loadError, 'Unable to load requests'));
        setLoading(false);
      });
    return () => controller.abort();
  }, [filters.apiKeyId, filters.requestType, filters.status, page, reload, syncFromList, token]);

  const hasInFlight = data.data.some(isInFlight);
  useEffect(() => {
    if (!hasInFlight || loading || error) return undefined;
    const poll = () => {
      if (document.visibilityState === 'hidden') return;
      setReload((current) => ({ count: current.count + 1, silent: true }));
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') poll();
    };
    const timer = setTimeout(poll, ACTIVE_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [data, error, hasInFlight, loading]);

  const setFilter = useCallback((name: keyof ExternalRequestFilters, value: string) => {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }, []);

  return {
    requests: data.data,
    requesters: data.filterOptions.requesters,
    page,
    totalPages: Math.max(1, data.pagination.totalPages),
    loading,
    error,
    filters,
    setPage,
    setFilter,
    refresh,
    ...review,
  };
}
