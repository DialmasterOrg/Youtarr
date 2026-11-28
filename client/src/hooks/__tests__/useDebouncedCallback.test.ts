import { renderHook } from '@testing-library/react';
import { useDebouncedCallback } from '../useDebouncedCallback';

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('runs the callback once after calls stop for the delay', () => {
    const callback = jest.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 1000));

    result.current();
    jest.advanceTimersByTime(600);
    result.current();
    jest.advanceTimersByTime(600);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('keeps one function identity and runs the latest callback', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = renderHook(
      ({ callback }: { callback: () => void }) => useDebouncedCallback(callback, 1000),
      { initialProps: { callback: first } }
    );
    const run = result.current;

    run();
    rerender({ callback: second });
    jest.advanceTimersByTime(1000);

    expect(result.current).toBe(run);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('drops a pending run on unmount', () => {
    const callback = jest.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 1000));

    result.current();
    unmount();
    jest.advanceTimersByTime(1000);

    expect(callback).not.toHaveBeenCalled();
  });
});
