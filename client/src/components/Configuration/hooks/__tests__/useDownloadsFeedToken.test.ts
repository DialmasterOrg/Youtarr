import { act, renderHook, waitFor } from '@testing-library/react';
import { useDownloadsFeedToken } from '../useDownloadsFeedToken';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require('axios');

describe('useDownloadsFeedToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { token: 'feed-token' } });
    axios.post.mockResolvedValue({ data: { token: 'new-feed-token' } });
  });

  test('loads the feed token from the feeds endpoint', async () => {
    const { result } = renderHook(() => useDownloadsFeedToken('session', true));

    await waitFor(() => expect(result.current.feedToken).toBe('feed-token'));
    expect(axios.get).toHaveBeenCalledWith('/api/feeds/downloads/token', {
      headers: { 'x-access-token': 'session' },
    });
  });

  test('replaces the feed token through the feeds endpoint', async () => {
    const { result } = renderHook(() => useDownloadsFeedToken('session', true));
    await waitFor(() => expect(result.current.feedToken).toBe('feed-token'));

    await act(async () => { await result.current.regenerate(); });

    expect(axios.post).toHaveBeenCalledWith('/api/feeds/downloads/regenerate-token', null, {
      headers: { 'x-access-token': 'session' },
    });
    expect(result.current.feedToken).toBe('new-feed-token');
  });

  test('says the feed URL could not be loaded', async () => {
    axios.get.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useDownloadsFeedToken('session', true));

    await waitFor(() => expect(result.current.error).toBe('Could not load the feed URL.'));
  });
});
