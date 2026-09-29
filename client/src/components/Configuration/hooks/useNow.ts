import { useEffect, useState } from 'react';

const DEFAULT_TICK_MS = 60_000;

// The current time, re-read every tickMs so relative labels ("in 5m") stay
// current between data refreshes.
export function useNow(tickMs: number = DEFAULT_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(interval);
  }, [tickMs]);

  return now;
}
