import { renderHook, act, waitFor } from '@testing-library/react';
import { usePlaylistDetail } from '../usePlaylistDetail';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: jest.fn(() => false),
}));

const axios = require('axios');

describe('usePlaylistDetail.triggerDownload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0 } });
    axios.post.mockResolvedValue({ data: {} });
  });

  test('posts an empty body when no ids are passed', async () => {
    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );
    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    await act(async () => {
      await result.current.triggerDownload();
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/download',
      {},
      { headers: { 'x-access-token': 't' } }
    );
  });

  test('posts videoIds when ids are passed', async () => {
    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );
    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    await act(async () => {
      await result.current.triggerDownload(['a', 'b']);
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/download',
      { videoIds: ['a', 'b'] },
      { headers: { 'x-access-token': 't' } }
    );
  });

  test('posts overrideSettings and videoIds when provided', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));

    await act(async () => {
      await result.current.triggerDownload(['a', 'b'], { resolution: '720', allowRedownload: true });
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/download',
      { videoIds: ['a', 'b'], overrideSettings: { resolution: '720', allowRedownload: true } },
      { headers: { 'x-access-token': 't' } }
    );
  });

  test('posts an empty body when no ids or settings are given', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));

    await act(async () => {
      await result.current.triggerDownload();
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/download',
      {},
      { headers: { 'x-access-token': 't' } }
    );
  });
});

describe('usePlaylistDetail.downloadedCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPlaylistResponse = (data: Record<string, unknown>) => {
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 0, videos: [] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' }, ...data } });
    });
  };

  test('exposes downloadedCount from the playlist response', async () => {
    mockPlaylistResponse({ downloaded_count: 12 });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => {
      expect(result.current.downloadedCount).toBe(12);
    });
  });

  test('downloadedCount is null when the field is absent', async () => {
    mockPlaylistResponse({});

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => {
      expect(result.current.playlist).not.toBeNull();
    });
    expect(result.current.downloadedCount).toBeNull();
  });

  test('refetchMeta updates downloadedCount', async () => {
    mockPlaylistResponse({ downloaded_count: 3 });
    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );
    await waitFor(() => expect(result.current.downloadedCount).toBe(3));

    mockPlaylistResponse({ downloaded_count: 2 });
    await act(async () => {
      await result.current.refetchMeta();
    });

    expect(result.current.downloadedCount).toBe(2);
  });
});

describe('usePlaylistDetail.notDownloadedCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exposes notDownloadedCount from the playlist response', async () => {
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 0, videos: [] } });
      }
      return Promise.resolve({
        data: { playlist: { playlist_id: 'PL1' }, not_downloaded_count: 7 },
      });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => {
      expect(result.current.notDownloadedCount).toBe(7);
    });
  });

  test('notDownloadedCount is null when the field is absent', async () => {
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 0, videos: [] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' } } });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => {
      expect(result.current.playlist).not.toBeNull();
    });
    expect(result.current.notDownloadedCount).toBeNull();
  });

  test('exposes unsyncableCount from the playlist response, null when absent', async () => {
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 0, videos: [] } });
      }
      return Promise.resolve({
        data: { playlist: { playlist_id: 'PL1' }, unsyncable_count: 3 },
      });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => {
      expect(result.current.unsyncableCount).toBe(3);
    });

    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 0, videos: [] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' } } });
    });
    await act(async () => {
      await result.current.refetchMeta();
    });
    expect(result.current.unsyncableCount).toBeNull();
  });
});

describe('usePlaylistDetail.syncStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const respondWith = (detail: Record<string, unknown>) => {
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 0, videos: [] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' }, ...detail } });
    });
  };

  test('exposes the sync status from the playlist response and updates it on refetchMeta', async () => {
    const syncing = { syncing: true, servers: {} };
    const synced = {
      syncing: false,
      servers: { plex: { last_synced_at: '2026-11-18T12:00:00Z', last_error: null } },
    };
    respondWith({ sync_status: syncing });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );
    await waitFor(() => {
      expect(result.current.syncStatus).toEqual(syncing);
    });

    respondWith({ sync_status: synced });
    await act(async () => {
      await result.current.refetchMeta();
    });

    expect(result.current.syncStatus).toEqual(synced);
  });

  test('is null when the response carries no sync status', async () => {
    respondWith({});

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.syncStatus).toBeNull();
  });
});

