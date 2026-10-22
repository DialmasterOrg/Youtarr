import { useState, useCallback } from 'react';
import type { ChipFilterMode } from './types';

const MODES: ChipFilterMode[] = ['off', 'only', 'exclude'];

function readStoredMode(storageKey: string, defaultValue: ChipFilterMode): ChipFilterMode {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw !== null && (MODES as string[]).includes(raw) ? (raw as ChipFilterMode) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// A tri-state chip filter remembered in this browser, for a filter whose
// resting value is a choice the user made (e.g. "show deleted videos").
export function usePersistedChipFilter(
  storageKey: string,
  defaultValue: ChipFilterMode
): [ChipFilterMode, (next: ChipFilterMode) => void] {
  const [mode, setModeState] = useState<ChipFilterMode>(() => readStoredMode(storageKey, defaultValue));

  const setMode = useCallback(
    (next: ChipFilterMode) => {
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // localStorage may be unavailable (private mode, quota); keep in-memory value
      }
      setModeState(next);
    },
    [storageKey]
  );

  return [mode, setMode];
}
