import { useState, useEffect } from 'react';

/**
 * Drop-in replacement for MUI's useMediaQuery.
 * Accepts a media query string like '(min-width:600px)' or MUI theme breakpoint
 * short-hands like '@media (min-width:600px)'.
 */
export function useMediaQuery(query: string): boolean {
  // Normalise MUI-style '@media ...' prefix
  const normalised = query.startsWith('@media ')
    ? query.slice('@media '.length).trim()
    : query;

  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(normalised).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(normalised);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [normalised]);

  return matches;
}

export default useMediaQuery;

// Common breakpoint helpers matching MUI defaults
export const breakpoints = {
  up: (bp: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
    const map = { xs: '0px', sm: '600px', md: '900px', lg: '1200px', xl: '1536px' };
    return `(min-width:${map[bp]})`;
  },
  down: (bp: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => {
    const map = { xs: '599.95px', sm: '899.95px', md: '1199.95px', lg: '1535.95px', xl: '9999px' };
    return `(max-width:${map[bp]})`;
  },
};