const makeVideo = (id: number, overrides = {}) => ({
  id,
  playlist_id: 'PL1',
  youtube_id: `vid${id}`,
  position: id,
  added_at: null,
  channel_id: null,
  ignored: false,
  ignored_at: null,
  title: `Video ${id}`,
  channel_name: null,
  duration: null,
  published_at: null,
  thumbnail: '',
  downloaded: false,
  previously_downloaded: false,
  youtube_removed: false,
  video_id: null,
  file_path: null,
  file_size: null,
  audio_file_path: null,
  audio_file_size: null,
  ...overrides,
});

describe('usePlaylistDetail sorting and pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('defaults to requesting sortOrder=asc for the video list', async () => {
    axios.get.mockResolvedValue({ data: { playlist: { playlist_id: 'PL1' }, total: 0, videos: [] } });

    renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        '/api/playlists/PL1/videos',
        expect.objectContaining({ params: expect.objectContaining({ page: 1, sortOrder: 'asc' }) }),
      );
    });
  });

  test('forwards the provided sortOrder', async () => {
    axios.get.mockResolvedValue({ data: { playlist: { playlist_id: 'PL1' }, total: 0, videos: [] } });

    renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1', sortOrder: 'asc' }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        '/api/playlists/PL1/videos',
        expect.objectContaining({
          params: expect.objectContaining({ sortOrder: 'asc' }),
        })
      );
    });
  });

  test('forwards downloadState when it is not "all"', async () => {
    axios.get.mockResolvedValue({ data: { playlist: { playlist_id: 'PL1' }, total: 0, videos: [] } });

    renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1', downloadState: 'downloaded' })
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        '/api/playlists/PL1/videos',
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, downloadState: 'downloaded' }),
        })
      );
    });
  });

  test('omits downloadState from params when it is "all" (default)', async () => {
    axios.get.mockResolvedValue({ data: { playlist: { playlist_id: 'PL1' }, total: 0, videos: [] } });

    renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        '/api/playlists/PL1/videos',
        expect.objectContaining({
          params: expect.not.objectContaining({ downloadState: expect.anything() }),
        })
      );
    });
  });

  test('forwards watchedState when it is not "all"', async () => {
    axios.get.mockResolvedValue({ data: { playlist: { playlist_id: 'PL1' }, total: 0, videos: [] } });

    renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1', watchedState: 'not_watched' })
    );

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        '/api/playlists/PL1/videos',
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, watchedState: 'not_watched' }),
        })
      );
    });
  });

  test('omits watchedState from params when it is "all" (default)', async () => {
    axios.get.mockResolvedValue({ data: { playlist: { playlist_id: 'PL1' }, total: 0, videos: [] } });

    renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        '/api/playlists/PL1/videos',
        expect.objectContaining({
          params: expect.not.objectContaining({ watchedState: expect.anything() }),
        })
      );
    });
  });

  test('changing downloadState refetches page 1 with the new filter', async () => {
    axios.get.mockResolvedValue({ data: { playlist: { playlist_id: 'PL1' }, total: 0, videos: [] } });

    const { rerender } = renderHook(
      ({ downloadState }: { downloadState: 'all' | 'downloaded' | 'not_downloaded' }) =>
        usePlaylistDetail({ token: 't', playlistId: 'PL1', downloadState }),
      { initialProps: { downloadState: 'all' as 'all' | 'downloaded' | 'not_downloaded' } }
    );

    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    axios.get.mockClear();
    axios.get.mockResolvedValue({ data: { playlist: { playlist_id: 'PL1' }, total: 0, videos: [] } });

    rerender({ downloadState: 'not_downloaded' });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        '/api/playlists/PL1/videos',
        expect.objectContaining({
          params: expect.objectContaining({ page: 1, downloadState: 'not_downloaded' }),
        })
      );
    });
  });

  test('loadMore appends the next page and dedupes by id', async () => {
    axios.get.mockImplementation((url: string, config?: { params?: { page?: number } }) => {
      if (url.endsWith('/videos')) {
        const page = config?.params?.page ?? 1;
        if (page === 1) {
          return Promise.resolve({ data: { total: 3, videos: [makeVideo(1), makeVideo(2)] } });
        }
        // Page 2 re-includes vid2 to prove dedupe.
        return Promise.resolve({ data: { total: 3, videos: [makeVideo(2), makeVideo(3)] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' } } });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1', pageSize: 2 })
    );

    await waitFor(() => expect(result.current.videos).toHaveLength(2));
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.videos.map((v) => v.id)).toEqual([1, 2, 3]);
    expect(result.current.hasMore).toBe(false);
  });

  test('reports a failed loadMore until the next attempt', async () => {
    let nextPageFails = true;
    axios.get.mockImplementation((url: string, config?: { params?: { page?: number } }) => {
      if (url.endsWith('/videos')) {
        if ((config?.params?.page ?? 1) === 1) {
          return Promise.resolve({ data: { total: 3, videos: [makeVideo(1), makeVideo(2)] } });
        }
        return nextPageFails
          ? Promise.reject(new Error('Network Error'))
          : Promise.resolve({ data: { total: 3, videos: [makeVideo(3)] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' } } });
    });
    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1', pageSize: 2 })
    );
    await waitFor(() => expect(result.current.videos).toHaveLength(2));

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.loadMoreFailed).toBe(true);

    nextPageFails = false;
    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.loadMoreFailed).toBe(false);
    expect(result.current.videos).toHaveLength(3);
  });

  test('loadMore carries the active watchedState filter', async () => {
    axios.get.mockImplementation((url: string, config?: { params?: { page?: number } }) => {
      if (url.endsWith('/videos')) {
        const page = config?.params?.page ?? 1;
        if (page === 1) {
          return Promise.resolve({ data: { total: 3, videos: [makeVideo(1), makeVideo(2)] } });
        }
        return Promise.resolve({ data: { total: 3, videos: [makeVideo(3)] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' } } });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1', pageSize: 2, watchedState: 'watched' })
    );

    await waitFor(() => expect(result.current.videos).toHaveLength(2));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(axios.get).toHaveBeenCalledWith(
      '/api/playlists/PL1/videos',
      expect.objectContaining({
        params: expect.objectContaining({ page: 2, watchedState: 'watched' }),
      })
    );
  });

  test('markVideosIgnored flips the ignored flag of the given rows locally without refetching', async () => {
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 3, videos: [makeVideo(1), makeVideo(2), makeVideo(3)] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' } } });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => expect(result.current.videos).toHaveLength(3));
    const callsBefore = axios.get.mock.calls.length;

    act(() => {
      result.current.markVideosIgnored(['vid1', 'vid3'], true);
    });

    expect(result.current.videos.map((v) => v.ignored)).toEqual([true, false, true]);
    expect(axios.get).toHaveBeenCalledTimes(callsBefore);
  });

  test('markVideoDeleted flips the row to previously_downloaded locally without refetching', async () => {
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({
          data: { total: 1, videos: [makeVideo(1, { downloaded: true, previously_downloaded: false })] },
        });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' } } });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => expect(result.current.videos).toHaveLength(1));
    const callsBefore = axios.get.mock.calls.length;

    act(() => {
      result.current.markVideoDeleted('vid1');
    });

    expect(result.current.videos[0].downloaded).toBe(false);
    expect(result.current.videos[0].previously_downloaded).toBe(true);
    expect(axios.get).toHaveBeenCalledTimes(callsBefore);
  });

  test('markVideoDeleted records the row as deleted in Youtarr', async () => {
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 1, videos: [makeVideo(1, { downloaded: true })] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' } } });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => expect(result.current.videos).toHaveLength(1));

    act(() => {
      result.current.markVideoDeleted('vid1');
    });

    expect(result.current.videos[0].removed_reason).toBe('user_deleted');
  });

  test('refetchMeta updates the count without reloading the video list', async () => {
    let count = 5;
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 1, videos: [makeVideo(1)] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' }, not_downloaded_count: count } });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => expect(result.current.notDownloadedCount).toBe(5));
    const videoCalls = axios.get.mock.calls.filter((c: [string]) => c[0].endsWith('/videos')).length;

    count = 4;
    await act(async () => {
      await result.current.refetchMeta();
    });

    expect(result.current.notDownloadedCount).toBe(4);
    const videoCallsAfter = axios.get.mock.calls.filter((c: [string]) => c[0].endsWith('/videos')).length;
    expect(videoCallsAfter).toBe(videoCalls);
  });
});


describe('usePlaylistDetail.followingExistingCount', () => {
  beforeEach(() => jest.clearAllMocks());

  test('exposes the existing backlog count and clears it when leaving the playlist', async () => {
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0, following_existing_count: 7 } });
    const { result, rerender } = renderHook(({ playlistId }: { playlistId: string | null }) =>
      usePlaylistDetail({ token: 't', playlistId }), { initialProps: { playlistId: 'PL1' as string | null } });
    await waitFor(() => expect(result.current.followingExistingCount).toBe(7));
    rerender({ playlistId: null });
    await waitFor(() => expect(result.current.followingExistingCount).toBeNull());
  });
});


describe('usePlaylistDetail.followingRequestedCount', () => {
  beforeEach(() => jest.clearAllMocks());

  test('loads and updates the outstanding selection count independently of the page of videos', async () => {
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0, following_requested_count: 8 } });
    const { result } = renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));
    await waitFor(() => expect(result.current.followingRequestedCount).toBe(8));
    axios.get.mockResolvedValue({ data: { playlist: {}, following_requested_count: 2 } });
    await act(async () => { await result.current.refetchMeta(); });
    expect(result.current.followingRequestedCount).toBe(2);
  });

  test('clears the count when leaving the playlist', async () => {
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0, following_requested_count: 8 } });
    const { result, rerender } = renderHook(({ playlistId }: { playlistId: string | null }) =>
      usePlaylistDetail({ token: 't', playlistId }), { initialProps: { playlistId: 'PL1' as string | null } });
    await waitFor(() => expect(result.current.followingRequestedCount).toBe(8));
    rerender({ playlistId: null });
    await waitFor(() => expect(result.current.followingRequestedCount).toBeNull());
  });

  test('missing counts remain unknown rather than inventing outstanding requests', async () => {
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0 } });
    const { result } = renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.followingRequestedCount).toBeNull();
  });
});

