import { renderHook, act, waitFor } from '@testing-library/react';
import { hasDownloadFilters, usePlaylistFilterPreview, PlaylistFilterPreview } from '../usePlaylistFilterPreview';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn(),
}));

const axios = require('axios');

const filters = { title_filter_regex: 'Episode', min_duration: null, max_duration: 600 };
const previewData: PlaylistFilterPreview = {
  totalCount: 2,
  matchCount: 1,
  waitingCount: null,
  truncated: false,
  videos: [{ youtube_id: 'a', title: 'Episode 1', duration: 300, matches: true }],
};

const axiosError = (status: number, error?: string) => ({ response: { status, data: error ? { error } : {} } });
const setup = (token: string | null = 't') =>
  renderHook(() => usePlaylistFilterPreview({ token, playlistId: 'PL1' }));

describe('hasDownloadFilters', () => {
  const none = { title_filter_regex: null, min_duration: null, max_duration: null };

  test('is false when nothing is set', () => {
    expect(hasDownloadFilters(none)).toBe(false);
  });

  test('is false for a blank title filter', () => {
    expect(hasDownloadFilters({ ...none, title_filter_regex: '   ' })).toBe(false);
  });

  test.each([{ title_filter_regex: 'Episode' }, { min_duration: 60 }, { max_duration: 659 }])(
    'is true for %j',
    (set) => {
      expect(hasDownloadFilters({ ...none, ...set })).toBe(true);
    }
  );
});

describe('usePlaylistFilterPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.isAxiosError.mockReturnValue(true);
    axios.post.mockResolvedValue({ data: previewData });
  });

  test('starts with no preview', () => {
    const { result } = setup();
    expect(result.current).toMatchObject({ preview: null, loading: false, error: null });
  });

  test('posts the proposed filters with the access token', async () => {
    const { result } = setup();
    await act(async () => { await result.current.runPreview(filters); });
    expect(axios.post).toHaveBeenCalledWith(
      '/api/playlists/PL1/filter-preview',
      filters,
      { headers: { 'x-access-token': 't' } }
    );
  });

  test('exposes the preview the server returns', async () => {
    const { result } = setup();
    await act(async () => { await result.current.runPreview(filters); });
    expect(result.current.preview).toEqual(previewData);
  });

  test('reports loading while the request is in flight', async () => {
    let finish: (value: { data: PlaylistFilterPreview }) => void = () => {};
    axios.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = setup();
    act(() => { void result.current.runPreview(filters); });
    await waitFor(() => expect(result.current.loading).toBe(true));
    await act(async () => { finish({ data: previewData }); });
    expect(result.current.loading).toBe(false);
  });

  test('shows the server message for a rejected pattern', async () => {
    axios.post.mockRejectedValue(axiosError(400, 'Invalid regex pattern: unterminated character set'));
    const { result } = setup();
    await act(async () => { await result.current.runPreview(filters); });
    expect(result.current.error).toBe('Invalid regex pattern: unterminated character set');
  });

  test('says the playlist is gone on a 404', async () => {
    axios.post.mockRejectedValue(axiosError(404, 'Playlist not found'));
    const { result } = setup();
    await act(async () => { await result.current.runPreview(filters); });
    expect(result.current.error).toBe('This playlist no longer exists.');
  });

  test('falls back to a generic message for other failures', async () => {
    axios.isAxiosError.mockReturnValue(false);
    axios.post.mockRejectedValue(new Error('offline'));
    const { result } = setup();
    await act(async () => { await result.current.runPreview(filters); });
    expect(result.current.error).toBe('Could not preview the filters. Please try again.');
  });

  test('drops an earlier preview when a later one fails', async () => {
    const { result } = setup();
    await act(async () => { await result.current.runPreview(filters); });
    axios.post.mockRejectedValue(axiosError(400, 'Invalid regex pattern'));
    await act(async () => { await result.current.runPreview(filters); });
    expect(result.current.preview).toBeNull();
  });

  test('clearPreview removes the preview and any error', async () => {
    const { result } = setup();
    await act(async () => { await result.current.runPreview(filters); });
    act(() => result.current.clearPreview());
    expect(result.current).toMatchObject({ preview: null, error: null });
  });

  test('ignores a response that arrives after the preview was cleared', async () => {
    let finish: (value: { data: PlaylistFilterPreview }) => void = () => {};
    axios.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { result } = setup();
    act(() => { void result.current.runPreview(filters); });
    act(() => result.current.clearPreview());
    await act(async () => { finish({ data: previewData }); });
    expect(result.current).toMatchObject({ preview: null, loading: false });
  });

  // The server keeps evaluating a superseded request, so a second one must
  // wait for it: otherwise each edit could start another regex worker.
  describe('while a request is in flight', () => {
    let finish: (value: { data: PlaylistFilterPreview }) => void = () => {};

    beforeEach(() => {
      axios.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    });

    test('stays loading after the preview is cleared', async () => {
      const { result } = setup();
      act(() => { void result.current.runPreview(filters); });
      await waitFor(() => expect(result.current.loading).toBe(true));
      act(() => result.current.clearPreview());
      expect(result.current.loading).toBe(true);
    });

    test('stops loading once the superseded request settles', async () => {
      const { result } = setup();
      act(() => { void result.current.runPreview(filters); });
      act(() => result.current.clearPreview());
      await act(async () => { finish({ data: previewData }); });
      expect(result.current.loading).toBe(false);
    });

    test('does not start another request', async () => {
      const { result } = setup();
      act(() => { void result.current.runPreview(filters); });
      act(() => result.current.clearPreview());
      await act(async () => { await result.current.runPreview(filters); });
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('can run again after it settles', async () => {
      const { result } = setup();
      act(() => { void result.current.runPreview(filters); });
      await act(async () => { finish({ data: previewData }); });
      axios.post.mockResolvedValue({ data: previewData });
      await act(async () => { await result.current.runPreview(filters); });
      expect(axios.post).toHaveBeenCalledTimes(2);
    });
  });

  test('does not call the server without a token', async () => {
    const { result } = setup(null);
    await act(async () => { await result.current.runPreview(filters); });
    expect(axios.post).not.toHaveBeenCalled();
  });
});
