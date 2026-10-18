import { renderHook, act, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: jest.fn((err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError)),
}));

const axios = require('axios');

const { useMarkDeleted } = require('../useMarkDeleted');

describe('useMarkDeleted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('posts the selected ids with the token and returns how many were marked', async () => {
    axios.post.mockResolvedValueOnce({ data: { updated: 2 } });
    const { result } = renderHook(() => useMarkDeleted('tok'));

    let outcome: { updated: number } | null = null;
    await act(async () => {
      outcome = await result.current.markDeleted([4, 9]);
    });

    expect(outcome).toEqual({ updated: 2 });
    expect(axios.post).toHaveBeenCalledWith(
      '/api/videos/mark-deleted',
      { videoIds: [4, 9] },
      { headers: { 'x-access-token': 'tok' } }
    );
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  test('exposes the server error message and returns null when the request fails', async () => {
    axios.post.mockRejectedValueOnce({ isAxiosError: true, response: { data: { error: 'The downloads folder /d is empty.' } } });
    const { result } = renderHook(() => useMarkDeleted('tok'));

    let outcome: { updated: number } | null = { updated: -1 };
    await act(async () => {
      outcome = await result.current.markDeleted([4]);
    });

    expect(outcome).toBeNull();
    expect(result.current.error).toBe('The downloads folder /d is empty.');
    expect(result.current.loading).toBe(false);
  });

  test('falls back to a generic message when the failure carries none', async () => {
    axios.post.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useMarkDeleted('tok'));

    await act(async () => {
      await result.current.markDeleted([4]);
    });

    expect(result.current.error).toBe('Failed to mark videos as deleted');
  });
});
