import { renderHook, waitFor, act } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

const { useVideosData } = require('../useVideosData');

const baseParams = {
  token: 'test-token',
  page: 1,
  videosPerPage: 12,
  orderBy: 'added' as const,
  sortOrder: 'desc' as const,
  search: '',
  channelFilter: '',
  dateFrom: '',
  dateTo: '',
  maxRatingFilter: '',
  protectedFilter: 'off' as const,
  missingFilter: 'off' as const,
  deletedFilter: 'off' as const,
  watchedFilter: 'off' as const,
  useInfiniteScroll: false,
};

const buildResponse = (videos: { id: number; youtubeId: string }[]): {
  data: Record<string, unknown> & { hiddenDeletedCount?: number | null; libraryWarning?: Record<string, unknown> | null };
} => ({
  data: {
    videos: videos.map((v) => ({
      ...v,
      youTubeChannelName: 'Channel',
      youTubeVideoName: `Video ${v.id}`,
      timeCreated: '2024-01-15T10:30:00',
      originalDate: '20240110',
      duration: 300,
      description: null,
      removed: false,
      fileSize: '1000',
    })),
    total: videos.length,
    page: 1,
    totalPages: 1,
    channels: ['Channel'],
    enabledChannels: [],
  },
});

describe('useVideosData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not fetch when token is null', () => {
    renderHook(() => useVideosData({ ...baseParams, token: null }));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('fetches with the expected query params', async () => {
    axios.get.mockResolvedValueOnce(buildResponse([{ id: 1, youtubeId: 'a' }]));

    renderHook(() =>
      useVideosData({
        ...baseParams,
        page: 2,
        orderBy: 'published',
        sortOrder: 'asc',
        search: 'foo',
        channelFilter: 'Bar',
        dateFrom: '2024-01-01',
        dateTo: '2024-02-01',
        maxRatingFilter: 'TV-MA',
        protectedFilter: 'only',
        missingFilter: 'exclude',
        deletedFilter: 'exclude',
        watchedFilter: 'exclude',
      })
    );

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    const url = axios.get.mock.calls[0][0] as string;
    expect(url).toContain('deletedFilter=exclude');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=12');
    expect(url).toContain('sortBy=published');
    expect(url).toContain('sortOrder=asc');
    expect(url).toContain('search=foo');
    expect(url).toContain('channelFilter=Bar');
    expect(url).toContain('dateFrom=2024-01-01');
    expect(url).toContain('dateTo=2024-02-01');
    expect(url).toContain('maxRating=TV-MA');
    expect(url).toContain('protectedFilter=only');
    expect(url).toContain('missingFilter=exclude');
    expect(url).toContain('watchedFilter=exclude');
  });

  test('omits missingFilter from query string when off', async () => {
    axios.get.mockResolvedValueOnce(buildResponse([{ id: 1, youtubeId: 'a' }]));
    renderHook(() => useVideosData(baseParams));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    const url = axios.get.mock.calls[0][0] as string;
    expect(url).not.toContain('missingFilter');
    expect(url).not.toContain('deletedFilter');
    expect(url).not.toContain('protectedFilter');
    expect(url).not.toContain('watchedFilter');
  });

  test('exposes the hidden deleted count and the library warning from the response', async () => {
    const response = buildResponse([{ id: 1, youtubeId: 'a' }]);
    response.data.hiddenDeletedCount = 4;
    response.data.libraryWarning = { reason: 'empty', path: '/d', message: 'The downloads folder is empty.', heldBack: 2 };
    axios.get.mockResolvedValueOnce(response);

    const { result } = renderHook(() => useVideosData(baseParams));

    await waitFor(() => expect(result.current.hiddenDeletedCount).toBe(4));
    expect(result.current.libraryWarning).toEqual({ reason: 'empty', path: '/d', message: 'The downloads folder is empty.', heldBack: 2 });
  });

  test('reports no hidden deleted count and no warning when the response has none', async () => {
    axios.get.mockResolvedValueOnce(buildResponse([{ id: 1, youtubeId: 'a' }]));

    const { result } = renderHook(() => useVideosData(baseParams));

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hiddenDeletedCount).toBeNull();
    expect(result.current.libraryWarning).toBeNull();
  });

  test('replaces videos when not using infinite scroll', async () => {
    axios.get.mockResolvedValueOnce(buildResponse([{ id: 1, youtubeId: 'a' }]));

    const { result, rerender } = renderHook(
      (props: typeof baseParams) => useVideosData(props),
      { initialProps: baseParams }
    );

    await waitFor(() => expect(result.current.videos).toHaveLength(1));

    axios.get.mockResolvedValueOnce(buildResponse([{ id: 2, youtubeId: 'b' }]));
    rerender({ ...baseParams, page: 2 });

    await waitFor(() => expect(result.current.videos).toEqual([
      expect.objectContaining({ id: 2, youtubeId: 'b' }),
    ]));
  });

  test('appends and de-duplicates videos when using infinite scroll', async () => {
    axios.get.mockResolvedValueOnce(buildResponse([
      { id: 1, youtubeId: 'a' },
      { id: 2, youtubeId: 'b' },
    ]));

    const { result, rerender } = renderHook(
      (props: typeof baseParams) => useVideosData(props),
      { initialProps: { ...baseParams, useInfiniteScroll: true } }
    );

    await waitFor(() => expect(result.current.videos).toHaveLength(2));

    // Page 2 returns one new video and a duplicate.
    axios.get.mockResolvedValueOnce(buildResponse([
      { id: 2, youtubeId: 'b' },
      { id: 3, youtubeId: 'c' },
    ]));

    rerender({ ...baseParams, useInfiniteScroll: true, page: 2 });

    await waitFor(() => expect(result.current.videos).toHaveLength(3));
    expect(result.current.videos.map((v: { id: number }) => v.id)).toEqual([1, 2, 3]);
  });

  test('exposes a load error message when the request fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('boom'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useVideosData(baseParams));

    await waitFor(() => expect(result.current.loadError).toBeTruthy());
    expect(result.current.loadError).toMatch(/Failed to load videos/i);
    consoleSpy.mockRestore();
  });

  test('refetch triggers a fresh axios call', async () => {
    axios.get.mockResolvedValue(buildResponse([{ id: 1, youtubeId: 'a' }]));
    const { result } = renderHook(() => useVideosData(baseParams));

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.refetch();
    });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});
