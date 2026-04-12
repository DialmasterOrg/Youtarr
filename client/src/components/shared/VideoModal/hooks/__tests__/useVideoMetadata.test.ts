import { renderHook, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

import { useVideoMetadata } from '../useVideoMetadata';
import { VideoExtendedMetadata } from '../../types';

const mockMetadata: VideoExtendedMetadata = {
  description: 'A test video description',
  viewCount: 12345,
  likeCount: 678,
  commentCount: 90,
  tags: ['tag1', 'tag2'],
  categories: ['Entertainment'],
  uploadDate: '2024-01-15',
  resolution: '1920x1080',
  width: 1920,
  height: 1080,
  fps: 30,
  aspectRatio: 1.777,
  language: 'en',
  isLive: false,
  wasLive: false,
  availability: 'public',
  channelFollowerCount: 50000,
  ageLimit: 0,
  webpageUrl: 'https://www.youtube.com/watch?v=testId123',
  relatedFiles: null,
  availableResolutions: null,
  downloadedTier: null,
};

describe('useVideoMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetches metadata when youtubeId and token are provided', async () => {
    axios.get.mockResolvedValueOnce({ data: mockMetadata });

    const { result } = renderHook(() =>
      useVideoMetadata('testId123', 'test-token')
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.metadata).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metadata).toEqual(mockMetadata);
    expect(result.current.error).toBeNull();
    expect(axios.get).toHaveBeenCalledWith(
      '/api/videos/testId123/metadata',
      { headers: { 'x-access-token': 'test-token' } }
    );
  });

  test('does not fetch when youtubeId is empty', () => {
    const { result } = renderHook(() =>
      useVideoMetadata('', 'test-token')
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.metadata).toBeNull();
    expect(result.current.error).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('does not fetch when token is null', () => {
    const { result } = renderHook(() =>
      useVideoMetadata('testId123', null)
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.metadata).toBeNull();
    expect(result.current.error).toBeNull();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('handles fetch error gracefully and metadata stays null', async () => {
    axios.get.mockRejectedValueOnce({
      response: { data: { error: 'Video not found' } },
    });

    const { result } = renderHook(() =>
      useVideoMetadata('badId', 'test-token')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metadata).toBeNull();
    expect(result.current.error).toBe('Video not found');
  });
});
