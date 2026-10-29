import { useCallback, useState } from 'react';

const STORAGE_KEY = 'youtarr:libraryGuideOpen';

function readStored(): boolean | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'true' ? true : value === 'false' ? false : null;
  } catch {
    return null;
  }
}

function writeStored(open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    // Storage blocked: the toggle still works for this visit.
  }
}

/**
 * The guide's open state: an explicit toggle, remembered per browser, wins over the default. The default
 * is taken once, when it is first known (null until the folders load), so the guide doesn't fold mid-visit.
 */
export function useGuideOpen(defaultOpen: boolean | null): [boolean, () => void] {
  const [stored, setStored] = useState<boolean | null>(readStored);
  const [decided, setDecided] = useState<boolean | null>(defaultOpen);
  if (decided === null && defaultOpen !== null) setDecided(defaultOpen);
  const open = stored ?? decided ?? defaultOpen ?? false;
  const toggle = useCallback(() => {
    const next = !open;
    setStored(next);
    writeStored(next);
  }, [open]);
  return [open, toggle];
}
