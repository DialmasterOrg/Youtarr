import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { useContainerWidth } from '../useContainerWidth';

function Probe() {
  const [ref, width] = useContainerWidth<HTMLDivElement>();
  return <div ref={ref}>{width === null ? 'unmeasured' : `width ${width}`}</div>;
}

describe('useContainerWidth', () => {
  let observed: ResizeObserverCallback | null = null;
  const originalObserver = global.ResizeObserver;

  beforeEach(() => {
    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 800 } as DOMRect);
    global.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) { observed = callback; }
      observe() {}
      disconnect() {}
      unobserve() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    global.ResizeObserver = originalObserver;
    observed = null;
  });

  test('measures on mount and follows resizes', () => {
    render(<Probe />);
    expect(screen.getByText('width 800')).toBeInTheDocument();

    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1100 } as DOMRect);
    act(() => { observed?.([], {} as ResizeObserver); });

    expect(screen.getByText('width 1100')).toBeInTheDocument();
  });

  test('still measures once without ResizeObserver', () => {
    // @ts-expect-error simulate a browser without ResizeObserver
    global.ResizeObserver = undefined;
    render(<Probe />);
    expect(screen.getByText('width 800')).toBeInTheDocument();
  });
});
