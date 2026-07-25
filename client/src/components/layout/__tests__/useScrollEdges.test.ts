import { renderHook, act } from '@testing-library/react';
import { useScrollEdges } from '../useScrollEdges';

interface ScrollMetrics {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft?: number;
}

function createScrollElement({ scrollWidth, clientWidth, scrollLeft = 0 }: ScrollMetrics): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
  el.scrollLeft = scrollLeft;
  return el;
}

describe('useScrollEdges', () => {
  it('reports no scrollable edges when content fits the container', () => {
    const el = createScrollElement({ scrollWidth: 300, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());

    act(() => {
      result.current.scrollRef(el);
    });

    expect(result.current.canScrollLeft).toBe(false);
    expect(result.current.canScrollRight).toBe(false);
  });

  it('reports only a right edge when content overflows and is scrolled to the start', () => {
    const el = createScrollElement({ scrollWidth: 500, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());

    act(() => {
      result.current.scrollRef(el);
    });

    expect(result.current.canScrollLeft).toBe(false);
    expect(result.current.canScrollRight).toBe(true);
  });

  it('reports both edges when scrolled to the middle', () => {
    const el = createScrollElement({ scrollWidth: 500, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());

    act(() => {
      result.current.scrollRef(el);
    });
    act(() => {
      el.scrollLeft = 100;
      el.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.canScrollLeft).toBe(true);
    expect(result.current.canScrollRight).toBe(true);
  });

  it('reports only a left edge when scrolled to the end', () => {
    const el = createScrollElement({ scrollWidth: 500, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());

    act(() => {
      result.current.scrollRef(el);
    });
    act(() => {
      el.scrollLeft = 200;
      el.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.canScrollLeft).toBe(true);
    expect(result.current.canScrollRight).toBe(false);
  });

  it('re-reads dimensions when recompute is called after content changes', () => {
    const el = createScrollElement({ scrollWidth: 300, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());

    act(() => {
      result.current.scrollRef(el);
    });
    expect(result.current.canScrollRight).toBe(false);

    act(() => {
      Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 800 });
      result.current.recompute();
    });

    expect(result.current.canScrollRight).toBe(true);
  });

  it('resets both edges when the element detaches', () => {
    const el = createScrollElement({ scrollWidth: 500, clientWidth: 300 });
    const { result } = renderHook(() => useScrollEdges());

    act(() => {
      result.current.scrollRef(el);
    });
    expect(result.current.canScrollRight).toBe(true);

    act(() => {
      result.current.scrollRef(null);
    });

    expect(result.current.canScrollLeft).toBe(false);
    expect(result.current.canScrollRight).toBe(false);
  });

  it('stops listening to scroll events after unmount', () => {
    const el = createScrollElement({ scrollWidth: 500, clientWidth: 300 });
    const { result, unmount } = renderHook(() => useScrollEdges());

    act(() => {
      result.current.scrollRef(el);
    });
    const removeSpy = jest.spyOn(el, 'removeEventListener');

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
