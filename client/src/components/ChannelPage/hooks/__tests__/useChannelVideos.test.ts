import { renderHook, waitFor } from '@testing-library/react';
import { useChannelVideos } from '../useChannelVideos';
import { ChannelVideo } from '../../../../types/ChannelVideo';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('useChannelVideos', () => {
  const mockToken = 'test-token-123';
  const mockChannelId = 'UC123456789';

  const defaultParams = {
    channelId: mockChannelId,
    page: 1,
    pageSize: 16,
    hideDownloaded: false,
    searchQuery: '',
    sortBy: 'date',
    sortOrder: 'desc',
    tabType: 'videos',
    token: mockToken,
  };

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

  const mockResponse = {
    videos: mockVideos,
    totalCount: 2,
    oldestVideoDate: '2023-01-01T00:00:00Z',
    videoFail: false,
    autoDownloadsEnabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Initial State', () => {
    test('returns default state values before fetch completes', () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      expect(result.current.videos).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.oldestVideoDate).toBeNull();
      expect(result.current.videoFailed).toBe(false);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.autoDownloadsEnabled).toBe(false);
      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('Successful Data Fetching', () => {
    test('fetches and returns channel videos successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.videos).toEqual(mockVideos);
      expect(result.current.totalCount).toBe(2);
      expect(result.current.oldestVideoDate).toBe('2023-01-01T00:00:00Z');
      expect(result.current.videoFailed).toBe(false);
      expect(result.current.autoDownloadsEnabled).toBe(true);
      expect(result.current.error).toBeNull();
    });

    test('constructs correct API URL with query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      renderHook(() =>
        useChannelVideos({
          ...defaultParams,
          page: 2,
          pageSize: 8,
          hideDownloaded: true,
          searchQuery: 'test query',
          sortBy: 'title',
          sortOrder: 'asc',
          tabType: 'shorts',
        })
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      const callArgs = mockFetch.mock.calls[0];
      const url = callArgs[0];

      expect(url).toContain(`/getchannelvideos/${mockChannelId}`);
      expect(url).toContain('page=2');
      expect(url).toContain('pageSize=8');
      expect(url).toContain('hideDownloaded=true');
      expect(url).toContain('searchQuery=test+query');
      expect(url).toContain('sortBy=title');
      expect(url).toContain('sortOrder=asc');
      expect(url).toContain('tabType=shorts');
    });

    test('includes correct authentication header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
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
          videos: [],
          totalCount: 0,
          oldestVideoDate: null,
          videoFail: false,
          autoDownloadsEnabled: false,
        }),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.videos).toEqual([]);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.oldestVideoDate).toBeNull();
    });

    test('handles undefined videos in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          totalCount: 0,
          videoFail: false,
        }),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not update videos when undefined
      expect(result.current.videos).toEqual([]);
    });

    test('handles null videos in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: null,
          totalCount: 0,
          videoFail: false,
        }),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.videos).toEqual([]);
    });

    test('handles missing optional fields in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: mockVideos,
        }),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.videos).toEqual(mockVideos);
      expect(result.current.totalCount).toBe(0);
      expect(result.current.oldestVideoDate).toBeNull();
      expect(result.current.videoFailed).toBe(false);
      expect(result.current.autoDownloadsEnabled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('handles network errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const networkError = new Error('Network error');

      mockFetch.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toEqual(networkError);
      expect(result.current.videos).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching channel videos:',
        networkError
      );

      consoleErrorSpy.mockRestore();
    });

    test('handles non-ok response status', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Not Found');
      expect(result.current.videos).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    test('handles non-Error exceptions', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Unknown error');

      consoleErrorSpy.mockRestore();
    });

    test('clears previous error on successful refetch', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('First error'));

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.videos).toEqual(mockVideos);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Conditional Fetching', () => {
    test('does not fetch when channelId is undefined', () => {
      renderHook(() =>
        useChannelVideos({
          ...defaultParams,
          channelId: undefined,
        })
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('does not fetch when token is null', () => {
      renderHook(() =>
        useChannelVideos({
          ...defaultParams,
          token: null,
        })
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('does not fetch when both channelId and token are missing', () => {
      renderHook(() =>
        useChannelVideos({
          ...defaultParams,
          channelId: undefined,
          token: null,
        })
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Refetch Functionality', () => {
    test('refetch triggers a new fetch request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      await result.current.refetch();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    test('refetch sets loading state', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockFetch.mockReturnValueOnce(promise);

      const refetchPromise = result.current.refetch();

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      resolvePromise!({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      await refetchPromise;

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Dependency Changes', () => {
    test('refetches when page changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { rerender } = renderHook(
        ({ params }) => useChannelVideos(params),
        {
          initialProps: { params: defaultParams },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ params: { ...defaultParams, page: 2 } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    test('refetches when pageSize changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { rerender } = renderHook(
        ({ params }) => useChannelVideos(params),
        {
          initialProps: { params: defaultParams },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ params: { ...defaultParams, pageSize: 8 } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    test('refetches when hideDownloaded changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { rerender } = renderHook(
        ({ params }) => useChannelVideos(params),
        {
          initialProps: { params: defaultParams },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ params: { ...defaultParams, hideDownloaded: true } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    test('refetches when searchQuery changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { rerender } = renderHook(
        ({ params }) => useChannelVideos(params),
        {
          initialProps: { params: defaultParams },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ params: { ...defaultParams, searchQuery: 'test' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    test('refetches when sortBy changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { rerender } = renderHook(
        ({ params }) => useChannelVideos(params),
        {
          initialProps: { params: defaultParams },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ params: { ...defaultParams, sortBy: 'title' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    test('refetches when sortOrder changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { rerender } = renderHook(
        ({ params }) => useChannelVideos(params),
        {
          initialProps: { params: defaultParams },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ params: { ...defaultParams, sortOrder: 'asc' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    test('refetches when tabType changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { rerender } = renderHook(
        ({ params }) => useChannelVideos(params),
        {
          initialProps: { params: defaultParams },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ params: { ...defaultParams, tabType: 'shorts' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    test('refetches when channelId changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { rerender } = renderHook(
        ({ params }) => useChannelVideos(params),
        {
          initialProps: { params: defaultParams },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ params: { ...defaultParams, channelId: 'UC987654321' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    test('refetches when token changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const { rerender } = renderHook(
        ({ params }) => useChannelVideos(params),
        {
          initialProps: { params: defaultParams },
        }
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      rerender({ params: { ...defaultParams, token: 'new-token' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Loading State Management', () => {
    test('sets loading to true during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      expect(result.current.loading).toBe(true);

      resolvePromise!({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('sets loading to false after successful fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.videos).toEqual(mockVideos);
    });

    test('sets loading to false after failed fetch', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch.mockRejectedValueOnce(new Error('Fetch error'));

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('VideoFailed Flag', () => {
    test('sets videoFailed to true when response indicates failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          ...mockResponse,
          videoFail: true,
        }),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.videoFailed).toBe(true);
    });

    test('sets videoFailed to false when not in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({
          videos: mockVideos,
        }),
      });

      const { result } = renderHook(() => useChannelVideos(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.videoFailed).toBe(false);
    });
  });
});
