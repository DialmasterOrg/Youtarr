import { act, renderHook } from '@testing-library/react';
import { usePlaylistVideoDeletion } from '../usePlaylistVideoDeletion';

const mockDeleteVideosByYoutubeIds = jest.fn();

jest.mock('../../../shared/useVideoDeletion', () => ({
  useVideoDeletion: () => ({
    deleteVideos: jest.fn(),
    deleteVideosByYoutubeIds: mockDeleteVideosByYoutubeIds,
    loading: false,
    error: null,
  }),
}));

describe('usePlaylistVideoDeletion', () => {
  const markVideoDeleted = jest.fn();
  const refetchMeta = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderDeletion = () =>
    renderHook(() => usePlaylistVideoDeletion({ token: 't', markVideoDeleted, refetchMeta }));

  const confirmFor = async (ids: string[]) => {
    const { result } = renderDeletion();
    act(() => result.current.requestDelete(ids));
    let outcome = null;
    await act(async () => {
      outcome = await result.current.confirmDelete();
    });
    return { result, outcome };
  };

  test('opens the confirmation for the requested videos', () => {
    const { result } = renderDeletion();

    act(() => result.current.requestDelete(['a', 'b']));

    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.pendingCount).toBe(2);
  });

  test('stays closed when no video can be deleted', () => {
    const { result } = renderDeletion();

    act(() => result.current.requestDelete([]));

    expect(result.current.dialogOpen).toBe(false);
  });

  test('cancel closes the confirmation without deleting', () => {
    const { result } = renderDeletion();

    act(() => result.current.requestDelete(['a']));
    act(() => result.current.cancelDelete());

    expect(result.current.dialogOpen).toBe(false);
    expect(mockDeleteVideosByYoutubeIds).not.toHaveBeenCalled();
  });

  test('deletes the requested videos by YouTube id', async () => {
    mockDeleteVideosByYoutubeIds.mockResolvedValue({ success: true, deleted: ['a', 'b'], failed: [] });

    await confirmFor(['a', 'b']);

    expect(mockDeleteVideosByYoutubeIds).toHaveBeenCalledWith(['a', 'b'], 't');
  });

  test('marks each deleted row in place and refreshes the playlist counts', async () => {
    mockDeleteVideosByYoutubeIds.mockResolvedValue({ success: true, deleted: ['a', 'b'], failed: [] });

    await confirmFor(['a', 'b']);

    expect(markVideoDeleted.mock.calls).toEqual([['a'], ['b']]);
    expect(refetchMeta).toHaveBeenCalledTimes(1);
  });

  test('reports a full success', async () => {
    mockDeleteVideosByYoutubeIds.mockResolvedValue({ success: true, deleted: ['a', 'b'], failed: [] });

    const { outcome } = await confirmFor(['a', 'b']);

    expect(outcome).toEqual({ deletedIds: ['a', 'b'], message: 'Deleted 2 videos', severity: 'success' });
  });

  test('reports a partial failure with the reason', async () => {
    mockDeleteVideosByYoutubeIds.mockResolvedValue({
      success: false,
      deleted: ['a'],
      failed: [{ youtubeId: 'b', error: 'The downloads folder is empty.' }],
    });

    const { outcome } = await confirmFor(['a', 'b']);

    expect(outcome).toEqual({
      deletedIds: ['a'],
      message: 'Deleted 1 video; 1 could not be deleted: The downloads folder is empty.',
      severity: 'warning',
    });
  });

  test('reports a failure without touching the rows or counts', async () => {
    mockDeleteVideosByYoutubeIds.mockResolvedValue({
      success: false,
      deleted: [],
      failed: [{ youtubeId: 'a', error: 'Network Error' }],
    });

    const { outcome } = await confirmFor(['a']);

    expect(outcome).toEqual({ deletedIds: [], message: 'Failed to delete video: Network Error', severity: 'error' });
    expect(markVideoDeleted).not.toHaveBeenCalled();
    expect(refetchMeta).not.toHaveBeenCalled();
  });

  test('closes the confirmation once the delete is confirmed', async () => {
    mockDeleteVideosByYoutubeIds.mockResolvedValue({ success: true, deleted: ['a'], failed: [] });

    const { result } = await confirmFor(['a']);

    expect(result.current.dialogOpen).toBe(false);
  });
});
