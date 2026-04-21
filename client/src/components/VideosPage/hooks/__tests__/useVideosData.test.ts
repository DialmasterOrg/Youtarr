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
  protectedFilter: false,
  missingFilter: false,
  useInfiniteScroll: false,
};

const buildResponse = (videos: { id: number; youtubeId: string }[]) => ({
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
        protectedFilter: true,
        missingFilter: true,
      })
    );

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    const url = axios.get.mock.calls[0][0] as string;
    expect(url).toContain('page=2');
    expect(url).toContain('limit=12');
    expect(url).toContain('sortBy=published');
    expect(url).toContain('sortOrder=asc');
    expect(url).toContain('search=foo');
    expect(url).toContain('channelFilter=Bar');
    expect(url).toContain('dateFrom=2024-01-01');
    expect(url).toContain('dateTo=2024-02-01');
    expect(url).toContain('maxRating=TV-MA');
    expect(url).toContain('protectedFilter=true');
    expect(url).toContain('missingFilter=true');
  });

  test('omits missingFilter from query string when false', async () => {
    axios.get.mockResolvedValueOnce(buildResponse([{ id: 1, youtubeId: 'a' }]));
    renderHook(() => useVideosData(baseParams));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    const url = axios.get.mock.calls[0][0] as string;
    expect(url).not.toContain('missingFilter');
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
