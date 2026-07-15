import React from 'react';
import { renderHook } from '@testing-library/react';
import { useDownloadListingsRefresh } from '../useDownloadListingsRefresh';
import WebSocketContext from '../../contexts/WebSocketContext';

type Filter = (message: { destination?: string; type?: string }) => boolean;
type Callback = (data: unknown) => void;

describe('useDownloadListingsRefresh', () => {
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

  test('calls onRefresh after a videosUpdated broadcast, debounced', () => {
    const onRefresh = jest.fn();
    renderHook(() => useDownloadListingsRefresh(onRefresh), { wrapper });

    emitMessage({ destination: 'broadcast', type: 'videosUpdated', payload: { youtubeId: 'abc' } });
    expect(onRefresh).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('calls onRefresh for downloadComplete broadcasts', () => {
    const onRefresh = jest.fn();
    renderHook(() => useDownloadListingsRefresh(onRefresh), { wrapper });

    emitMessage({ destination: 'broadcast', type: 'downloadComplete', payload: { videos: [] } });
    jest.advanceTimersByTime(1000);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('calls onRefresh for jobsUpdated broadcasts', () => {
    const onRefresh = jest.fn();
    renderHook(() => useDownloadListingsRefresh(onRefresh), { wrapper });

    emitMessage({
      destination: 'broadcast',
      type: 'jobsUpdated',
      payload: { jobId: 'job-1', status: 'In Progress' },
    });
    jest.advanceTimersByTime(1000);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('coalesces a burst of messages into a single refresh', () => {
    const onRefresh = jest.fn();
    renderHook(() => useDownloadListingsRefresh(onRefresh), { wrapper });

    emitMessage({ destination: 'broadcast', type: 'videosUpdated' });
    jest.advanceTimersByTime(500);
    emitMessage({ destination: 'broadcast', type: 'videosUpdated' });
    jest.advanceTimersByTime(500);
    emitMessage({ destination: 'broadcast', type: 'downloadComplete' });
    jest.advanceTimersByTime(1000);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('ignores unrelated message types', () => {
    const onRefresh = jest.fn();
    renderHook(() => useDownloadListingsRefresh(onRefresh), { wrapper });

    emitMessage({ destination: 'broadcast', type: 'downloadProgress' });
    jest.advanceTimersByTime(1000);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  test('uses the latest onRefresh callback without resubscribing', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) => useDownloadListingsRefresh(cb),
      { wrapper, initialProps: { cb: first } }
    );

    rerender({ cb: second });
    emitMessage({ destination: 'broadcast', type: 'videosUpdated' });
    jest.advanceTimersByTime(1000);

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('unsubscribes and cancels a pending refresh on unmount', () => {
    const onRefresh = jest.fn();
    const { unmount } = renderHook(() => useDownloadListingsRefresh(onRefresh), { wrapper });

    emitMessage({ destination: 'broadcast', type: 'videosUpdated' });
    unmount();
    jest.advanceTimersByTime(1000);

    expect(unsubscribe).toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
