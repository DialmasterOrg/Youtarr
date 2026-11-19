import { act, renderHook, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
  isAxiosError: jest.fn(),
}));

const axios = require('axios');

const { useVideoByYoutubeId } = require('../useVideoByYoutubeId');

const video = { id: 7, youtubeId: 'dQw4w9WgXcQ', youTubeVideoName: 'Video 7' };

const httpError = (status: number) => ({ isAxiosError: true, response: { status } });

describe('useVideoByYoutubeId', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // jest.config.cjs sets resetMocks, so mock implementations are set per test.
    axios.isAxiosError.mockImplementation(
      (error: unknown) => Boolean((error as { isAxiosError?: boolean } | null)?.isAxiosError)
    );
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('does not fetch without a token', () => {
    renderHook(() => useVideoByYoutubeId(null, 'dQw4w9WgXcQ'));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('does not fetch without a YouTube ID', () => {
    const { result } = renderHook(() => useVideoByYoutubeId('test-token', null));

    expect(axios.get).not.toHaveBeenCalled();
    expect(result.current).toEqual({ video: null, notFound: false, loadError: null });
  });

  test('fetches the video from the per-video route', async () => {
    axios.get.mockResolvedValueOnce({ data: video });

    const { result } = renderHook(() => useVideoByYoutubeId('test-token', 'dQw4w9WgXcQ'));

    await waitFor(() => expect(result.current.video).toEqual(video));
    expect(result.current.notFound).toBe(false);
    expect(axios.get).toHaveBeenCalledWith('/api/videos/dQw4w9WgXcQ', {
      headers: { 'x-access-token': 'test-token' },
    });
  });

  test.each([404, 400])('reports not found on a %i response', async (status) => {
    axios.get.mockRejectedValueOnce(httpError(status));

    const { result } = renderHook(() => useVideoByYoutubeId('test-token', 'dQw4w9WgXcQ'));

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.video).toBeNull();
    expect(result.current.loadError).toBeNull();
  });

  test('reports a load error on a server error', async () => {
    axios.get.mockRejectedValueOnce(httpError(500));

    const { result } = renderHook(() => useVideoByYoutubeId('test-token', 'dQw4w9WgXcQ'));

    await waitFor(() => expect(result.current.loadError).toBe('Failed to load the video.'));
    expect(result.current.notFound).toBe(false);
  });

  test('reports a load error when the network fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network down'));

    const { result } = renderHook(() => useVideoByYoutubeId('test-token', 'dQw4w9WgXcQ'));

    await waitFor(() => expect(result.current.loadError).toBe('Failed to load the video.'));
    expect(result.current.notFound).toBe(false);
  });

  test('ignores a response that arrives after the YouTube ID is cleared', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    axios.get.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));

    const { result, rerender } = renderHook(
      ({ youtubeId }: { youtubeId: string | null }) => useVideoByYoutubeId('test-token', youtubeId),
      { initialProps: { youtubeId: 'dQw4w9WgXcQ' as string | null } }
    );
    rerender({ youtubeId: null });
    await act(async () => {
      resolveRequest({ data: video });
    });

    expect(result.current).toEqual({ video: null, notFound: false, loadError: null });
  });
});
