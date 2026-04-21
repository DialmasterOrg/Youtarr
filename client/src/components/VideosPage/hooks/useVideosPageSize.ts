import { useState, useCallback } from 'react';
import {
  ALLOWED_PAGE_SIZES,
  DEFAULT_PAGE_SIZE,
  isPageSize,
  type PageSize,
} from '../../shared/VideoList/pageSizes';

const STORAGE_KEY = 'youtarr.videosPage.pageSize';

function readStoredPageSize(): PageSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_PAGE_SIZE;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
    if (!isPageSize(parsed)) return DEFAULT_PAGE_SIZE;
    return parsed;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function useVideosPageSize(): [PageSize, (next: PageSize) => void] {
  const [pageSize, setPageSizeState] = useState<PageSize>(readStoredPageSize);

  const setPageSize = useCallback((next: PageSize) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // localStorage may be unavailable (private mode, quota); keep in-memory value
    }
    setPageSizeState(next);
  }, []);

  return [pageSize, setPageSize];
}

export { ALLOWED_PAGE_SIZES, DEFAULT_PAGE_SIZE };
export type { PageSize };
