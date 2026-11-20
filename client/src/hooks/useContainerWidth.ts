import { useCallback, useEffect, useState } from 'react';

/**
 * The measured width of an element, kept current with a ResizeObserver, for
 * layouts that switch on the space they get (an expanded sidebar, a theme's
 * wider chrome) rather than on the viewport. Measure an element without
 * padding: the width is its border box. null until measured.
 */
export function useContainerWidth<T extends HTMLElement>(): [(node: T | null) => void, number | null] {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const ref = useCallback((element: T | null) => setNode(element), []);

  useEffect(() => {
    if (!node) return undefined;
    const measure = () => setWidth(node.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [ref, width];
}

export default useContainerWidth;
