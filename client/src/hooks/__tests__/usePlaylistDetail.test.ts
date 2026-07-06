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

  test('markVideoIgnored flips the ignored flag locally without refetching', async () => {
    axios.get.mockImplementation((url: string) => {
      if (url.endsWith('/videos')) {
        return Promise.resolve({ data: { total: 1, videos: [makeVideo(1)] } });
      }
      return Promise.resolve({ data: { playlist: { playlist_id: 'PL1' } } });
    });

    const { result } = renderHook(() =>
      usePlaylistDetail({ token: 't', playlistId: 'PL1' })
    );

    await waitFor(() => expect(result.current.videos).toHaveLength(1));
    const callsBefore = axios.get.mock.calls.length;

    act(() => {
      result.current.markVideoIgnored('vid1', true);
    });

    expect(result.current.videos[0].ignored).toBe(true);
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
