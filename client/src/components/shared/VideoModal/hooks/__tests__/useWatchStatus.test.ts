jest.mock('axios', () => ({ get: jest.fn() }));

import { renderHook, waitFor } from '@testing-library/react';
import { useWatchStatus } from '../useWatchStatus';

const axios = require('axios');

describe('useWatchStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  test('fetches statuses for a video', async () => {
    axios.get.mockResolvedValueOnce({
      data: { statuses: [{ server: 'plex', played: true, playCount: 1, percentWatched: 100, lastWatchedAt: null, lastSyncedAt: null }] },
    });
    const { result } = renderHook(() => useWatchStatus('abc123def45', 'tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statuses).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledWith(
      '/api/videos/abc123def45/watch-status',
      { headers: { 'x-access-token': 'tok' } }
    );
  });

  test('returns empty without fetching when youtubeId is empty', () => {
    const { result } = renderHook(() => useWatchStatus('', 'tok'));
    expect(result.current.statuses).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('returns empty statuses on fetch error', async () => {
    axios.get.mockRejectedValueOnce(new Error('nope'));
    const { result } = renderHook(() => useWatchStatus('abc123def45', 'tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.statuses).toEqual([]);
  });

  test('resets loading when the youtubeId is cleared mid-fetch', async () => {
    // A fetch that never settles, as when the modal closes before the
    // response arrives.
    axios.get.mockReturnValueOnce(new Promise(() => undefined));
    const { result, rerender } = renderHook(
      ({ youtubeId }: { youtubeId: string }) => useWatchStatus(youtubeId, 'tok'),
      { initialProps: { youtubeId: 'abc123def45' } }
    );
    await waitFor(() => expect(result.current.loading).toBe(true));

    rerender({ youtubeId: '' });

    expect(result.current.loading).toBe(false);
    expect(result.current.statuses).toEqual([]);
  });
});
