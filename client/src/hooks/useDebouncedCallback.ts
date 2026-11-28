import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a stable function that runs the latest `callback` once calls have
 * stopped for `delayMs`. A run still pending at unmount is dropped.
 */
export function useDebouncedCallback(callback: () => void, delayMs: number): () => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(), delayMs);
  }, [delayMs]);
}
