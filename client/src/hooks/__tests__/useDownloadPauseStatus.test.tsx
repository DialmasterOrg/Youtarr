import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import WebSocketContext from '../../contexts/WebSocketContext';
import { DownloadPauseStatus } from '../../types/downloadPause';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const axios = require('axios');
const { useDownloadPauseStatus } = require('../useDownloadPauseStatus');

type Filter = (message: { destination?: string; type?: string }) => boolean;
type Callback = (data: unknown) => void;

const makeStatus = (overrides: Partial<DownloadPauseStatus> = {}): DownloadPauseStatus => ({
  paused: false,
  pausedSince: null,
  reasons: [],
  usage: { limit: null, limitBytes: null, downloadedBytes: 1024 },
  freeSpace: { limit: null, limitBytes: null, availableBytes: null },
  checkedAt: '2026-09-24T00:00:00.000Z',
  ...overrides,
});

describe('useDownloadPauseStatus', () => {
  let subscriptions: Array<{ filter: Filter; callback: Callback }>;
  let subscribe: jest.Mock;
  let unsubscribe: jest.Mock;

  const emitMessage = (message: { destination?: string; type?: string; payload?: unknown }) => {
    subscriptions.forEach((sub) => {
      if (sub.filter(message)) {
        sub.callback(message.payload);
      }
    });
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WebSocketContext.Provider value={{ socket: null, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptions = [];
    subscribe = jest.fn((filter: Filter, callback: Callback) => {
      subscriptions.push({ filter, callback });
    });
    unsubscribe = jest.fn((callback: Callback) => {
      subscriptions = subscriptions.filter((sub) => sub.callback !== callback);
    });
    axios.get.mockResolvedValue({ data: makeStatus() });
  });

  test('loads the pause state with the auth token', async () => {
    const { result } = renderHook(() => useDownloadPauseStatus('token-1'), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(axios.get).toHaveBeenCalledWith('/api/jobs/download-pause', {
      headers: { 'x-access-token': 'token-1' },
    });
  });

  test('exposes the fetched status', async () => {
    const { result } = renderHook(() => useDownloadPauseStatus('token-1'), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(makeStatus()));
  });

  test('does not fetch without a token', async () => {
    const { result } = renderHook(() => useDownloadPauseStatus(null), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('reports a failed fetch as an error', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useDownloadPauseStatus('token-1'), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('Network Error'));
  });

  test('updates from downloadPauseChanged broadcasts', async () => {
    const { result } = renderHook(() => useDownloadPauseStatus('token-1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const paused = makeStatus({ paused: true, pausedSince: '2026-09-24T01:00:00.000Z' });

    act(() => {
      emitMessage({ destination: 'broadcast', type: 'downloadPauseChanged', payload: paused });
    });

    expect(result.current.data).toEqual(paused);
  });

  test('keeps a broadcast that arrives before a slower fetch resolves', async () => {
    let resolveFetch: (value: { data: DownloadPauseStatus }) => void = () => {};
    axios.get.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }));
    const { result } = renderHook(() => useDownloadPauseStatus('token-1'), { wrapper });
    const resumed = makeStatus({ paused: false });

    act(() => {
      emitMessage({ destination: 'broadcast', type: 'downloadPauseChanged', payload: resumed });
    });
    await act(async () => {
      resolveFetch({ data: makeStatus({ paused: true, pausedSince: '2026-09-24T01:00:00.000Z' }) });
    });

    expect(result.current.data).toEqual(resumed);
  });

  test('keeps the last known downloaded size when a broadcast omits it', async () => {
    const { result } = renderHook(() => useDownloadPauseStatus('token-1'), { wrapper });
    await waitFor(() => expect(result.current.data?.usage.downloadedBytes).toBe(1024));
    const resumed = makeStatus({ usage: { limit: null, limitBytes: null, downloadedBytes: null } });

    act(() => {
      emitMessage({ destination: 'broadcast', type: 'downloadPauseChanged', payload: resumed });
    });

    expect(result.current.data?.usage.downloadedBytes).toBe(1024);
  });

  test('uses a broadcast downloaded size when it has one', async () => {
    const { result } = renderHook(() => useDownloadPauseStatus('token-1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      emitMessage({
        destination: 'broadcast',
        type: 'downloadPauseChanged',
        payload: makeStatus({ usage: { limit: '1GB', limitBytes: 1, downloadedBytes: 2048 } }),
      });
    });

    expect(result.current.data?.usage.downloadedBytes).toBe(2048);
  });

  test('refetches after the WebSocket reconnects', async () => {
    const { result } = renderHook(() => useDownloadPauseStatus('token-1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      emitMessage({ type: 'connectionRestored' });
    });

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });

  test('unsubscribes on unmount', async () => {
    const { result, unmount } = renderHook(() => useDownloadPauseStatus('token-1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    unmount();

    expect(subscriptions).toHaveLength(0);
  });
});
