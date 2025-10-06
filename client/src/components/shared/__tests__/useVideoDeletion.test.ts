import { renderHook, waitFor } from '@testing-library/react';
import { useVideoDeletion } from '../useVideoDeletion';

// Mock axios
jest.mock('axios', () => ({
  delete: jest.fn()
}));

const axios = require('axios');

describe('useVideoDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    test('initializes with correct default values', () => {
      const { result } = renderHook(() => useVideoDeletion());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.deleteVideos).toBe('function');
      expect(typeof result.current.deleteVideosByYoutubeIds).toBe('function');
    });
  });

  describe('deleteVideos', () => {
    test('successfully deletes videos with valid token', async () => {
      const mockResponse = {
        data: {
          success: true,
          deleted: [1, 2, 3],
          failed: [],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useVideoDeletion());

      const videoIds = [1, 2, 3];
      const token = 'test-token';

      const response = await result.current.deleteVideos(videoIds, token);

      // Verify the API was called correctly
      expect(axios.delete).toHaveBeenCalledWith('/api/videos', {
        headers: {
          'x-access-token': token,
        },
        data: {
          videoIds,
        },
      });

      // Check the response
      expect(response).toEqual(mockResponse.data);

      // Check loading state is reset
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.error).toBe(null);
    });

    test('successfully deletes videos with null token', async () => {
      const mockResponse = {
        data: {
          success: true,
          deleted: [1],
          failed: [],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useVideoDeletion());

      await result.current.deleteVideos([1], null);

      expect(axios.delete).toHaveBeenCalledWith('/api/videos', {
        headers: {
          'x-access-token': '',
        },
        data: {
          videoIds: [1],
        },
      });
    });

    test('handles API error with response error message', async () => {
      const errorMessage = 'Failed to delete videos from disk';
      axios.delete.mockRejectedValueOnce({
        response: {
          data: {
            error: errorMessage,
          },
        },
      });

      const { result } = renderHook(() => useVideoDeletion());

      const videoIds = [1, 2];
      const response = await result.current.deleteVideos(videoIds, 'token');

      // Check error state is set
      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
      expect(result.current.loading).toBe(false);

      // Check the response contains failed results
      expect(response).toEqual({
        success: false,
        deleted: [],
        failed: [
          { videoId: 1, error: errorMessage },
          { videoId: 2, error: errorMessage },
        ],
      });
    });

    test('handles API error with error message property', async () => {
      const errorMessage = 'Network error';
      axios.delete.mockRejectedValueOnce({
        message: errorMessage,
      });

      const { result } = renderHook(() => useVideoDeletion());

      const videoIds = [5];
      const response = await result.current.deleteVideos(videoIds, 'token');

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
      expect(result.current.loading).toBe(false);

      expect(response).toEqual({
        success: false,
        deleted: [],
        failed: [{ videoId: 5, error: errorMessage }],
      });
    });

    test('handles generic error without specific message', async () => {
      axios.delete.mockRejectedValueOnce({});

      const { result } = renderHook(() => useVideoDeletion());

      const videoIds = [10];
      const response = await result.current.deleteVideos(videoIds, 'token');

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to delete videos');
      });
      expect(result.current.loading).toBe(false);

      expect(response).toEqual({
        success: false,
        deleted: [],
        failed: [{ videoId: 10, error: 'Failed to delete videos' }],
      });
    });

    test('handles empty video IDs array', async () => {
      const mockResponse = {
        data: {
          success: true,
          deleted: [],
          failed: [],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useVideoDeletion());

      const response = await result.current.deleteVideos([], 'token');

      expect(axios.delete).toHaveBeenCalledWith('/api/videos', {
        headers: {
          'x-access-token': 'token',
        },
        data: {
          videoIds: [],
        },
      });

      expect(response).toEqual(mockResponse.data);
    });

    test('handles partial success response', async () => {
      const mockResponse = {
        data: {
          success: false,
          deleted: [1, 2],
          failed: [
            { videoId: 3, error: 'File not found' },
          ],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useVideoDeletion());

      const response = await result.current.deleteVideos([1, 2, 3], 'token');

      expect(response).toEqual(mockResponse.data);
      expect(result.current.error).toBe(null);
    });

    test('resets error state on new request', async () => {
      // First request fails
      axios.delete.mockRejectedValueOnce({
        message: 'First error',
      });

      const { result } = renderHook(() => useVideoDeletion());

      await result.current.deleteVideos([1], 'token');

      await waitFor(() => {
        expect(result.current.error).toBe('First error');
      });

      // Second request succeeds
      const mockResponse = {
        data: {
          success: true,
          deleted: [2],
          failed: [],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      await result.current.deleteVideos([2], 'token');

      // Error should be reset
      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe('deleteVideosByYoutubeIds', () => {
    test('successfully deletes videos by YouTube IDs', async () => {
      const mockResponse = {
        data: {
          success: true,
          deleted: ['abc123', 'def456'],
          failed: [],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useVideoDeletion());

      const youtubeIds = ['abc123', 'def456'];
      const token = 'test-token';

      const response = await result.current.deleteVideosByYoutubeIds(youtubeIds, token);

      // Verify the API was called correctly
      expect(axios.delete).toHaveBeenCalledWith('/api/videos', {
        headers: {
          'x-access-token': token,
        },
        data: {
          youtubeIds,
        },
      });

      expect(response).toEqual(mockResponse.data);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.error).toBe(null);
    });

    test('successfully deletes videos with null token', async () => {
      const mockResponse = {
        data: {
          success: true,
          deleted: ['xyz789'],
          failed: [],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useVideoDeletion());

      await result.current.deleteVideosByYoutubeIds(['xyz789'], null);

      expect(axios.delete).toHaveBeenCalledWith('/api/videos', {
        headers: {
          'x-access-token': '',
        },
        data: {
          youtubeIds: ['xyz789'],
        },
      });
    });

    test('handles API error with response error message', async () => {
      const errorMessage = 'YouTube IDs not found';
      axios.delete.mockRejectedValueOnce({
        response: {
          data: {
            error: errorMessage,
          },
        },
      });

      const { result } = renderHook(() => useVideoDeletion());

      const youtubeIds = ['abc123', 'def456'];
      const response = await result.current.deleteVideosByYoutubeIds(youtubeIds, 'token');

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
      expect(result.current.loading).toBe(false);

      expect(response).toEqual({
        success: false,
        deleted: [],
        failed: [
          { youtubeId: 'abc123', error: errorMessage },
          { youtubeId: 'def456', error: errorMessage },
        ],
      });
    });

    test('handles API error with error message property', async () => {
      const errorMessage = 'Connection timeout';
      axios.delete.mockRejectedValueOnce({
        message: errorMessage,
      });

      const { result } = renderHook(() => useVideoDeletion());

      const youtubeIds = ['test123'];
      const response = await result.current.deleteVideosByYoutubeIds(youtubeIds, 'token');

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });

      expect(response).toEqual({
        success: false,
        deleted: [],
        failed: [{ youtubeId: 'test123', error: errorMessage }],
      });
    });

    test('handles generic error without specific message', async () => {
      axios.delete.mockRejectedValueOnce({});

      const { result } = renderHook(() => useVideoDeletion());

      const youtubeIds = ['generic'];
      const response = await result.current.deleteVideosByYoutubeIds(youtubeIds, 'token');

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to delete videos');
      });

      expect(response).toEqual({
        success: false,
        deleted: [],
        failed: [{ youtubeId: 'generic', error: 'Failed to delete videos' }],
      });
    });

    test('handles empty YouTube IDs array', async () => {
      const mockResponse = {
        data: {
          success: true,
          deleted: [],
          failed: [],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useVideoDeletion());

      const response = await result.current.deleteVideosByYoutubeIds([], 'token');

      expect(axios.delete).toHaveBeenCalledWith('/api/videos', {
        headers: {
          'x-access-token': 'token',
        },
        data: {
          youtubeIds: [],
        },
      });

      expect(response).toEqual(mockResponse.data);
    });

    test('handles partial success response', async () => {
      const mockResponse = {
        data: {
          success: false,
          deleted: ['abc123'],
          failed: [
            { youtubeId: 'def456', error: 'Video file missing' },
          ],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useVideoDeletion());

      const response = await result.current.deleteVideosByYoutubeIds(['abc123', 'def456'], 'token');

      expect(response).toEqual(mockResponse.data);
      expect(result.current.error).toBe(null);
    });

    test('resets error state on new request', async () => {
      // First request fails
      axios.delete.mockRejectedValueOnce({
        message: 'Initial error',
      });

      const { result } = renderHook(() => useVideoDeletion());

      await result.current.deleteVideosByYoutubeIds(['abc123'], 'token');

      await waitFor(() => {
        expect(result.current.error).toBe('Initial error');
      });

      // Second request succeeds
      const mockResponse = {
        data: {
          success: true,
          deleted: ['def456'],
          failed: [],
        },
      };

      axios.delete.mockResolvedValueOnce(mockResponse);

      await result.current.deleteVideosByYoutubeIds(['def456'], 'token');

      await waitFor(() => {
        expect(result.current.error).toBe(null);
      });
    });
  });

  describe('Multiple Concurrent Requests', () => {
    test('handles multiple deleteVideos calls correctly', async () => {
      const mockResponse1 = {
        data: { success: true, deleted: [1], failed: [] },
      };
      const mockResponse2 = {
        data: { success: true, deleted: [2], failed: [] },
      };

      axios.delete
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const { result } = renderHook(() => useVideoDeletion());

      const promise1 = result.current.deleteVideos([1], 'token');
      const promise2 = result.current.deleteVideos([2], 'token');

      const [response1, response2] = await Promise.all([promise1, promise2]);

      expect(response1).toEqual(mockResponse1.data);
      expect(response2).toEqual(mockResponse2.data);
    });

    test('handles mixed deleteVideos and deleteVideosByYoutubeIds calls', async () => {
      const mockResponse1 = {
        data: { success: true, deleted: [1], failed: [] },
      };
      const mockResponse2 = {
        data: { success: true, deleted: ['abc123'], failed: [] },
      };

      axios.delete
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const { result } = renderHook(() => useVideoDeletion());

      const promise1 = result.current.deleteVideos([1], 'token');
      const promise2 = result.current.deleteVideosByYoutubeIds(['abc123'], 'token');

      const [response1, response2] = await Promise.all([promise1, promise2]);

      expect(response1).toEqual(mockResponse1.data);
      expect(response2).toEqual(mockResponse2.data);
    });
  });
});
