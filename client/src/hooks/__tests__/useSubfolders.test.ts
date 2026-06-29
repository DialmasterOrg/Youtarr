import { renderHook, waitFor, act } from '@testing-library/react';

// Mock axios (factory + require per project testing conventions)
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
  isAxiosError: (e: unknown) => Boolean(e && (e as { isAxiosError?: boolean }).isAxiosError),
}));

const axios = require('axios');

import { useSubfolders, SUBFOLDERS_UPDATED_EVENT } from '../useSubfolders';

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

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('starts loading when token is provided', () => {
      axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useSubfolders(mockToken));

      expect(result.current.loading).toBe(true);
    });
  });

  describe('Successful Data Fetching', () => {
    test('fetches and returns subfolders successfully', async () => {
      axios.get.mockResolvedValueOnce({ data: mockSubfolders });

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual(mockSubfolders);
      expect(result.current.error).toBeNull();
    });

    test('includes correct authentication header', async () => {
      axios.get.mockResolvedValueOnce({ data: mockSubfolders });

      renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      expect(axios.get).toHaveBeenCalledWith('/api/channels/subfolders', {
        headers: {
          'x-access-token': mockToken,
        },
      });
    });

    test('handles empty subfolders array', async () => {
      axios.get.mockResolvedValueOnce({ data: [] });

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
      axios.get.mockRejectedValueOnce(new Error('Request failed: Not Found'));

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Not Found');
    });

    test('handles network error', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual([]);
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
    });

    test('handles non-Error throw', async () => {
      axios.get.mockRejectedValueOnce('String error');

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
      axios.get.mockResolvedValue({ data: mockSubfolders });

      const { result, rerender } = renderHook(
        ({ token }: { token: string | null }) => useSubfolders(token),
        { initialProps: { token: mockToken } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(axios.get).toHaveBeenCalledTimes(1);

      // Change to a different token
      rerender({ token: 'new-token' });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/api/channels/subfolders', {
        headers: {
          'x-access-token': 'new-token',
        },
      });
    });

    test('does not fetch when token changes to null', async () => {
      axios.get.mockResolvedValueOnce({ data: mockSubfolders });

      const { result, rerender } = renderHook(
        ({ token }: { token: string | null }) => useSubfolders(token),
        { initialProps: { token: mockToken } as { token: string | null } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(axios.get).toHaveBeenCalledTimes(1);

      // Change to null token
      rerender({ token: null });

      // Should not have made another fetch call
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Refetch Function', () => {
    test('refetch triggers a new API call', async () => {
      const firstResponse = ['__Sports'];
      const secondResponse = ['__Sports', '__Music'];

      axios.get
        .mockResolvedValueOnce({ data: firstResponse })
        .mockResolvedValueOnce({ data: secondResponse });

      const { result } = renderHook(() => useSubfolders(mockToken));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subfolders).toEqual(firstResponse);
      expect(axios.get).toHaveBeenCalledTimes(1);

      // Call refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(result.current.subfolders).toEqual(secondResponse);
    });

    test('refetch sets loading state correctly', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      axios.get
        .mockResolvedValueOnce({ data: mockSubfolders })
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
        resolvePromise!({ data: mockSubfolders });
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

      expect(axios.get).not.toHaveBeenCalled();
    });

    test('refetch clears previous error', async () => {
      axios.get
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce({ data: mockSubfolders });

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

      axios.get.mockImplementationOnce(() => promise);

      const { result } = renderHook(() => useSubfolders(mockToken));

      // Should start loading
      expect(result.current.loading).toBe(true);
      expect(result.current.subfolders).toEqual([]);

      // Resolve the fetch
      await act(async () => {
        resolvePromise!({ data: mockSubfolders });
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

      axios.get.mockImplementationOnce(() => promise);

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

  describe('mutations', () => {
    test('createSubfolder POSTs and dispatches the update event', async () => {
      axios.get.mockResolvedValue({ data: ['__A', '__B'] });
      axios.post.mockResolvedValueOnce({ data: { name: 'B' } });

      const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
      const { result } = renderHook(() => useSubfolders('t'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => { await result.current.createSubfolder('B'); });

      expect(axios.post).toHaveBeenCalledWith(
        '/api/subfolders',
        { name: 'B' },
        { headers: { 'x-access-token': 't' } }
      );
      expect(dispatchSpy.mock.calls.some(([e]) => (e as Event).type === SUBFOLDERS_UPDATED_EVENT)).toBe(true);
    });

    test('deleteSubfolder throws the server error message on 409', async () => {
      axios.get.mockResolvedValueOnce({ data: [] });
      axios.delete.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 409, data: { error: 'Subfolder is in use by 1 channel(s)' } },
      });

      const { result } = renderHook(() => useSubfolders('t'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(result.current.deleteSubfolder('Used')).rejects.toThrow('Subfolder is in use by 1 channel(s)');
    });
  });
});
