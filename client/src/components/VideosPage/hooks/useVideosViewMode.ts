import { useCallback, useEffect, useState } from 'react';

export type VideosViewMode = 'table' | 'grid';

const STORAGE_KEY = 'youtarr:videosPageViewMode';

function readStored(): VideosViewMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'table' || raw === 'grid') return raw;
    return null;
  } catch {
    return null;
  }
}

function defaultForViewport(isMobile: boolean): VideosViewMode {
  return isMobile ? 'table' : 'grid';
}

export function useVideosViewMode(isMobile: boolean): [VideosViewMode, (mode: VideosViewMode) => void] {
  const [viewMode, setViewModeState] = useState<VideosViewMode>(() => {
    const stored = readStored();
    return stored ?? defaultForViewport(isMobile);
  });

  useEffect(() => {
    if (readStored() === null) {
      setViewModeState(defaultForViewport(isMobile));
    }
  }, [isMobile]);

  const setViewMode = useCallback((mode: VideosViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // ignore storage failures (private mode, quota)
      }
    }
  }, []);

  return [viewMode, setViewMode];
}
