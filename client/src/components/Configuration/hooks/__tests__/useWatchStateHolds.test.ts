import { renderHook, waitFor, act } from '@testing-library/react';
import { useWatchStateHolds } from '../useWatchStateHolds';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: (err: unknown): boolean => typeof err === 'object' && err !== null && 'response' in err,
}));

const axios = require('axios');

const HOLD = { id: 1, state: 'failed', serverType: 'jellyfin', title: 'Video' };

describe('useWatchStateHolds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { holds: [HOLD], counts: { pending: 2, failed: 1 } } });
  });

  test('loads the restores and their counts', async () => {
    const { result } = renderHook(() => useWatchStateHolds('token'));

    await waitFor(() => expect(result.current.holds).toEqual([HOLD]));
    expect(result.current.counts).toEqual({ pending: 2, failed: 1 });
    expect(axios.get).toHaveBeenCalledWith('/api/tv/holds', { headers: { 'x-access-token': 'token' } });
  });

  test('retries a restore and reloads', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useWatchStateHolds('token'));
    await waitFor(() => expect(result.current.holds).toHaveLength(1));

    await act(async () => { await result.current.retry(1); });

    expect(axios.post).toHaveBeenCalledWith('/api/tv/holds/1/retry', undefined, { headers: { 'x-access-token': 'token' } });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('dismisses a restore', async () => {
    axios.post.mockResolvedValueOnce({});
    const { result } = renderHook(() => useWatchStateHolds('token'));
    await waitFor(() => expect(result.current.holds).toHaveLength(1));

    await act(async () => { await result.current.dismiss(1); });

    expect(axios.post).toHaveBeenCalledWith('/api/tv/holds/1/dismiss', undefined, { headers: { 'x-access-token': 'token' } });
  });

  test('shows a failed action', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 404, data: { error: 'Restore not found' } } });
    const { result } = renderHook(() => useWatchStateHolds('token'));
    await waitFor(() => expect(result.current.holds).toHaveLength(1));

    await act(async () => { await result.current.retry(1); });

    expect(result.current.error).toBe('Restore not found');
  });
});
