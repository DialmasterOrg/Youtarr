import { renderHook, waitFor, act } from '@testing-library/react';
import { useSubfolders } from '../useSubfolders';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useSubfolders', () => {
  const mockToken = 'test-token-123';
  const mockSubfolders = ['__Sports', '__Music', '__Tech'];

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for expected errors
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial State', () => {
    test('returns empty array when token is null', () => {
      const { result } = renderHook(() => useSubfolders(null));

      expect(result.current.subfolders).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('does not fetch when token is null', () => {
      renderHook(() => useSubfolders(null));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('starts loading when token is provided', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useSubfolders(mockToken));

      expect(result.current.loading).toBe(true);
    });
  });

  describe('Successful Data Fetching', () => {
    test('fetches and returns subfolders successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSubfolders),
      });

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual(mockSubfolders);
      expect(result.current.error).toBeNull();
    });

    test('includes correct authentication header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSubfolders),
      });

      renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/channels/subfolders', {
        headers: {
          'x-access-token': mockToken,
        },
      });
    });

    test('handles empty subfolders array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce([]),
      });

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    test('handles API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Not Found');
    });

    test('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
    });

    test('handles non-Error throw', async () => {
      mockFetch.mockRejectedValueOnce('String error');

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Unknown error');
    });
  });

  describe('Token Changes', () => {
    test('re-fetches when token changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSubfolders),
      });

      const { result, rerender } = renderHook(
        ({ token }: { token: string | null }) => useSubfolders(token),
        { initialProps: { token: mockToken } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Change to a different token
      rerender({ token: 'new-token' });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      expect(mockFetch).toHaveBeenLastCalledWith('/api/channels/subfolders', {
        headers: {
          'x-access-token': 'new-token',
        },
      });
    });

    test('does not fetch when token changes to null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSubfolders),
      });

      const { result, rerender } = renderHook(
        ({ token }: { token: string | null }) => useSubfolders(token),
        { initialProps: { token: mockToken } as { token: string | null } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Change to null token
      rerender({ token: null });

      // Should not have made another fetch call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Refetch Function', () => {
    test('refetch triggers a new API call', async () => {
      const firstResponse = ['__Sports'];
      const secondResponse = ['__Sports', '__Music'];

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(firstResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(secondResponse),
        });

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual(firstResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Call refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.current.subfolders).toEqual(secondResponse);
    });

    test('refetch sets loading state correctly', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        })
        .mockImplementationOnce(() => promise);

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Start refetch
      act(() => {
        result.current.refetch();
      });

      // Should be loading now
      expect(result.current.loading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('refetch does nothing when token is null', async () => {
      const { result } = renderHook(() => useSubfolders(null));

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('refetch clears previous error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      // Refetch successfully
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.subfolders).toEqual(mockSubfolders);
    });
  });

  describe('Loading State', () => {
    test('loading transitions correctly during successful fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockImplementationOnce(() => promise);

      const { result } = renderHook(() => useSubfolders(mockToken));

      // Should start loading
      expect(result.current.loading).toBe(true);
      expect(result.current.subfolders).toEqual([]);

      // Resolve the fetch
      await act(async () => {
        resolvePromise!({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSubfolders),
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual(mockSubfolders);
    });

    test('loading transitions correctly during failed fetch', async () => {
      let rejectPromise: (error: Error) => void;
      const promise = new Promise((_, reject) => {
        rejectPromise = reject;
      });

      mockFetch.mockImplementationOnce(() => promise);

      const { result } = renderHook(() => useSubfolders(mockToken));

      // Should start loading
      expect(result.current.loading).toBe(true);

      // Reject the fetch
      await act(async () => {
        rejectPromise!(new Error('Failed'));
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });
});
