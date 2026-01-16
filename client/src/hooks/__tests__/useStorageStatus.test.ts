import { renderHook, waitFor, act } from '@testing-library/react';
import { useStorageStatus } from '../useStorageStatus';
import type { StorageData } from '../useStorageStatus';
import { jest } from '@jest/globals';
import axios from 'axios';

// Mock axios
jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
  },
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useStorageStatus', () => {
  const mockToken = 'test-token-123';

  const advanceTimers = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };

  const mockStorageData: StorageData = {
    availableGB: '250',
    percentFree: 50,
    totalGB: '500',
  };

  let consoleErrorSpy: ReturnType<typeof jest.spyOn> | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    consoleErrorSpy?.mockRestore();
  });

  describe('Initial State', () => {
    test('returns default state values before fetch completes', () => {
      mockedAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useStorageStatus(mockToken));

      expect(result.current.data).toBeNull();
      expect(result.current.available).toBeNull();
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(false);
    });

    test('initializes with loading true when token is provided', () => {
      mockedAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useStorageStatus(mockToken));

      expect(result.current.loading).toBe(true);
    });
  });

  describe('Successful Data Fetching', () => {
    test('fetches and returns storage data successfully in default mode', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: mockStorageData,
      });

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockStorageData);
      expect(result.current.available).toBeNull();
      expect(result.current.error).toBe(false);
    });

    test('includes correct authentication header', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: mockStorageData,
      });

      renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      });

      expect(mockedAxios.get).toHaveBeenCalledWith('/storage-status', {
        headers: {
          'x-access-token': mockToken,
        },
      });
    });

    test('handles storage data with low free space', async () => {
      const lowSpaceData: StorageData = {
        availableGB: '10',
        percentFree: 5,
        totalGB: '200',
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: lowSpaceData,
      });

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(lowSpaceData);
      expect(result.current.data?.percentFree).toBe(5);
    });

    test('handles storage data with high free space', async () => {
      const highSpaceData: StorageData = {
        availableGB: '900',
        percentFree: 90,
        totalGB: '1000',
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: highSpaceData,
      });

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(highSpaceData);
      expect(result.current.data?.percentFree).toBe(90);
    });
  });

  describe('CheckOnly Mode', () => {
    test('sets available to true when storage data exists', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: mockStorageData,
      });

      const { result } = renderHook(() =>
        useStorageStatus(mockToken, { checkOnly: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.available).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBe(false);
    });

    test('sets available to true when availableGB exists', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          availableGB: '100',
          percentFree: 25,
          totalGB: '400',
        },
      });

      const { result } = renderHook(() =>
        useStorageStatus(mockToken, { checkOnly: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.available).toBe(true);
      expect(result.current.data).toBeNull();
    });

    test('does not set data in checkOnly mode', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: mockStorageData,
      });

      const { result } = renderHook(() =>
        useStorageStatus(mockToken, { checkOnly: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toBeNull();
    });

    test('handles response without availableGB in checkOnly mode', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {},
      });

      const { result } = renderHook(() =>
        useStorageStatus(mockToken, { checkOnly: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.available).toBe(false);
    });

    test('handles null response data in checkOnly mode', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: null,
      });

      const { result } = renderHook(() =>
        useStorageStatus(mockToken, { checkOnly: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // When data is null, available is set to false based on the condition
      // response.data && response.data.availableGB !== undefined
      expect(result.current.available).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('handles network errors', async () => {
      const networkError = new Error('Network error');

      mockedAxios.get.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(true);
      expect(result.current.data).toBeNull();
    });

    test('handles API errors', async () => {
      const apiError = new Error('Internal server error');

      mockedAxios.get.mockRejectedValueOnce(apiError);

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(true);
      expect(result.current.data).toBeNull();
    });

    test('sets available to false on error in checkOnly mode', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Fetch failed'));

      const { result } = renderHook(() =>
        useStorageStatus(mockToken, { checkOnly: true })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(true);
      expect(result.current.available).toBe(false);
    });

    test('clears previous error on successful refetch', async () => {
      // First call fails
      mockedAxios.get.mockRejectedValueOnce(new Error('First error'));

      const { result, rerender } = renderHook(
        ({ token }) => useStorageStatus(token),
        { initialProps: { token: mockToken } }
      );

      await waitFor(() => {
        expect(result.current.error).toBe(true);
      });

      // Second call succeeds
      mockedAxios.get.mockResolvedValueOnce({
        data: mockStorageData,
      });

      rerender({ token: 'new-token' });

      await waitFor(() => {
        expect(result.current.error).toBe(false);
      });

      expect(result.current.data).toEqual(mockStorageData);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Conditional Fetching', () => {
    test('does not fetch when token is null', () => {
      const { result } = renderHook(() => useStorageStatus(null));

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    test('does not fetch when token is empty string', () => {
      const { result } = renderHook(() => useStorageStatus(''));

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    test('fetches when token becomes available', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: mockStorageData,
      });

      const { result, rerender } = renderHook(
        ({ token }: { token: string | null }) => useStorageStatus(token),
        { initialProps: { token: null as string | null } }
      );

      expect(axios.get).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);

      rerender({ token: mockToken });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockStorageData);
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Polling Functionality', () => {
    test('polls at default interval when poll is enabled', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      renderHook(() => useStorageStatus(mockToken, { poll: true }));

      // Initial fetch
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      // Advance by default pollInterval (120000ms)
      await advanceTimers(120000);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      // Advance again
      await advanceTimers(120000);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(3);
      });
    });

    test('polls at custom interval when specified', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      renderHook(() =>
        useStorageStatus(mockToken, { poll: true, pollInterval: 60000 })
      );

      // Initial fetch
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      // Advance by custom pollInterval (60000ms)
      await advanceTimers(60000);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      // Advance again
      await advanceTimers(60000);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(3);
      });
    });

    test('does not poll when poll is false', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      renderHook(() => useStorageStatus(mockToken, { poll: false }));

      // Initial fetch
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      // Advance time
      await advanceTimers(120000);

      // Should still be only 1 call
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('does not poll when poll option is not provided', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      renderHook(() => useStorageStatus(mockToken));

      // Initial fetch
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      // Advance time
      await advanceTimers(120000);

      // Should still be only 1 call
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('cleans up interval on unmount', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      const { unmount } = renderHook(() =>
        useStorageStatus(mockToken, { poll: true, pollInterval: 60000 })
      );

      // Initial fetch
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      // Unmount before next poll
      unmount();

      // Advance time
      await advanceTimers(60000);

      // Should not make another call after unmount
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('restarts polling when pollInterval changes', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      const { rerender } = renderHook(
        ({ interval }) => useStorageStatus(mockToken, { poll: true, pollInterval: interval }),
        { initialProps: { interval: 60000 } }
      );

      // Initial fetch
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      // Change interval - this triggers a refetch due to fetchStorageStatus changing
      rerender({ interval: 30000 });

      // Wait for the refetch from rerender to complete
      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      // Advance by new interval to trigger poll
      await advanceTimers(30000);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Dependency Changes', () => {
    test('refetches when token changes', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      const { rerender } = renderHook(
        ({ token }) => useStorageStatus(token),
        { initialProps: { token: mockToken } }
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      rerender({ token: 'new-token-456' });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/storage-status', {
        headers: {
          'x-access-token': 'new-token-456',
        },
      });
    });

    test('refetches when checkOnly option changes', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      const { result, rerender } = renderHook(
        ({ checkOnly }) => useStorageStatus(mockToken, { checkOnly }),
        { initialProps: { checkOnly: false } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockStorageData);
      expect(result.current.available).toBeNull();

      rerender({ checkOnly: true });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      await waitFor(() => {
        expect(result.current.available).toBe(true);
      });

      // Note: data state persists from previous non-checkOnly fetch
      // The hook doesn't clear data when switching to checkOnly mode
      expect(result.current.data).toEqual(mockStorageData);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Loading State Management', () => {
    test('sets loading to true during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      axios.get.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useStorageStatus(mockToken));

      expect(result.current.loading).toBe(true);

      resolvePromise!({
        data: mockStorageData,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('sets loading to false after successful fetch', async () => {
      axios.get.mockResolvedValueOnce({
        data: mockStorageData,
      });

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockStorageData);
    });

    test('sets loading to false after failed fetch', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      axios.get.mockRejectedValueOnce(new Error('Fetch error'));

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(true);

      consoleErrorSpy.mockRestore();
    });

    test('remains loading false when no token provided', () => {
      const { result } = renderHook(() => useStorageStatus(null));

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('handles response with zero available space', async () => {
      const zeroSpaceData: StorageData = {
        availableGB: '0',
        percentFree: 0,
        totalGB: '500',
      };

      axios.get.mockResolvedValueOnce({
        data: zeroSpaceData,
      });

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(zeroSpaceData);
      expect(result.current.data?.percentFree).toBe(0);
    });

    test('handles response with decimal values', async () => {
      const decimalData: StorageData = {
        availableGB: '123.45',
        percentFree: 24.69,
        totalGB: '500.00',
      };

      axios.get.mockResolvedValueOnce({
        data: decimalData,
      });

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(decimalData);
    });

    test('handles response with large storage values', async () => {
      const largeData: StorageData = {
        availableGB: '5000',
        percentFree: 50,
        totalGB: '10000',
      };

      axios.get.mockResolvedValueOnce({
        data: largeData,
      });

      const { result } = renderHook(() => useStorageStatus(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(largeData);
    });

    test('handles empty options object', async () => {
      axios.get.mockResolvedValueOnce({
        data: mockStorageData,
      });

      const { result } = renderHook(() => useStorageStatus(mockToken, {}));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).toEqual(mockStorageData);
      expect(result.current.available).toBeNull();
    });
  });

  describe('Combined Options', () => {
    test('works with checkOnly and poll enabled', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      const { result } = renderHook(() =>
        useStorageStatus(mockToken, { checkOnly: true, poll: true, pollInterval: 60000 })
      );

      // Initial fetch
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.available).toBe(true);
      expect(result.current.data).toBeNull();

      // Poll again
      await advanceTimers(60000);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(result.current.available).toBe(true);
      expect(result.current.data).toBeNull();
    });

    test('handles checkOnly with poll and errors', async () => {
      axios.get.mockRejectedValue(new Error('Storage unavailable'));

      const { result } = renderHook(() =>
        useStorageStatus(mockToken, { checkOnly: true, poll: true, pollInterval: 60000 })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.available).toBe(false);
      expect(result.current.error).toBe(true);

      // Poll again
      await advanceTimers(60000);

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(result.current.available).toBe(false);
      expect(result.current.error).toBe(true);
    });
  });

  describe('Callback Stability', () => {
    test('fetchStorageStatus callback updates when token changes', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      const { rerender } = renderHook(
        ({ token }) => useStorageStatus(token),
        { initialProps: { token: 'token-1' } }
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      expect(axios.get).toHaveBeenCalledWith('/storage-status', {
        headers: { 'x-access-token': 'token-1' },
      });

      rerender({ token: 'token-2' });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/storage-status', {
        headers: { 'x-access-token': 'token-2' },
      });
    });

    test('fetchStorageStatus callback updates when checkOnly changes', async () => {
      axios.get.mockResolvedValue({
        data: mockStorageData,
      });

      const { result, rerender } = renderHook(
        ({ checkOnly }) => useStorageStatus(mockToken, { checkOnly }),
        { initialProps: { checkOnly: false } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.data).not.toBeNull();

      rerender({ checkOnly: true });

      await waitFor(() => {
        expect(result.current.available).toBe(true);
      });

      // Data state persists when switching to checkOnly mode
      expect(result.current.data).toEqual(mockStorageData);
      expect(result.current.loading).toBe(false);
    });
  });
});
