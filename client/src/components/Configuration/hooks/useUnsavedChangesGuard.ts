import { useCallback, useEffect, useRef, useState } from 'react';

interface UseUnsavedChangesGuardArgs {
  enabled: boolean;
  shouldBlock: (targetUrl: string) => boolean;
}

interface UseUnsavedChangesGuardResult {
  pendingNav: string | null;
  confirmNav: () => void;
  cancelNav: () => void;
}

// Intercepts SPA navigation (history.pushState/replaceState) and browser unload
// while `enabled` is true. We patch history methods because react-router 6.11 is
// configured with <BrowserRouter>, not the data-router setup that `useBlocker`
// requires. Browser back/forward (popstate) is intentionally not intercepted.
export function useUnsavedChangesGuard({
  enabled,
  shouldBlock,
}: UseUnsavedChangesGuardArgs): UseUnsavedChangesGuardResult {
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  const enabledRef = useRef(enabled);
  const shouldBlockRef = useRef(shouldBlock);
  const bypassRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    shouldBlockRef.current = shouldBlock;
  }, [shouldBlock]);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const wrap = (
      original: typeof originalPushState
    ): typeof originalPushState => {
      return function patched(this: History, ...args) {
        const url = args[2];
        const targetUrl = typeof url === 'string' ? url : url ? url.toString() : '';

        if (
          bypassRef.current ||
          !enabledRef.current ||
          !shouldBlockRef.current(targetUrl)
        ) {
          return original.apply(this, args);
        }

        setPendingNav(targetUrl);
      };
    };

    window.history.pushState = wrap(originalPushState);
    window.history.replaceState = wrap(originalReplaceState);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);

  const confirmNav = useCallback(() => {
    setPendingNav((current) => {
      if (current === null) return null;
      bypassRef.current = true;
      try {
        window.history.pushState(null, '', current);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } finally {
        bypassRef.current = false;
      }
      return null;
    });
  }, []);

  const cancelNav = useCallback(() => {
    setPendingNav(null);
  }, []);

  return { pendingNav, confirmNav, cancelNav };
}
