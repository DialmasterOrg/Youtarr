import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn((err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError)),
}));

const axios = require('axios');

const { useMarkDeleted, MARK_DELETED_BATCH_SIZE } = require('../useMarkDeleted');

const ids = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

describe('useMarkDeleted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('posts the selected ids with the token and returns how many were marked', async () => {
    axios.post.mockResolvedValueOnce({ data: { updated: 2 } });
    const { result } = renderHook(() => useMarkDeleted('tok'));

    let outcome: { updated: number; error: string | null } | null = null;
    await act(async () => {
      outcome = await result.current.markDeleted([4, 9]);
    });

    expect(outcome).toEqual({ updated: 2, error: null });
    expect(axios.post).toHaveBeenCalledWith(
      '/api/videos/mark-deleted',
      { videoIds: [4, 9] },
      { headers: { 'x-access-token': 'tok' } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  test('splits a large selection into batches the server accepts and sums the counts', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { updated: 1000 } })
      .mockResolvedValueOnce({ data: { updated: 300 } });
    const { result } = renderHook(() => useMarkDeleted('tok'));

    let outcome: { updated: number; error: string | null } | null = null;
    await act(async () => {
      outcome = await result.current.markDeleted(ids(1500));
    });

    expect(MARK_DELETED_BATCH_SIZE).toBe(1000);
    expect(outcome).toEqual({ updated: 1300, error: null });
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[0][1].videoIds).toHaveLength(1000);
    expect(axios.post.mock.calls[1][1].videoIds).toEqual(ids(1500).slice(1000));
  });

  test('stops at the first failing batch and reports what was marked before it', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { updated: 1000 } })
      .mockRejectedValueOnce({ isAxiosError: true, response: { data: { error: 'The downloads folder is empty.' } } });
    const { result } = renderHook(() => useMarkDeleted('tok'));

    let outcome: { updated: number; error: string | null } | null = null;
    await act(async () => {
      outcome = await result.current.markDeleted(ids(2500));
    });

    expect(outcome).toEqual({ updated: 1000, error: 'The downloads folder is empty.' });
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
  });

  test('returns the server error message when the request fails', async () => {
    axios.post.mockRejectedValueOnce({ isAxiosError: true, response: { data: { error: 'The downloads folder is empty.' } } });
    const { result } = renderHook(() => useMarkDeleted('tok'));

    let outcome: { updated: number; error: string | null } | null = null;
    await act(async () => {
      outcome = await result.current.markDeleted([4]);
    });

    expect(outcome).toEqual({ updated: 0, error: 'The downloads folder is empty.' });
    expect(result.current.loading).toBe(false);
  });

  test('falls back to a generic message when the failure carries none', async () => {
    axios.post.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useMarkDeleted('tok'));

    let outcome: { updated: number; error: string | null } | null = null;
    await act(async () => {
      outcome = await result.current.markDeleted([4]);
    });

    expect(outcome).toEqual({ updated: 0, error: 'Failed to mark videos as deleted' });
  });
});
