import { useState } from 'react';

export type HeaderTrimId = 'christmas' | 'halloween' | 'july4';

export const HEADER_TRIM_QUERY_PARAM = 'trim';

const LEAD_DAYS = 7;
const MS_PER_DAY = 86_400_000;

interface TrimWindow {
  id: HeaderTrimId;
  month: number;
  day: number;
  language?: string;
}

const TRIM_WINDOWS: TrimWindow[] = [
  { id: 'july4', month: 7, day: 4, language: 'en-US' },
  { id: 'halloween', month: 10, day: 31 },
  { id: 'christmas', month: 12, day: 25 },
];

// Read once at load: a redirect or login can drop the query before the header mounts.
const INITIAL_SEARCH = typeof window === 'undefined' ? '' : window.location.search;

const isHeaderTrimId = (value: string | null): value is HeaderTrimId =>
  TRIM_WINDOWS.some((trimWindow) => trimWindow.id === value);

interface ResolveHeaderTrimInput {
  now: Date;
  search: string;
  language: string;
}

export function resolveHeaderTrim({ now, search, language }: ResolveHeaderTrimInput): HeaderTrimId | null {
  const params = new URLSearchParams(search);
  if (params.has(HEADER_TRIM_QUERY_PARAM)) {
    const forced = params.get(HEADER_TRIM_QUERY_PARAM);
    return isHeaderTrimId(forced) ? forced : null;
  }

  const year = now.getFullYear();
  const today = Date.UTC(year, now.getMonth(), now.getDate());
  const active = TRIM_WINDOWS.find((trimWindow) => {
    if (trimWindow.language && trimWindow.language !== language) {
      return false;
    }
    const daysUntil = (Date.UTC(year, trimWindow.month - 1, trimWindow.day) - today) / MS_PER_DAY;
    return daysUntil >= 0 && daysUntil <= LEAD_DAYS;
  });

  return active ? active.id : null;
}

export function useHeaderTrim(): HeaderTrimId | null {
  const [trim] = useState(() =>
    resolveHeaderTrim({ now: new Date(), search: INITIAL_SEARCH, language: navigator.language })
  );
  return trim;
}
