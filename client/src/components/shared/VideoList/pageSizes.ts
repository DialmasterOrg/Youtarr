export const ALLOWED_PAGE_SIZES = [8, 16, 32, 64, 128] as const;
export const DEFAULT_PAGE_SIZE = 16;
export const INFINITE_SCROLL_FETCH_SIZE = 16;

export type PageSize = (typeof ALLOWED_PAGE_SIZES)[number];

export function isPageSize(value: number): value is PageSize {
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(value);
}
