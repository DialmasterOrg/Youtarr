import { renderHook, act } from '@testing-library/react';
import { useChannelVideoFilters } from '../useChannelVideoFilters';

describe('useChannelVideoFilters', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial State', () => {
    test('returns default filter values', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      expect(result.current.filters).toEqual({
        minDuration: null,
        maxDuration: null,
        dateFrom: null,
        dateTo: null,
      });
      expect(result.current.inputMinDuration).toBeNull();
      expect(result.current.inputMaxDuration).toBeNull();
      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.activeFilterCount).toBe(0);
    });
  });

  describe('Duration Filters with Debouncing', () => {
    test('updates inputMinDuration immediately but debounces filter update', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setMinDuration(5);
      });

      // Input updates immediately
      expect(result.current.inputMinDuration).toBe(5);
      // Filter not updated yet (debounced)
      expect(result.current.filters.minDuration).toBeNull();

      // Advance past debounce delay
      act(() => {
        jest.advanceTimersByTime(400);
      });

      expect(result.current.filters.minDuration).toBe(5);
    });

    test('updates inputMaxDuration immediately but debounces filter update', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setMaxDuration(60);
      });

      expect(result.current.inputMaxDuration).toBe(60);
      expect(result.current.filters.maxDuration).toBeNull();

      act(() => {
        jest.advanceTimersByTime(400);
      });

      expect(result.current.filters.maxDuration).toBe(60);
    });

    test('cancels previous debounce when setting new duration value', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setMinDuration(5);
      });

      // Advance partially
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Set new value before debounce completes
      act(() => {
        result.current.setMinDuration(10);
      });

      // Advance past original timeout
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Filter should not have old value
      expect(result.current.filters.minDuration).toBeNull();
      expect(result.current.inputMinDuration).toBe(10);

      // Complete new debounce
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(result.current.filters.minDuration).toBe(10);
    });
  });

  describe('Date Filters', () => {
    test('updates dateFrom immediately without debouncing', () => {
      const { result } = renderHook(() => useChannelVideoFilters());
      const testDate = new Date('2023-01-15');

      act(() => {
        result.current.setDateFrom(testDate);
      });

      expect(result.current.filters.dateFrom).toEqual(testDate);
    });

    test('updates dateTo immediately without debouncing', () => {
      const { result } = renderHook(() => useChannelVideoFilters());
      const testDate = new Date('2023-12-31');

      act(() => {
        result.current.setDateTo(testDate);
      });

      expect(result.current.filters.dateTo).toEqual(testDate);
    });
  });

  describe('clearAllFilters', () => {
    test('clears all filter values and input states', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      // Set various filters
      act(() => {
        result.current.setMinDuration(5);
        result.current.setMaxDuration(60);
        result.current.setDateFrom(new Date('2023-01-01'));
        result.current.setDateTo(new Date('2023-12-31'));
      });

      // Let debounces complete
      act(() => {
        jest.advanceTimersByTime(400);
      });

      // Verify filters are set
      expect(result.current.hasActiveFilters).toBe(true);

      // Clear all
      act(() => {
        result.current.clearAllFilters();
      });

      expect(result.current.filters).toEqual({
        minDuration: null,
        maxDuration: null,
        dateFrom: null,
        dateTo: null,
      });
      expect(result.current.inputMinDuration).toBeNull();
      expect(result.current.inputMaxDuration).toBeNull();
      expect(result.current.hasActiveFilters).toBe(false);
    });

    test('cancels pending debounce timers when clearing', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setMinDuration(5);
        result.current.setMaxDuration(60);
      });

      // Clear before debounce completes
      act(() => {
        result.current.clearAllFilters();
      });

      // Advance past debounce delay
      act(() => {
        jest.advanceTimersByTime(400);
      });

      // Filters should remain null
      expect(result.current.filters.minDuration).toBeNull();
      expect(result.current.filters.maxDuration).toBeNull();
    });
  });

  describe('hasActiveFilters', () => {
    test('returns true when minDuration is set', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setMinDuration(5);
        jest.advanceTimersByTime(400);
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    test('returns true when maxDuration is set', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setMaxDuration(60);
        jest.advanceTimersByTime(400);
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    test('returns true when dateFrom is set', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setDateFrom(new Date('2023-01-01'));
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    test('returns true when dateTo is set', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setDateTo(new Date('2023-12-31'));
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe('activeFilterCount', () => {
    test('counts duration as one filter even with both min and max', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setMinDuration(5);
        result.current.setMaxDuration(60);
        jest.advanceTimersByTime(400);
      });

      expect(result.current.activeFilterCount).toBe(1);
    });

    test('counts date range as one filter even with both from and to', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setDateFrom(new Date('2023-01-01'));
        result.current.setDateTo(new Date('2023-12-31'));
      });

      expect(result.current.activeFilterCount).toBe(1);
    });

    test('returns 2 when both duration and date filters are active', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setMinDuration(5);
        result.current.setDateFrom(new Date('2023-01-01'));
        jest.advanceTimersByTime(400);
      });

      expect(result.current.activeFilterCount).toBe(2);
    });

    test('returns 0 when no filters are active', () => {
      const { result } = renderHook(() => useChannelVideoFilters());

      expect(result.current.activeFilterCount).toBe(0);
    });
  });

  describe('Cleanup on Unmount', () => {
    test('clears pending timers on unmount', () => {
      const { result, unmount } = renderHook(() => useChannelVideoFilters());

      act(() => {
        result.current.setMinDuration(5);
        result.current.setMaxDuration(60);
      });

      // Unmount before debounce completes
      unmount();

      // Advancing timers should not cause issues
      act(() => {
        jest.advanceTimersByTime(400);
      });

      // No assertions needed - test passes if no errors thrown
    });
  });
});
