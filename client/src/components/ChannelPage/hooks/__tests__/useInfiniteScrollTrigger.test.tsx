import React from 'react';
import { act, render } from '@testing-library/react';
import { useInfiniteScrollTrigger } from '../useInfiniteScrollTrigger';

type Props = Parameters<typeof useInfiniteScrollTrigger>[0];

interface FakeObserver {
  callback: IntersectionObserverCallback;
  disconnect: jest.Mock;
}

describe('useInfiniteScrollTrigger', () => {
  const originalIntersectionObserver = window.IntersectionObserver;
  let observers: FakeObserver[];
  let onLoadNextPage: jest.Mock;

  function Harness(props: Props) {
    const sentinelRef = useInfiniteScrollTrigger(props);
    return <div ref={sentinelRef} />;
  }

  const baseProps = (): Props => ({
    enabled: true,
    loading: false,
    hasNextPage: true,
    onLoadNextPage,
  });

  const renderTrigger = (props: Partial<Props> = {}) => render(<Harness {...baseProps()} {...props} />);

  // What the newest observer is told about the sentinel.
  const sentinelIs = (state: 'in range' | 'out of range') => {
    const entry = { isIntersecting: state === 'in range' } as IntersectionObserverEntry;
    const observer = observers[observers.length - 1];
    act(() => observer.callback([entry], observer as unknown as IntersectionObserver));
  };

  // The page that was asked for loads: loading turns on, then off again.
  const pageLoads = (rerender: (ui: React.ReactElement) => void) => {
    rerender(<Harness {...baseProps()} loading />);
    rerender(<Harness {...baseProps()} />);
  };

  beforeEach(() => {
    observers = [];
    onLoadNextPage = jest.fn();
    window.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
      const observer = { callback, observe: jest.fn(), disconnect: jest.fn() };
      observers.push(observer);
      return observer;
    }) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    window.IntersectionObserver = originalIntersectionObserver;
  });

  test('asks for the next page when the sentinel comes into range', () => {
    renderTrigger();

    sentinelIs('in range');

    expect(onLoadNextPage).toHaveBeenCalledTimes(1);
  });

  test('asks when a jump to the end of the list lands the sentinel well inside the viewport', () => {
    renderTrigger();
    const landedMidScreen = {
      isIntersecting: true,
      boundingClientRect: { bottom: 500 },
      rootBounds: { height: 1172 },
    } as unknown as IntersectionObserverEntry;

    act(() => observers[0].callback([landedMidScreen], observers[0] as unknown as IntersectionObserver));

    expect(onLoadNextPage).toHaveBeenCalledTimes(1);
  });

  test('does not ask while the sentinel is out of range', () => {
    renderTrigger();

    sentinelIs('out of range');

    expect(onLoadNextPage).not.toHaveBeenCalled();
  });

  test.each([
    ['infinite scroll is off', { enabled: false }],
    ['a page is loading', { loading: true }],
    ['the last page is loaded', { hasNextPage: false }],
  ])('does not watch the sentinel when %s', (_case, props) => {
    renderTrigger(props);

    expect(observers).toHaveLength(0);
  });

  test('asks only once before the page it asked for starts loading', () => {
    const { rerender } = renderTrigger();
    sentinelIs('in range');

    // The page number changed, the fetch has not started yet.
    rerender(<Harness {...baseProps()} />);
    sentinelIs('out of range');
    sentinelIs('in range');

    expect(onLoadNextPage).toHaveBeenCalledTimes(1);
  });

  test('asks for the page after it when the sentinel is still in range once the page has loaded', () => {
    const { rerender } = renderTrigger();
    sentinelIs('in range');

    pageLoads(rerender);
    sentinelIs('in range');

    expect(onLoadNextPage).toHaveBeenCalledTimes(2);
  });

  test('does not ask again after a page loads while the sentinel is out of range', () => {
    const { rerender } = renderTrigger();
    sentinelIs('in range');

    pageLoads(rerender);
    sentinelIs('out of range');

    expect(onLoadNextPage).toHaveBeenCalledTimes(1);
  });

  test('stops watching the sentinel on unmount', () => {
    const { unmount } = renderTrigger();

    unmount();

    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
