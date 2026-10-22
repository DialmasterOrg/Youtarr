import { useEffect, useState } from 'react';
import { DEFAULT_SORT, ResultSort, isSortKey } from '../sortResults';
import {
  DEFAULT_MIN_DURATION,
  MIN_DURATIONS,
  MIN_DURATION_STORAGE_KEY,
  MinDuration,
  ViewMode,
} from '../types';

export const VIEW_MODE_STORAGE_KEY = 'findVideos.viewMode';
export const SORT_STORAGE_KEY = 'findVideos.sort';
const DEFAULT_VIEW_MODE: ViewMode = 'table';

function readStored<T>(key: string, parse: (raw: string) => T | null, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (private mode, quota); the choice still holds in-session.
  }
}

function parseViewMode(raw: string): ViewMode | null {
  return raw === 'table' || raw === 'grid' ? raw : null;
}

function parseSort(raw: string): ResultSort | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { key, direction } = parsed as { key?: unknown; direction?: unknown };
    if (!isSortKey(key)) return null;
    if (direction !== 'asc' && direction !== 'desc') return null;
    return { key, direction };
  } catch {
    return null;
  }
}

function parseMinDuration(raw: string): MinDuration | null {
  const parsed = Number(raw) as MinDuration;
  return MIN_DURATIONS.includes(parsed) ? parsed : null;
}

export interface FindVideosPreferences {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sort: ResultSort;
  setSort: (sort: ResultSort) => void;
  minDuration: MinDuration;
  setMinDuration: (minDuration: MinDuration) => void;
}

// The page's remembered choices: view, sort, and minimum duration survive reloads.
export function useFindVideosPreferences(): FindVideosPreferences {
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => readStored(VIEW_MODE_STORAGE_KEY, parseViewMode, DEFAULT_VIEW_MODE)
  );
  const [sort, setSort] = useState<ResultSort>(() => readStored(SORT_STORAGE_KEY, parseSort, DEFAULT_SORT));
  const [minDuration, setMinDuration] = useState<MinDuration>(
    () => readStored(MIN_DURATION_STORAGE_KEY, parseMinDuration, DEFAULT_MIN_DURATION)
  );

  useEffect(() => { writeStored(VIEW_MODE_STORAGE_KEY, viewMode); }, [viewMode]);
  useEffect(() => { writeStored(SORT_STORAGE_KEY, JSON.stringify(sort)); }, [sort]);
  useEffect(() => { writeStored(MIN_DURATION_STORAGE_KEY, String(minDuration)); }, [minDuration]);

  return { viewMode, setViewMode, sort, setSort, minDuration, setMinDuration };
}
