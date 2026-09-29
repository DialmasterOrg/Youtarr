import { act, renderHook } from '@testing-library/react';
import { useNow } from '../useNow';

const START = Date.parse('2026-09-28T12:00:00.000Z');

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('returns the current time', () => {
  const { result } = renderHook(() => useNow());
  expect(result.current).toBe(START);
});

test('advances once per tick', () => {
  const { result } = renderHook(() => useNow(1000));
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(result.current).toBe(START + 1000);
});

test('stops ticking after unmount', () => {
  const { unmount } = renderHook(() => useNow(1000));
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
