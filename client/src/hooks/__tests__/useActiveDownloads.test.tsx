import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useActiveDownloads } from '../useActiveDownloads';
import WebSocketContext from '../../contexts/WebSocketContext';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');

type Filter = (message: { destination?: string; type?: string }) => boolean;
type Callback = (data: unknown) => void;

describe('useActiveDownloads', () => {
  const mockToken = 'test-token-123';

  let subscriptions: Array<{ filter: Filter; callback: Callback }>;
  let subscribe: jest.Mock;
  let unsubscribe: jest.Mock;

  const emitMessage = (message: {
    destination?: string;
    type?: string;
    payload?: unknown;
  }) => {
    act(() => {
      subscriptions.forEach((sub) => {
        if (sub.filter(message)) {
          sub.callback(message.payload);
        }
      });
    });
  };

  const advanceTimers = (ms: number) => {
    act(() => {
      jest.advanceTimersByTime(ms);
    });
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WebSocketContext.Provider value={{ socket: null, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    subscriptions = [];
    subscribe = jest.fn((filter: Filter, callback: Callback) => {
      subscriptions.push({ filter, callback });
    });
    unsubscribe = jest.fn((callback: Callback) => {
      subscriptions = subscriptions.filter((sub) => sub.callback !== callback);
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('is inactive and does not fetch when token is null', () => {
    const { result } = renderHook(() => useActiveDownloads(null), { wrapper });

    expect(result.current.active).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('probes /runningjobs with the auth token on mount', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    renderHook(() => useActiveDownloads(mockToken), { wrapper });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith('/runningjobs', {
        headers: { 'x-access-token': mockToken },
      });
    });
  });

  test('becomes active when /runningjobs returns an In Progress job', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ id: 'a', status: 'In Progress' }],
    });

    const { result } = renderHook(() => useActiveDownloads(mockToken), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.active).toBe(true);
    });
  });

  test('becomes active when /runningjobs returns a queued Pending job', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ id: 'a', status: 'Pending' }],
    });

    const { result } = renderHook(() => useActiveDownloads(mockToken), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.active).toBe(true);
    });
  });

  test('stays inactive when /runningjobs returns only finished jobs', async () => {
    axios.get.mockResolvedValueOnce({
      data: [
        { id: 'a', status: 'Complete' },
        { id: 'b', status: 'Terminated' },
      ],
    });

    const { result } = renderHook(() => useActiveDownloads(mockToken), {
      wrapper,
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
    expect(result.current.active).toBe(false);
  });

  test('stays inactive when the /runningjobs request fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useActiveDownloads(mockToken), {
      wrapper,
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
    expect(result.current.active).toBe(false);
  });

  test('becomes active when a downloadProgress broadcast reports an active state', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useActiveDownloads(mockToken), {
      wrapper,
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    emitMessage({
      destination: 'broadcast',
      type: 'downloadProgress',
      payload: { progress: { state: 'downloading' } },
    });

    await waitFor(() => {
      expect(result.current.active).toBe(true);
    });
  });

  test('refetches after downloadComplete and clears active when no jobs remain', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ id: 'a', status: 'In Progress' }],
    });

    const { result } = renderHook(() => useActiveDownloads(mockToken), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.active).toBe(true);
    });

    axios.get.mockResolvedValueOnce({
      data: [{ id: 'a', status: 'Complete' }],
    });
    emitMessage({
      destination: 'broadcast',
      type: 'downloadComplete',
      payload: { videos: [] },
    });
    advanceTimers(1000);

    await waitFor(() => {
      expect(result.current.active).toBe(false);
    });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('stays active after downloadComplete when a chained job is still queued', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ id: 'a', status: 'In Progress' }],
    });

    const { result } = renderHook(() => useActiveDownloads(mockToken), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.active).toBe(true);
    });

    axios.get.mockResolvedValueOnce({
      data: [
        { id: 'a', status: 'Complete' },
        { id: 'b', status: 'Pending' },
      ],
    });
    emitMessage({
      destination: 'broadcast',
      type: 'downloadComplete',
      payload: { videos: [] },
    });
    advanceTimers(1000);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
    expect(result.current.active).toBe(true);
  });

  test('coalesces terminal signals into a single refetch', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ id: 'a', status: 'In Progress' }],
    });

    renderHook(() => useActiveDownloads(mockToken), { wrapper });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    axios.get.mockResolvedValueOnce({ data: [] });
    emitMessage({
      destination: 'broadcast',
      type: 'downloadProgress',
      payload: { progress: { state: 'complete' }, finalSummary: { totalDownloaded: 1 } },
    });
    advanceTimers(500);
    emitMessage({
      destination: 'broadcast',
      type: 'downloadComplete',
      payload: { videos: [] },
    });
    advanceTimers(1000);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });

  test('ignores throttled downloadProgress messages without a state change', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useActiveDownloads(mockToken), {
      wrapper,
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    emitMessage({
      destination: 'broadcast',
      type: 'downloadProgress',
      payload: { text: 'some log line' },
    });
    advanceTimers(2000);

    expect(result.current.active).toBe(false);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('unsubscribes and cancels a pending refetch on unmount', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    const { unmount } = renderHook(() => useActiveDownloads(mockToken), {
      wrapper,
    });

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    emitMessage({
      destination: 'broadcast',
      type: 'downloadComplete',
      payload: { videos: [] },
    });
    unmount();
    advanceTimers(1000);

    expect(unsubscribe).toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
