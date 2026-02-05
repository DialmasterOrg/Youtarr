import { renderHook, waitFor, act } from '@testing-library/react';
import { useChannelList } from '../useChannelList';
import type { Channel } from '../../../../types/Channel';

// Mock axios
jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

// Mock channelHelpers - use the actual implementation
jest.mock('../../../../utils/channelHelpers');

const { normalizeSubFolderKey } = require('../../../../utils/channelHelpers');

describe('useChannelList', () => {
  const mockToken = 'test-token-123';

  const mockChannel: Channel = {
    url: 'https://www.youtube.com/@testchannel',
    uploader: 'Test Channel',
    channel_id: 'UC123456',
    description: 'Test description',
    title: 'Test Channel Title',
    auto_download_enabled_tabs: 'videos,shorts',
    available_tabs: 'videos,shorts,live',
    sub_folder: 'test-folder',
    video_quality: '1080p',
    min_duration: 60,
    max_duration: 3600,
    title_filter_regex: null,
  };

  const defaultParams = {
    token: mockToken,
    page: 1,
    pageSize: 20,
    searchTerm: '',
    sortOrder: 'asc' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementation for normalizeSubFolderKey
    normalizeSubFolderKey.mockImplementation((value: string | null | undefined) => {
      if (value === undefined || value === null || value === '') {
        return '__default__';
      }
      return value;
    });
  });

  describe('Initial State', () => {
    test('returns default state values before fetch completes', () => {
      axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useChannelList(defaultParams));

      expect(result.current.channels).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.totalPages).toBe(0);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.subFolders).toEqual([]);
    });

    test('initializes with loading true when token is provided', () => {
      axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useChannelList(defaultParams));

      expect(result.current.loading).toBe(true);
    });
  });

  describe('Successful Data Fetching', () => {
    test('fetches and returns channel data successfully', async () => {
      const mockResponse = {
        data: {
          channels: [mockChannel],
          total: 1,
          totalPages: 1,
          subFolders: ['test-folder'],
        },
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.channels).toEqual([mockChannel]);
      expect(result.current.total).toBe(1);
      expect(result.current.totalPages).toBe(1);
      expect(result.current.subFolders).toEqual(['test-folder']);
      expect(result.current.error).toBeNull();
    });

    test('includes correct authentication header and query params', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      renderHook(() =>
        useChannelList({
          token: mockToken,
          page: 2,
          pageSize: 10,
          searchTerm: 'test',
          sortOrder: 'desc',
          subFolder: 'my-folder',
        })
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      expect(axios.get).toHaveBeenCalledWith('/getchannels', {
        headers: {
          'x-access-token': mockToken,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        params: {
          page: 2,
          pageSize: 10,
          search: 'test',
          sortOrder: 'desc',
          subFolder: 'my-folder',
        },
      });
    });

    test('handles multiple channels', async () => {
      const channel2: Channel = {
        ...mockChannel,
        url: 'https://www.youtube.com/@channel2',
        uploader: 'Channel 2',
      };

      const mockResponse = {
        data: {
          channels: [mockChannel, channel2],
          total: 2,
          totalPages: 1,
        },
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.channels).toHaveLength(2);
      expect(result.current.total).toBe(2);
    });

    test('handles empty channel list', async () => {
      const mockResponse = {
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.channels).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.totalPages).toBe(0);
    });

    test('normalizes subFolders and filters out falsy values', async () => {
      const mockResponse = {
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
          subFolders: ['folder1', null, 'folder2', ''],
        },
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // After normalization and filtering, we should get:
      // - 'folder1' stays as 'folder1'
      // - null becomes '__default__'
      // - 'folder2' stays as 'folder2'
      // - '' becomes '__default__'
      // Order matches the input array order
      expect(result.current.subFolders).toEqual(['folder1', '__default__', 'folder2', '__default__']);
    });

    test('handles response without subFolders field', async () => {
      const mockResponse = {
        data: {
          channels: [mockChannel],
          total: 1,
          totalPages: 1,
        },
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.subFolders).toEqual([]);
    });

    test('omits undefined params from query string', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      renderHook(() =>
        useChannelList({
          token: mockToken,
          page: 1,
          pageSize: 20,
          searchTerm: '',
          sortOrder: 'asc',
        })
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      expect(axios.get).toHaveBeenCalledWith('/getchannels', {
        headers: {
          'x-access-token': mockToken,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        params: {
          page: 1,
          pageSize: 20,
          search: undefined,
          sortOrder: 'asc',
          subFolder: undefined,
        },
      });
    });
  });

  describe('Error Handling', () => {
    test('handles network errors', async () => {
      const networkError = new Error('Network error');
      axios.get.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load channels');
      expect(result.current.channels).toEqual([]);
    });

    test('handles API error responses', async () => {
      const apiError = {
        response: {
          data: {
            error: 'Custom error message',
          },
        },
      };

      axios.get.mockRejectedValueOnce(apiError);

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Custom error message');
    });

    test('clears error on successful refetch', async () => {
      // First call fails
      axios.get.mockRejectedValueOnce({
        response: {
          data: {
            error: 'First error',
          },
        },
      });

      const { result, rerender } = renderHook(
        ({ token }: { token: string | null }) =>
          useChannelList({
            ...defaultParams,
            token,
          }),
        { initialProps: { token: mockToken } }
      );

      await waitFor(() => {
        expect(result.current.error).toBe('First error');
      });

      expect(result.current.loading).toBe(false);

      // Second call succeeds
      axios.get.mockResolvedValueOnce({
        data: {
          channels: [mockChannel],
          total: 1,
          totalPages: 1,
        },
      });

      rerender({ token: 'new-token' });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      await waitFor(() => {
        expect(result.current.channels).toEqual([mockChannel]);
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('No Token Handling', () => {
    test('does not fetch when token is null', () => {
      const { result } = renderHook(() =>
        useChannelList({
          ...defaultParams,
          token: null,
        })
      );

      expect(axios.get).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
      expect(result.current.channels).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.totalPages).toBe(0);
    });

    test('clears data when token becomes null', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          channels: [mockChannel],
          total: 1,
          totalPages: 1,
        },
      });

      const { result, rerender } = renderHook(
        ({ token }: { token: string | null }) =>
          useChannelList({
            ...defaultParams,
            token,
          }),
        { initialProps: { token: mockToken as string | null } }
      );

      await waitFor(() => {
        expect(result.current.channels).toEqual([mockChannel]);
      });

      rerender({ token: null as string | null });

      await waitFor(() => {
        expect(result.current.channels).toEqual([]);
      });

      expect(result.current.total).toBe(0);
      expect(result.current.totalPages).toBe(0);
    });

    test('fetches when token becomes available', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          channels: [mockChannel],
          total: 1,
          totalPages: 1,
        },
      });

      const { result, rerender } = renderHook(
        ({ token }: { token: string | null }) =>
          useChannelList({
            ...defaultParams,
            token,
          }),
        { initialProps: { token: null as string | null } }
      );

      expect(axios.get).not.toHaveBeenCalled();
      expect(result.current.channels).toEqual([]);

      rerender({ token: mockToken });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(result.current.channels).toEqual([mockChannel]);
      });
    });
  });

  describe('Dependency Changes', () => {
    test('refetches when token changes', async () => {
      axios.get.mockResolvedValue({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      const { rerender } = renderHook(
        ({ token }) =>
          useChannelList({
            ...defaultParams,
            token,
          }),
        { initialProps: { token: mockToken } }
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      rerender({ token: 'new-token-456' });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/getchannels', {
        headers: {
          'x-access-token': 'new-token-456',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        params: expect.any(Object),
      });
    });

    test('refetches when page changes', async () => {
      axios.get.mockResolvedValue({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      const { rerender } = renderHook(
        ({ page }) =>
          useChannelList({
            ...defaultParams,
            page,
          }),
        { initialProps: { page: 1 } }
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      rerender({ page: 2 });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/getchannels', {
        headers: expect.any(Object),
        params: expect.objectContaining({
          page: 2,
        }),
      });
    });

    test('refetches when pageSize changes', async () => {
      axios.get.mockResolvedValue({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      const { rerender } = renderHook(
        ({ pageSize }) =>
          useChannelList({
            ...defaultParams,
            pageSize,
          }),
        { initialProps: { pageSize: 20 } }
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      rerender({ pageSize: 50 });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/getchannels', {
        headers: expect.any(Object),
        params: expect.objectContaining({
          pageSize: 50,
        }),
      });
    });

    test('refetches when searchTerm changes', async () => {
      axios.get.mockResolvedValue({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      const { rerender } = renderHook(
        ({ searchTerm }) =>
          useChannelList({
            ...defaultParams,
            searchTerm,
          }),
        { initialProps: { searchTerm: '' } }
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      rerender({ searchTerm: 'test search' });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/getchannels', {
        headers: expect.any(Object),
        params: expect.objectContaining({
          search: 'test search',
        }),
      });
    });

    test('refetches when sortOrder changes', async () => {
      axios.get.mockResolvedValue({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      const { rerender } = renderHook(
        ({ sortOrder }: { sortOrder: 'asc' | 'desc' }) =>
          useChannelList({
            ...defaultParams,
            sortOrder,
          }),
        { initialProps: { sortOrder: 'asc' as 'asc' | 'desc' } }
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      rerender({ sortOrder: 'desc' as 'asc' | 'desc' });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/getchannels', {
        headers: expect.any(Object),
        params: expect.objectContaining({
          sortOrder: 'desc',
        }),
      });
    });

    test('refetches when subFolder changes', async () => {
      axios.get.mockResolvedValue({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      const { rerender } = renderHook(
        ({ subFolder }: { subFolder?: string }) =>
          useChannelList({
            ...defaultParams,
            subFolder,
          }),
        { initialProps: { subFolder: undefined as string | undefined } }
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      rerender({ subFolder: 'my-folder' as string | undefined });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/getchannels', {
        headers: expect.any(Object),
        params: expect.objectContaining({
          subFolder: 'my-folder',
        }),
      });
    });
  });

  describe('Loading State Management', () => {
    test('sets loading to true during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      axios.get.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useChannelList(defaultParams));

      expect(result.current.loading).toBe(true);

      resolvePromise!({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    test('sets loading to false after successful fetch', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          channels: [mockChannel],
          total: 1,
          totalPages: 1,
        },
      });

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.channels).toEqual([mockChannel]);
    });

    test('sets loading to false after failed fetch', async () => {
      axios.get.mockRejectedValueOnce(new Error('Fetch error'));

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load channels');
    });

    test('remains loading false when no token provided', () => {
      const { result } = renderHook(() =>
        useChannelList({
          ...defaultParams,
          token: null,
        })
      );

      expect(result.current.loading).toBe(false);
    });
  });

  describe('Refetch Functionality', () => {
    test('provides refetch function that triggers new fetch', async () => {
      axios.get.mockResolvedValue({
        data: {
          channels: [mockChannel],
          total: 1,
          totalPages: 1,
        },
      });

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      // Call refetch wrapped in act
      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });
    });

    test('refetch uses current params', async () => {
      axios.get.mockResolvedValue({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      const { result } = renderHook(() =>
        useChannelList({
          token: mockToken,
          page: 3,
          pageSize: 15,
          searchTerm: 'my search',
          sortOrder: 'desc',
          subFolder: 'test-folder',
        })
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(2);
      });

      expect(axios.get).toHaveBeenLastCalledWith('/getchannels', {
        headers: {
          'x-access-token': mockToken,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        params: {
          page: 3,
          pageSize: 15,
          search: 'my search',
          sortOrder: 'desc',
          subFolder: 'test-folder',
        },
      });
    });
  });

  describe('Cleanup on Unmount', () => {
    test('does not update state after unmount', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      axios.get.mockReturnValueOnce(promise);

      const { result, unmount } = renderHook(() => useChannelList(defaultParams));

      expect(result.current.loading).toBe(true);

      unmount();

      // Resolve after unmount
      resolvePromise!({
        data: {
          channels: [mockChannel],
          total: 1,
          totalPages: 1,
        },
      });

      // Give it a moment
      await new Promise((resolve) => setTimeout(resolve, 10));

      // State should remain unchanged (still loading)
      expect(result.current.loading).toBe(true);
      expect(result.current.channels).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    test('handles partial response data', async () => {
      const mockResponse = {
        data: {
          channels: null,
          total: null,
          totalPages: null,
        },
      };

      axios.get.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useChannelList(defaultParams));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.channels).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.totalPages).toBe(0);
    });

    test('handles large page numbers', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          channels: [],
          total: 1000,
          totalPages: 50,
        },
      });

      renderHook(() =>
        useChannelList({
          ...defaultParams,
          page: 50,
        })
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      expect(axios.get).toHaveBeenCalledWith('/getchannels', {
        headers: expect.any(Object),
        params: expect.objectContaining({
          page: 50,
        }),
      });
    });

    test('handles special characters in search term', async () => {
      axios.get.mockResolvedValueOnce({
        data: {
          channels: [],
          total: 0,
          totalPages: 0,
        },
      });

      renderHook(() =>
        useChannelList({
          ...defaultParams,
          searchTerm: '@channel-name#123!',
        })
      );

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledTimes(1);
      });

      expect(axios.get).toHaveBeenCalledWith('/getchannels', {
        headers: expect.any(Object),
        params: expect.objectContaining({
          search: '@channel-name#123!',
        }),
      });
    });
  });
});
