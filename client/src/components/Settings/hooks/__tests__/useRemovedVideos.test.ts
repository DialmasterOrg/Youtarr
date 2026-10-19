import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require('axios');

const { useRemovedVideos } = require('../useRemovedVideos');

const SUMMARY = {
  deleted: 12,
  missing: 4,
  legacy: 3,
  libraryCheck: { ok: true, reason: null, path: null, message: null },
};

describe('useRemovedVideos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: SUMMARY });
  });

  test('loads the summary on mount with the token', async () => {
    const { result } = renderHook(() => useRemovedVideos('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(axios.get).toHaveBeenCalledWith('/api/videos/removed-summary', { headers: { 'x-access-token': 'tok' } });
    expect(result.current.summary).toEqual(SUMMARY);
    expect(result.current.error).toBeNull();
  });

  test('does not load without a token', () => {
    renderHook(() => useRemovedVideos(null));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('exposes a load error', async () => {
    axios.get.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useRemovedVideos('tok'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load the deleted and missing video counts');
    expect(result.current.summary).toBeNull();
  });

  test('markAllMissingDeleted posts all: true, returns the count, and reloads the summary', async () => {
    axios.post.mockResolvedValueOnce({ data: { updated: 4 } });
    const { result } = renderHook(() => useRemovedVideos('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: { updated: number } | null = null;
    await act(async () => {
      outcome = await result.current.markAllMissingDeleted();
    });

    expect(outcome).toEqual({ updated: 4 });
    expect(axios.post).toHaveBeenCalledWith('/api/videos/mark-deleted', { all: true }, { headers: { 'x-access-token': 'tok' } });
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(result.current.actionPending).toBe(false);
  });

  test('markAllMissingDeleted can ask the server to look past an empty downloads folder', async () => {
    axios.post.mockResolvedValueOnce({ data: { updated: 4 } });
    const { result } = renderHook(() => useRemovedVideos('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.markAllMissingDeleted({ ignoreLibraryCheck: true });
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/videos/mark-deleted',
      { all: true, ignoreLibraryCheck: true },
      { headers: { 'x-access-token': 'tok' } }
    );
  });

  test('emptyTrash posts the options and returns the result', async () => {
    axios.post.mockResolvedValueOnce({ data: { purged: 16, archiveEntriesRemoved: 16, jobsAffected: 3 } });
    const { result } = renderHook(() => useRemovedVideos('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: unknown = null;
    await act(async () => {
      outcome = await result.current.emptyTrash({ states: ['deleted', 'missing'], removeFromArchive: true });
    });

    expect(outcome).toEqual({ purged: 16, archiveEntriesRemoved: 16, jobsAffected: 3 });
    expect(axios.post).toHaveBeenCalledWith(
      '/api/videos/purge-removed',
      { states: ['deleted', 'missing'], removeFromArchive: true },
      { headers: { 'x-access-token': 'tok' } }
    );
  });

  test('surfaces the server message when an action is refused', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 409, data: { error: 'The downloads folder is empty.', reason: 'library-unavailable' } } });
    const { result } = renderHook(() => useRemovedVideos('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: unknown = 'unset';
    await act(async () => {
      outcome = await result.current.emptyTrash({ states: ['missing'], removeFromArchive: false });
    });

    expect(outcome).toBeNull();
    expect(result.current.actionError).toBe('The downloads folder is empty.');
    expect(result.current.actionPending).toBe(false);
  });

  test('reloads the summary after a failed purge, which may have forgotten some videos', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 500, data: { error: 'Failed to empty the trash' } } });
    const { result } = renderHook(() => useRemovedVideos('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    axios.get.mockResolvedValueOnce({ data: { ...SUMMARY, deleted: 2 } });

    await act(async () => {
      await result.current.emptyTrash({ states: ['deleted'], removeFromArchive: false });
    });

    expect(result.current.summary?.deleted).toBe(2);
  });
});
