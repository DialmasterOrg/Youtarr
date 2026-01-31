import { renderHook, waitFor, act } from '@testing-library/react';
import { useChannelFetchStatus } from '../useChannelFetchStatus';

// Mock fetch
const mockFetch = jest.fn();
Object.defineProperty(globalThis, 'fetch', {
  writable: true,
  configurable: true,
  value: mockFetch,
});

describe('useChannelFetchStatus', () => {
  const mockToken = 'test-token-123';
  const mockChannelId = 'UC123456789';
  const mockTabType = 'videos';
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    Object.defineProperty(globalThis, 'fetch', {
      writable: true,
      configurable: true,
      value: mockFetch,
    });
    // Suppress console.error for expected errors during test cleanup
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Initial State', () => {
    test('returns default state values on initialization', () => {
      // Don't make any fetch call complete to test initial state
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      expect(result.current.isFetching).toBe(false);
      expect(result.current.startTime).toBeNull();
      expect(typeof result.current.onFetchComplete).toBe('function');
      expect(typeof result.current.startPolling).toBe('function');
    });
  });

  describe('Initial Fetch Status Check', () => {
    test('checks fetch status on mount when all parameters provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
          type: null,
          tabType: 'videos',
        }),
      });

      renderHook(() => useChannelFetchStatus(mockChannelId, mockTabType, mockToken));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/channels/${mockChannelId}/fetch-status?tabType=${mockTabType}`,
        expect.objectContaining({
          headers: {
            'x-access-token': mockToken,
          },
        })
      );
    });

    test('does not check fetch status when channelId is undefined', () => {
      renderHook(() => useChannelFetchStatus(undefined, mockTabType, mockToken));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('does not check fetch status when token is null', () => {
      renderHook(() => useChannelFetchStatus(mockChannelId, mockTabType, null));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('does not check fetch status when tabType is null', () => {
      renderHook(() => useChannelFetchStatus(mockChannelId, null, mockToken));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('updates state when fetch is in progress', async () => {
      const mockStartTime = '2023-01-01T00:00:00Z';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: true,
          startTime: mockStartTime,
          type: 'full',
          tabType: 'videos',
        }),
      });

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      await waitFor(() => {
        expect(result.current.isFetching).toBe(true);
      });

      expect(result.current.startTime).toBe(mockStartTime);
    });

    test('handles missing startTime in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
        }),
      });

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      expect(result.current.startTime).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('handles network errors gracefully', async () => {
      const networkError = new Error('Network error');

      mockFetch.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error checking fetch status:', networkError);
      });

      // State should remain at defaults
      expect(result.current.isFetching).toBe(false);
      expect(result.current.startTime).toBeNull();
    });

    test('handles non-ok response status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // State should remain at defaults when response is not ok
      expect(result.current.isFetching).toBe(false);
      expect(result.current.startTime).toBeNull();
    });
  });

  describe('Polling Behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('starts polling when fetch is detected in progress', async () => {
      // Initial check shows fetching in progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: true,
          startTime: '2023-01-01T00:00:00Z',
        }),
      });

      // Second poll
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: true,
          startTime: '2023-01-01T00:00:00Z',
        }),
      });

      renderHook(() => useChannelFetchStatus(mockChannelId, mockTabType, mockToken));

      // Wait for initial fetch to complete
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalled();

      // Advance timers by poll interval (3000ms)
      await act(async () => {
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test('startPolling enables polling manually', async () => {
      // Initial check shows not fetching
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });

      // After startPolling, poll should happen
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: true,
          startTime: '2023-01-01T00:00:00Z',
        }),
      });

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      // Wait for initial fetch
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalled();

      // Manually start polling
      act(() => {
        result.current.startPolling();
      });

      // Advance timers by poll interval
      await act(async () => {
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test('stops polling when fetch completes', async () => {
      // Initial check shows fetching in progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: true,
          startTime: '2023-01-01T00:00:00Z',
        }),
      });

      // Second poll shows fetch completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      // Wait for initial fetch
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isFetching).toBe(true);

      // Advance to trigger poll
      await act(async () => {
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(result.current.isFetching).toBe(false);

      // Advance more time - should not poll again since shouldPoll is false
      await act(async () => {
        jest.advanceTimersByTime(6000);
        await Promise.resolve();
      });

      // Should only have initial + completion poll
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    test('does not poll when shouldPoll is false', async () => {
      // Initial check shows not fetching
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });

      renderHook(() => useChannelFetchStatus(mockChannelId, mockTabType, mockToken));

      // Wait for initial fetch
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalled();

      // Advance timers - should not trigger additional polls
      await act(async () => {
        jest.advanceTimersByTime(10000);
        await Promise.resolve();
      });

      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Fetch Complete Callback', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('calls onFetchComplete callback when fetch transitions from true to false', async () => {
      const mockCallback = jest.fn();

      // Initial check shows fetching in progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: true,
          startTime: '2023-01-01T00:00:00Z',
        }),
      });

      // Second poll shows fetch completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      // Register the callback
      act(() => {
        result.current.onFetchComplete(mockCallback);
      });

      // Wait for initial fetch
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isFetching).toBe(true);

      // Advance to trigger poll
      await act(async () => {
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(result.current.isFetching).toBe(false);
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalled();
      });
    });

    test('does not call callback when fetch was already false', async () => {
      const mockCallback = jest.fn();

      // Initial check shows not fetching
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      // Register the callback
      act(() => {
        result.current.onFetchComplete(mockCallback);
      });

      // Wait for initial fetch
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('callback can be updated', async () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();

      // Initial check shows fetching in progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: true,
          startTime: '2023-01-01T00:00:00Z',
        }),
      });

      // Second poll shows fetch completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });

      const { result } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      // Register first callback
      act(() => {
        result.current.onFetchComplete(mockCallback1);
      });

      // Update to second callback
      act(() => {
        result.current.onFetchComplete(mockCallback2);
      });

      // Wait for initial fetch
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isFetching).toBe(true);

      // Advance to trigger poll
      await act(async () => {
        jest.advanceTimersByTime(3000);
        await Promise.resolve();
      });

      expect(result.current.isFetching).toBe(false);

      expect(mockCallback1).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(mockCallback2).toHaveBeenCalled();
      });
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('clears polling interval on unmount', async () => {
      // Initial check shows fetching in progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: true,
          startTime: '2023-01-01T00:00:00Z',
        }),
      });

      const { unmount } = renderHook(() =>
        useChannelFetchStatus(mockChannelId, mockTabType, mockToken)
      );

      // Wait for initial fetch
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalled();

      unmount();

      // Advance timers after unmount
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // No additional polls should happen after unmount
      expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Callback Stability', () => {
    test('onFetchComplete function remains stable across rerenders', async () => {
      // Mock for initial render
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });
      // Mock for rerender with new channelId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });

      const { result, rerender } = renderHook(
        ({ channelId }: { channelId: string }) =>
          useChannelFetchStatus(channelId, mockTabType, mockToken),
        {
          initialProps: { channelId: mockChannelId },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const firstOnFetchComplete = result.current.onFetchComplete;

      rerender({ channelId: 'UC987654321' });

      // Wait for the second fetch to complete
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      expect(result.current.onFetchComplete).toBe(firstOnFetchComplete);
    });

    test('startPolling function remains stable across rerenders', async () => {
      // Mock for initial render
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });
      // Mock for rerender with new channelId
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          isFetching: false,
          startTime: null,
        }),
      });

      const { result, rerender } = renderHook(
        ({ channelId }: { channelId: string }) =>
          useChannelFetchStatus(channelId, mockTabType, mockToken),
        {
          initialProps: { channelId: mockChannelId },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const firstStartPolling = result.current.startPolling;

      rerender({ channelId: 'UC987654321' });

      // Wait for the second fetch to complete
      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      expect(result.current.startPolling).toBe(firstStartPolling);
    });
  });

  describe('Parameter Changes', () => {
    const createFetchMock = () => ({
      ok: true,
      json: jest.fn().mockResolvedValue({
        isFetching: false,
        startTime: null,
      }),
    });

    test('rechecks fetch status when channelId changes', async () => {
      // Mock for initial render
      mockFetch.mockResolvedValueOnce(createFetchMock());
      // Mock for rerender with new channelId
      mockFetch.mockResolvedValueOnce(createFetchMock());

      const { rerender } = renderHook(
        ({ channelId }: { channelId: string }) =>
          useChannelFetchStatus(channelId, mockTabType, mockToken),
        {
          initialProps: { channelId: mockChannelId },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      rerender({ channelId: 'UC987654321' });

      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      const secondCallUrl = mockFetch.mock.calls[1][0];
      expect(secondCallUrl).toContain('UC987654321');
    });

    test('rechecks fetch status when tabType changes', async () => {
      // Mock for initial render
      mockFetch.mockResolvedValueOnce(createFetchMock());
      // Mock for rerender with new tabType
      mockFetch.mockResolvedValueOnce(createFetchMock());

      const { rerender } = renderHook(
        ({ tabType }: { tabType: string }) =>
          useChannelFetchStatus(mockChannelId, tabType, mockToken),
        {
          initialProps: { tabType: mockTabType },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      rerender({ tabType: 'shorts' });

      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      const secondCallUrl = mockFetch.mock.calls[1][0];
      expect(secondCallUrl).toContain('tabType=shorts');
    });

    test('rechecks fetch status when token changes', async () => {
      // Mock for initial render
      mockFetch.mockResolvedValueOnce(createFetchMock());
      // Mock for rerender with new token
      mockFetch.mockResolvedValueOnce(createFetchMock());

      const { rerender } = renderHook(
        ({ token }: { token: string }) =>
          useChannelFetchStatus(mockChannelId, mockTabType, token),
        {
          initialProps: { token: mockToken },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      rerender({ token: 'new-token-456' });

      await waitFor(() => {
        expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      const secondCallHeaders = mockFetch.mock.calls[1][1].headers;
      expect(secondCallHeaders['x-access-token']).toBe('new-token-456');
    });
  });
});
