jest.mock('axios', () => ({ get: jest.fn() }));

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRunningScheduledTasks } from '../useRunningScheduledTasks';
import WebSocketContext from '../../contexts/WebSocketContext';

const axios = require('axios');

type Subscriber = {
  filter: (msg: { type?: string }) => boolean;
  callback: (msg: unknown) => void;
};

const task = (key: string, label: string, running: boolean) => ({
  key, label, running, runNow: { reason: running ? 'running' : null },
});

function makeWrapper(subscribers: Subscriber[]) {
  const value = {
    socket: null,
    subscribe: (filter: Subscriber['filter'], callback: Subscriber['callback']) => {
      subscribers.push({ filter, callback });
    },
    unsubscribe: (callback: Subscriber['callback']) => {
      const index = subscribers.findIndex((subscriber) => subscriber.callback === callback);
      if (index !== -1) subscribers.splice(index, 1);
    },
  };
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <WebSocketContext.Provider value={value as never}>{children}</WebSocketContext.Provider>;
  };
}

function broadcast(subscribers: Subscriber[], type: string) {
  subscribers.filter((subscriber) => subscriber.filter({ type })).forEach((subscriber) => subscriber.callback({ type }));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('lists the running tasks with their labels', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [
    task('videoRescanFrequency', 'Rescan files on disk', true),
    task('sessionCleanupFrequency', 'Session cleanup', false),
  ] } });
  const { result } = renderHook(() => useRunningScheduledTasks('tok'));
  await waitFor(() => {
    expect(result.current.running).toEqual([{ key: 'videoRescanFrequency', label: 'Rescan files on disk' }]);
  });
});

test('leaves out automatic downloads, which have their own indicator', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [task('channelDownloadFrequency', 'Automatic downloads', true)] } });
  const { result } = renderHook(() => useRunningScheduledTasks('tok'));
  await waitFor(() => expect(axios.get).toHaveBeenCalled());
  expect(result.current.running).toEqual([]);
});

test('does not fetch without a token', () => {
  renderHook(() => useRunningScheduledTasks(null));
  expect(axios.get).not.toHaveBeenCalled();
});

test('refetches after a scheduler broadcast', async () => {
  const subscribers: Subscriber[] = [];
  axios.get.mockResolvedValueOnce({ data: { tasks: [] } });
  const { result } = renderHook(() => useRunningScheduledTasks('tok'), { wrapper: makeWrapper(subscribers) });
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));

  axios.get.mockResolvedValueOnce({ data: { tasks: [task('videoRescanFrequency', 'Rescan files on disk', true)] } });
  act(() => {
    broadcast(subscribers, 'scheduledTaskStatus');
    jest.advanceTimersByTime(1000);
  });
  await waitFor(() => expect(result.current.running).toHaveLength(1));
});

test('ignores unrelated broadcasts', async () => {
  const subscribers: Subscriber[] = [];
  axios.get.mockResolvedValue({ data: { tasks: [] } });
  renderHook(() => useRunningScheduledTasks('tok'), { wrapper: makeWrapper(subscribers) });
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
  act(() => {
    broadcast(subscribers, 'downloadProgress');
    jest.advanceTimersByTime(1000);
  });
  expect(axios.get).toHaveBeenCalledTimes(1);
});

test('polls while a task is running, as a fallback for a missed finish', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [task('videoRescanFrequency', 'Rescan files on disk', true)] } });
  const { result } = renderHook(() => useRunningScheduledTasks('tok'));
  await waitFor(() => expect(result.current.running).toHaveLength(1));
  act(() => {
    jest.advanceTimersByTime(30_000);
  });
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
});

test('does not poll while nothing is running', async () => {
  axios.get.mockResolvedValue({ data: { tasks: [] } });
  renderHook(() => useRunningScheduledTasks('tok'));
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
  act(() => {
    jest.advanceTimersByTime(120_000);
  });
  expect(axios.get).toHaveBeenCalledTimes(1);
});

test('keeps the last value when a refetch fails', async () => {
  const subscribers: Subscriber[] = [];
  axios.get.mockResolvedValueOnce({ data: { tasks: [task('videoRescanFrequency', 'Rescan files on disk', true)] } });
  const { result } = renderHook(() => useRunningScheduledTasks('tok'), { wrapper: makeWrapper(subscribers) });
  await waitFor(() => expect(result.current.running).toHaveLength(1));

  axios.get.mockRejectedValueOnce(new Error('offline'));
  act(() => {
    broadcast(subscribers, 'connectionRestored');
    jest.advanceTimersByTime(1000);
  });
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  expect(result.current.running).toHaveLength(1);
});
