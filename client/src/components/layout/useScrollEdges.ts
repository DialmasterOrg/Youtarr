import { useCallback, useEffect, useState } from 'react';

// Sub-pixel scroll positions on high-DPI screens can leave scrollLeft a
// fraction short of the true edge; treat anything within this as "at the edge".
const SCROLL_EDGE_TOLERANCE_PX = 1;

interface ScrollEdgesState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

const NO_EDGES: ScrollEdgesState = { canScrollLeft: false, canScrollRight: false };

interface UseScrollEdgesResult extends ScrollEdgesState {
  scrollRef: (node: HTMLElement | null) => void;
  recompute: () => void;
}

// Tracks whether a horizontally scrollable element has more content beyond
// its left/right edges. Attach `scrollRef` to the scroll container; call
// `recompute` when the container's content changes without a scroll or
// resize (e.g. its children are swapped out).
export function useScrollEdges(): UseScrollEdgesResult {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [edges, setEdges] = useState<ScrollEdgesState>(NO_EDGES);

  const scrollRef = useCallback((el: HTMLElement | null) => setNode(el), []);

  const recompute = useCallback(() => {
    if (!node) {
      setEdges((prev) => (prev.canScrollLeft || prev.canScrollRight ? NO_EDGES : prev));
      return;
    }
    const canScrollLeft = node.scrollLeft > SCROLL_EDGE_TOLERANCE_PX;
    const canScrollRight = node.scrollLeft + node.clientWidth < node.scrollWidth - SCROLL_EDGE_TOLERANCE_PX;
    setEdges((prev) =>
      prev.canScrollLeft === canScrollLeft && prev.canScrollRight === canScrollRight
        ? prev
        : { canScrollLeft, canScrollRight }
    );
  }, [node]);

  useEffect(() => {
    recompute();
    if (!node) {
      return;
    }

    node.addEventListener('scroll', recompute, { passive: true });

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(recompute);
      observer.observe(node);
    } else {
      window.addEventListener('resize', recompute);
    }

    return () => {
      node.removeEventListener('scroll', recompute);
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', recompute);
      }
    };
  }, [node, recompute]);

  return { scrollRef, recompute, ...edges };
}
