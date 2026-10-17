import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ExternalRequestReviewPage } from '../../../types/externalRequest';
import { useRequestReview } from './useRequestReview';
import { requestError } from '../requestPolicy';

export type { ReviewAction } from '../requestPolicy';
export interface ExternalRequestFilters {
  status: string;
  apiKeyId: string;
  requestType: string;
}
const EMPTY_PAGE: ExternalRequestReviewPage = {
  data: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
  filterOptions: { requesters: [] },
};

export function useExternalRequests(token: string) {
  const [filters, setFilters] = useState<ExternalRequestFilters>({ status: '', apiKeyId: '', requestType: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(EMPTY_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const loadSequence = useRef(0);
  const refresh = useCallback(() => setReloadToken(value => value + 1), []);
  const review = useRequestReview(token, refresh);

  useEffect(() => {
    const controller = new AbortController();
    const sequence = ++loadSequence.current;
    const current = () => sequence === loadSequence.current && !controller.signal.aborted;
    setLoading(true);
    setError(null);
    void axios.get<ExternalRequestReviewPage>('/api/external-requests', {
      headers: { 'x-access-token': token },
      params: {
        page, pageSize: 25,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.apiKeyId ? { apiKeyId: filters.apiKeyId } : {}),
        ...(filters.requestType ? { requestType: filters.requestType } : {}),
      },
      signal: controller.signal,
    }).then(response => {
      if (!current()) return;
      const totalPages = Math.max(1, response.data.pagination.totalPages);
      if (page > totalPages) {
        setPage(totalPages);
        return;
      }
      setData(response.data);
      setLoading(false);
    }).catch(loadError => {
      if (!current() || axios.isCancel(loadError)) return;
      setError(requestError(loadError, 'Unable to load requests'));
      setLoading(false);
    });
    return () => controller.abort();
  }, [filters.apiKeyId, filters.requestType, filters.status, page, reloadToken, token]);

  const setFilter = useCallback((name: keyof ExternalRequestFilters, value: string) => {
    setFilters(current => ({ ...current, [name]: value }));
    setPage(1);
  }, []);

  return {
    requests: data.data, requesters: data.filterOptions.requesters,
    page, totalPages: Math.max(1, data.pagination.totalPages), loading, error, filters,
    setPage, setFilter, refresh, ...review,
  };
}
