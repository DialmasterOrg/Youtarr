import type { SortOption } from '../shared/VideoList/types';
import type { SearchResult } from './types';

export type SortKey = 'relevance' | 'title' | 'channel' | 'published' | 'duration' | 'views';
export type SortDirection = 'asc' | 'desc';

export interface ResultSort {
  key: SortKey;
  direction: SortDirection;
}

export const SORT_KEYS: SortKey[] = ['relevance', 'title', 'channel', 'published', 'duration', 'views'];

// Relevance is YouTube's own ranking, which the server preserves; it has no direction.
export const SORT_OPTIONS: (SortOption & { key: SortKey })[] = [
  { key: 'relevance', label: 'Relevance', undirected: true },
  { key: 'published', label: 'Published' },
  { key: 'views', label: 'Views' },
  { key: 'duration', label: 'Duration' },
  { key: 'title', label: 'Title' },
  { key: 'channel', label: 'Channel' },
];

export const DEFAULT_SORT: ResultSort = { key: 'relevance', direction: 'desc' };

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === 'string' && (SORT_KEYS as string[]).includes(value);
}

export function defaultDirectionFor(key: SortKey): SortDirection {
  return key === 'title' || key === 'channel' ? 'asc' : 'desc';
}

type Comparable = string | number | null;

function valueFor(result: SearchResult, key: Exclude<SortKey, 'relevance'>): Comparable {
  switch (key) {
    case 'title':
      return result.title.toLocaleLowerCase();
    case 'channel':
      return result.channelName.toLocaleLowerCase();
    case 'published':
      return result.publishedAt ? Date.parse(result.publishedAt) : null;
    case 'duration':
      return result.duration;
    case 'views':
      return result.viewCount;
  }
}

function compare(a: Comparable, b: Comparable): number {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  return (a as number) - (b as number);
}

// Stable; a missing value sorts last whichever way the rest is ordered.
export function sortResults<T extends SearchResult>(results: T[], key: SortKey, direction: SortDirection): T[] {
  if (key === 'relevance') return results.slice();
  const sign = direction === 'asc' ? 1 : -1;
  return results
    .map((result, index) => ({ result, index, value: valueFor(result, key) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return sign * compare(a.value, b.value) || a.index - b.index;
    })
    .map((entry) => entry.result);
}
