import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

export const ARR_LIST_PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;

export interface ArrPagedListSource {
  url: string;
  /** The field of the answer that holds the rows. */
  itemsKey: string;
  errorMessage: string;
}

export interface ArrPagedList<T> {
  items: T[];
  /** How many rows match, on all pages. */
  total: number;
  page: number;
  pageSize: number;
  /** The search text as typed; the list follows once typing pauses. */
  query: string;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setQuery: (query: string) => void;
  refresh: () => void;
}

type PagedAnswer = Record<string, unknown>;

/**
 * One page of a Sonarr/Radarr bridge list, with a search text. Loaded when
 * enabled, on a page or search change and on refresh; it does not poll.
 * @param source - Where the list comes from; pass a constant
 * @param token - Session token
 * @param enabled - Whether to load it
 */
export function useArrBridgePagedList<T>(
  { url, itemsKey, errorMessage }: ArrPagedListSource,
  token: string | null,
  enabled: boolean
): ArrPagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const wanted = query.trim();
    if (wanted === appliedQuery) return undefined;
    const timer = setTimeout(() => {
      setAppliedQuery(wanted);
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, appliedQuery]);

  useEffect(() => {
    if (!token || !enabled) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get<PagedAnswer>(url, {
        headers: { 'x-access-token': token },
        params: { page, pageSize: ARR_LIST_PAGE_SIZE, ...(appliedQuery ? { q: appliedQuery } : {}) },
      })
      .then((response) => {
        if (cancelled) return;
        const list = response.data[itemsKey];
        const rows = Array.isArray(list) ? (list as T[]) : [];
        const count = typeof response.data.total === 'number' ? response.data.total : rows.length;
        const lastPage = Math.max(1, Math.ceil(count / ARR_LIST_PAGE_SIZE));
        // Rows were removed since the page was chosen: show the last one there is.
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setItems(rows);
        setTotal(count);
      })
      .catch(() => {
        if (!cancelled) setError(errorMessage);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, enabled, url, itemsKey, errorMessage, page, appliedQuery, reloadCount]);

  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

  return {
    items, total, page, pageSize: ARR_LIST_PAGE_SIZE, query, loading, error, setPage, setQuery, refresh,
  };
}
