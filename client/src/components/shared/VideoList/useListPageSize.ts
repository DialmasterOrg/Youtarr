import { useState, useCallback } from 'react';
import {
  ALLOWED_PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  isPageSize,
  type PageSize,
} from './pageSizes';

function readStoredPageSize(storageKey: string): PageSize {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return DEFAULT_PAGE_SIZE;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
    if (!isPageSize(parsed)) return DEFAULT_PAGE_SIZE;
    return parsed;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function useListPageSize(storageKey: string): [PageSize, (next: PageSize) => void] {
  const [pageSize, setPageSizeState] = useState<PageSize>(() => readStoredPageSize(storageKey));

  const setPageSize = useCallback(
    (next: PageSize) => {
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // localStorage may be unavailable (private mode, quota); keep in-memory value
      }
      setPageSizeState(next);
    },
    [storageKey]
  );

  return [pageSize, setPageSize];
}

export { ALLOWED_PAGE_SIZES, DEFAULT_PAGE_SIZE };
export type { PageSize };