describe('usePlaylistDetail download filter state', () => {
  beforeEach(() => jest.clearAllMocks());

  test('loads how many undownloaded videos the filters skip, and updates it with the meta', async () => {
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0, filtered_count: 4, filter_error: null } });
    const { result } = renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));
    await waitFor(() => expect(result.current.filteredCount).toBe(4));
    axios.get.mockResolvedValue({ data: { playlist: {}, filtered_count: 1, filter_error: null } });
    await act(async () => { await result.current.refetchMeta(); });
    expect(result.current.filteredCount).toBe(1);
  });

  test('reports a filter the server could not evaluate', async () => {
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0, filtered_count: 2, filter_error: 'Invalid regex pattern' } });
    const { result } = renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));
    await waitFor(() => expect(result.current.filterError).toBe('Invalid regex pattern'));
  });

  test('clears the filter state when leaving the playlist', async () => {
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0, filtered_count: 4, filter_error: 'Invalid regex pattern' } });
    const { result, rerender } = renderHook(({ playlistId }: { playlistId: string | null }) =>
      usePlaylistDetail({ token: 't', playlistId }), { initialProps: { playlistId: 'PL1' as string | null } });
    await waitFor(() => expect(result.current.filteredCount).toBe(4));
    rerender({ playlistId: null });
    await waitFor(() => expect(result.current.filteredCount).toBeNull());
    expect(result.current.filterError).toBeNull();
  });

  test('a response without filter fields leaves them unknown', async () => {
    axios.get.mockResolvedValue({ data: { playlist: {}, videos: [], total: 0 } });
    const { result } = renderHook(() => usePlaylistDetail({ token: 't', playlistId: 'PL1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect({ count: result.current.filteredCount, error: result.current.filterError }).toEqual({ count: null, error: null });
  });
});
