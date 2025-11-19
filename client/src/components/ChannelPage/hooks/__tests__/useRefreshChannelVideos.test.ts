import { renderHook, waitFor, act } from '@testing-library/react';
import { useRefreshChannelVideos } from '../useRefreshChannelVideos';
import { ChannelVideo } from '../../../../types/ChannelVideo';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('useRefreshChannelVideos', () => {
  const mockToken = 'test-token-123';
  const mockChannelId = 'UC123456789';

  const mockVideos: ChannelVideo[] = [
    {
      title: 'Test Video 1',
      youtube_id: 'video1',
      publishedAt: '2023-01-01T00:00:00Z',
      thumbnail: 'https://i.ytimg.com/vi/video1/mqdefault.jpg',
      added: false,
      duration: 300,
      media_type: 'video',
      live_status: null,
    },
    {
      title: 'Test Video 2',
      youtube_id: 'video2',
      publishedAt: '2023-01-02T00:00:00Z',
      thumbnail: 'https://i.ytimg.com/vi/video2/mqdefault.jpg',
      added: true,
      removed: false,
      duration: 600,
      media_type: 'video',
      live_status: null,
    },
  ];

  const mockSuccessResponse = {
    success: true,
    videos: mockVideos,
    totalCount: 2,
    oldestVideoDate: '2023-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Initial State', () => {
    test('returns default state values on initialization', () => {
      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refreshVideos).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
    });
  });

  describe('Successful Refresh', () => {
    test('successfully refreshes channel videos', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toEqual({
        videos: mockVideos,
        totalCount: 2,
        oldestVideoDate: '2023-01-01T00:00:00Z',
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test('constructs correct API URL with query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 2, 8, true, 'shorts', mockToken)
      );

      await act(async () => {
        await result.current.refreshVideos();
      });

      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0];

      expect(url).toContain(`/fetchallchannelvideos/${mockChannelId}`);
      expect(url).toContain('page=2');
      expect(url).toContain('pageSize=8');
      expect(url).toContain('hideDownloaded=true');
      expect(url).toContain('tabType=shorts');
    });

    test('includes correct authentication header and POST method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      await act(async () => {
        await result.current.refreshVideos();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'x-access-token': mockToken,
          },
        })
      );
    });

    test('handles empty videos array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
          videos: [],
          totalCount: 0,
          oldestVideoDate: null,
        }),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toEqual({
        videos: [],
        totalCount: 0,
        oldestVideoDate: null,
      });
    });

    test('handles missing optional fields in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          success: true,
        }),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toEqual({
        videos: [],
        totalCount: 0,
        oldestVideoDate: null,
      });
    });
  });

  describe('Error Handling', () => {
    test('handles 409 conflict error (fetch in progress)', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: jest.fn().mockResolvedValueOnce({
          success: false,
          error: 'FETCH_IN_PROGRESS',
        }),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toBeNull();
      expect(result.current.error).toBe(
        'A fetch operation is already in progress for this channel. Please wait for it to complete.'
      );
      expect(result.current.loading).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    test('handles error with FETCH_IN_PROGRESS message', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({
          success: false,
          error: 'FETCH_IN_PROGRESS',
        }),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toBeNull();
      expect(result.current.error).toBe(
        'A fetch operation is already in progress for this channel. Please wait for it to complete.'
      );

      consoleErrorSpy.mockRestore();
    });

    test('handles non-ok response with custom message', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValueOnce({
          success: false,
          message: 'Internal server error',
        }),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toBeNull();
      expect(result.current.error).toBe('Internal server error');

      consoleErrorSpy.mockRestore();
    });

    test('handles non-ok response with success: false', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValueOnce({
          success: false,
        }),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toBeNull();
      expect(result.current.error).toBe('Failed to fetch all videos');

      consoleErrorSpy.mockRestore();
    });

    test('handles network errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const networkError = new Error('Network error');

      mockFetch.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toBeNull();
      expect(result.current.error).toBe('Network error');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching all videos:',
        networkError
      );

      consoleErrorSpy.mockRestore();
    });

    test('handles error without message property', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce({ status: 500 });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toBeNull();
      expect(result.current.error).toBe('Failed to fetch all videos for channel');

      consoleErrorSpy.mockRestore();
    });

    test('clears previous error on successful refresh', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('First error'));

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      await act(async () => {
        await result.current.refreshVideos();
      });

      expect(result.current.error).toBe('First error');

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      });

      await act(async () => {
        await result.current.refreshVideos();
      });

      expect(result.current.error).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Conditional Refresh', () => {
    test('returns null when channelId is undefined', async () => {
      const { result } = renderHook(() =>
        useRefreshChannelVideos(undefined, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('returns null when token is null', async () => {
      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', null)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('returns null when both channelId and token are missing', async () => {
      const { result } = renderHook(() =>
        useRefreshChannelVideos(undefined, 1, 16, false, 'videos', null)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(refreshResult).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Loading State Management', () => {
    test('sets loading to true during refresh', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(promise);

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.refreshVideos();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      act(() => {
        resolvePromise!({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('sets loading to false after successful refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockSuccessResponse),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(result.current.loading).toBe(false);
      expect(refreshResult).toEqual({
        videos: mockVideos,
        totalCount: 2,
        oldestVideoDate: '2023-01-01T00:00:00Z',
      });
    });

    test('sets loading to false after failed refresh', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error('Fetch error'));

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      await act(async () => {
        await result.current.refreshVideos();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Fetch error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('ClearError Functionality', () => {
    test('clears error when clearError is called', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error('Test error'));

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult;
      await act(async () => {
        refreshResult = await result.current.refreshVideos();
      });

      expect(result.current.error).toBe('Test error');
      expect(refreshResult).toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    test('clearError does nothing when no error exists', () => {
      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      expect(result.current.error).toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Callback Stability', () => {
    test('refreshVideos function changes when dependencies change', () => {
      const { result, rerender } = renderHook(
        ({ channelId, page, pageSize, hideDownloaded, tabType, token }) =>
          useRefreshChannelVideos(channelId, page, pageSize, hideDownloaded, tabType, token),
        {
          initialProps: {
            channelId: mockChannelId,
            page: 1,
            pageSize: 16,
            hideDownloaded: false,
            tabType: 'videos',
            token: mockToken,
          },
        }
      );

      const firstRefreshFn = result.current.refreshVideos;

      rerender({
        channelId: mockChannelId,
        page: 2,
        pageSize: 16,
        hideDownloaded: false,
        tabType: 'videos',
        token: mockToken,
      });

      expect(result.current.refreshVideos).not.toBe(firstRefreshFn);
    });

    test('clearError function remains stable across rerenders', () => {
      const { result, rerender } = renderHook(
        ({ channelId, page }) =>
          useRefreshChannelVideos(channelId, page, 16, false, 'videos', mockToken),
        {
          initialProps: { channelId: mockChannelId, page: 1 },
        }
      );

      const firstClearErrorFn = result.current.clearError;

      rerender({ channelId: mockChannelId, page: 2 });

      expect(result.current.clearError).toBe(firstClearErrorFn);
    });
  });

  describe('Multiple Sequential Calls', () => {
    test('can handle multiple sequential refresh calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockSuccessResponse),
      });

      const { result } = renderHook(() =>
        useRefreshChannelVideos(mockChannelId, 1, 16, false, 'videos', mockToken)
      );

      let refreshResult1;
      await act(async () => {
        refreshResult1 = await result.current.refreshVideos();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(refreshResult1).toEqual({
        videos: mockVideos,
        totalCount: 2,
        oldestVideoDate: '2023-01-01T00:00:00Z',
      });

      let refreshResult2;
      await act(async () => {
        refreshResult2 = await result.current.refreshVideos();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(refreshResult2).toEqual(refreshResult1);

      let refreshResult3;
      await act(async () => {
        refreshResult3 = await result.current.refreshVideos();
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(refreshResult3).toEqual(refreshResult1);
    });
  });
});
