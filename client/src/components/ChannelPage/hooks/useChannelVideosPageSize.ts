import { useState, useCallback } from 'react';

const STORAGE_KEY = 'youtarr.channelVideos.pageSize';
const ALLOWED_PAGE_SIZES = [8, 16, 32, 64, 128] as const;
const DEFAULT_PAGE_SIZE = 16;

type PageSize = (typeof ALLOWED_PAGE_SIZES)[number];

function readStoredPageSize(): PageSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_PAGE_SIZE;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
    if (!(ALLOWED_PAGE_SIZES as readonly number[]).includes(parsed)) return DEFAULT_PAGE_SIZE;
    return parsed as PageSize;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function useChannelVideosPageSize(): [PageSize, (next: PageSize) => void] {
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
