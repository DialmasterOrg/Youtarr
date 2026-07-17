jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), isAxiosError: jest.fn(() => false) }));

import { renderHook, waitFor, act } from '@testing-library/react';
import { useWatchStatusSync } from '../useWatchStatusSync';

const axios = require('axios');

describe('useWatchStatusSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.isAxiosError.mockReturnValue(false);
  });

  test('fetches sync state on mount', async () => {
    axios.get.mockResolvedValueOnce({
      data: { running: false, lastRun: { trigger: 'manual', startedAt: 's', completedAt: 'c' } },
    });
    const { result } = renderHook(() => useWatchStatusSync('tok'));
    await waitFor(() => expect(result.current.syncState).not.toBeNull());
    expect(axios.get).toHaveBeenCalledWith('/api/mediaservers/watch-status', {
      headers: { 'x-access-token': 'tok' },
    });
    expect(result.current.syncState?.lastRun?.trigger).toBe('manual');
  });

  test('does not fetch without a token', () => {
    renderHook(() => useWatchStatusSync(null));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('startSync posts and flips the state to running', async () => {
    axios.get.mockResolvedValue({ data: { running: false, lastRun: null } });
    axios.post.mockResolvedValueOnce({ status: 202, data: { started: true } });
    const { result } = renderHook(() => useWatchStatusSync('tok'));
    await waitFor(() => expect(result.current.syncState).not.toBeNull());

    await act(async () => {
      await result.current.startSync();
    });

    expect(axios.post).toHaveBeenCalledWith('/api/mediaservers/watch-status/sync', null, {
      headers: { 'x-access-token': 'tok' },
    });
    expect(result.current.syncState?.running).toBe(true);
    expect(result.current.startError).toBeNull();
  });

  test('polls while running and stops once the sync completes', async () => {
    jest.useFakeTimers();
    try {
      axios.get
        .mockResolvedValueOnce({ data: { running: true, lastRun: null } })
        .mockResolvedValueOnce({
          data: {
            running: false,
            lastRun: { trigger: 'manual', startedAt: 's', completedAt: 'c', servers: { plex: { updated: 3 } } },
          },
        });

      const { result } = renderHook(() => useWatchStatusSync('tok'));
      await waitFor(() => expect(result.current.syncState?.running).toBe(true));

      await act(async () => {
        jest.advanceTimersByTime(2000);
      });
      expect(axios.get).toHaveBeenCalledTimes(2);
      expect(result.current.syncState?.running).toBe(false);
      expect(result.current.syncState?.lastRun?.servers?.plex).toEqual({ updated: 3 });

      // The interval is cleared once running flips false.
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      expect(axios.get).toHaveBeenCalledTimes(2);
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });

  test('stops polling and surfaces an error after repeated poll failures', async () => {
    jest.useFakeTimers();
    try {
      axios.get.mockResolvedValueOnce({ data: { running: true, lastRun: null } });
      axios.get.mockRejectedValue(new Error('backend gone'));

      const { result } = renderHook(() => useWatchStatusSync('tok'));
      await waitFor(() => expect(result.current.syncState?.running).toBe(true));
      expect(result.current.running).toBe(true);

      // Five consecutive failed polls trip the ceiling.
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
        });
      }

      expect(result.current.pollError).not.toBeNull();
      expect(result.current.running).toBe(false);
      expect(axios.get).toHaveBeenCalledTimes(6); // mount + 5 polls

      // Polling stops once the ceiling is hit.
      await act(async () => {
        jest.advanceTimersByTime(10000);
      });
      expect(axios.get).toHaveBeenCalledTimes(6);
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });

  test('a successful poll resets the failure count and clears the error', async () => {
    jest.useFakeTimers();
    try {
      axios.get.mockResolvedValueOnce({ data: { running: true, lastRun: null } });
      axios.get.mockRejectedValueOnce(new Error('blip'));
      axios.get.mockRejectedValueOnce(new Error('blip'));
      axios.get.mockResolvedValueOnce({
        data: { running: false, lastRun: { trigger: 'manual', startedAt: 's', completedAt: 'c' } },
      });

      const { result } = renderHook(() => useWatchStatusSync('tok'));
      await waitFor(() => expect(result.current.syncState?.running).toBe(true));

      for (let i = 0; i < 3; i++) {
        await act(async () => {
          jest.advanceTimersByTime(2000);
        });
      }

      expect(result.current.pollError).toBeNull();
      expect(result.current.running).toBe(false);
      expect(result.current.syncState?.lastRun?.trigger).toBe('manual');
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });

  test('surfaces the 409 message and polls the already-running sync', async () => {
    axios.get.mockResolvedValue({ data: { running: false, lastRun: null } });
    axios.post.mockRejectedValueOnce({
      response: { status: 409, data: { error: 'Watch status sync is already running' } },
    });
    axios.isAxiosError.mockReturnValue(true);

    const { result } = renderHook(() => useWatchStatusSync('tok'));
    await waitFor(() => expect(result.current.syncState).not.toBeNull());

    await act(async () => {
      await result.current.startSync();
    });

    expect(result.current.startError).toBe('Watch status sync is already running');
    expect(result.current.syncState?.running).toBe(true);
  });

  test('reports a generic message when starting fails outright', async () => {
    axios.get.mockResolvedValue({ data: { running: false, lastRun: null } });
    axios.post.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useWatchStatusSync('tok'));
    await waitFor(() => expect(result.current.syncState).not.toBeNull());

    await act(async () => {
      await result.current.startSync();
    });

    expect(result.current.startError).toBe('Failed to start sync');
    expect(result.current.syncState?.running).toBe(false);
  });
});
