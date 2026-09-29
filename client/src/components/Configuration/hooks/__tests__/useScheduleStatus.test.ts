jest.mock('axios', () => ({ get: jest.fn(), isAxiosError: jest.fn(() => false) }));

import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useScheduleStatus } from '../useScheduleStatus';
import { CONFIG_UPDATED_EVENT } from '../../../../hooks/useConfig';
import WebSocketContext from '../../../../contexts/WebSocketContext';

const axios = require('axios');

const task = {
  key: 'autoRemovalFrequency',
  label: 'Automatic video cleanup',
  enabled: true,
  active: true,
  expression: '0 2 * * *',
  error: null,
  running: false,
  nextRunAt: '2026-09-21T09:00:00.000Z',
  lastRun: null,
  runNow: { available: true, reason: null, message: null, availableAt: null },
};

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
};

type Subscriber = {
  filter: (msg: unknown) => boolean;
  callback: (msg: unknown) => void;
};

function makeWrapper(subscribers: Subscriber[]) {
  const value = {
    socket: null,
    subscribe: (filter: (msg: unknown) => boolean, callback: (msg: unknown) => void) => {
      subscribers.push({ filter, callback });
    },
    unsubscribe: (callback: (msg: unknown) => void) => {
      const idx = subscribers.findIndex((s) => s.callback === callback);
      if (idx >= 0) subscribers.splice(idx, 1);
    },
  };
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(WebSocketContext.Provider, { value }, children);
  }
  return Wrapper;
}

describe('useScheduleStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    setHidden(false);
  });

  test('fetches the schedule status on mount with the auth token', async () => {
    axios.get.mockResolvedValueOnce({ data: { tasks: [task] } });
    const { result } = renderHook(() => useScheduleStatus('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(axios.get).toHaveBeenCalledWith('/api/schedules', { headers: { 'x-access-token': 'tok' } });
    expect(result.current.tasks).toEqual([task]);
    expect(result.current.error).toBeNull();
  });

  test('does not fetch without a token', () => {
    const { result } = renderHook(() => useScheduleStatus(null));
    expect(axios.get).not.toHaveBeenCalled();
    expect(result.current.tasks).toEqual([]);
  });

  test('refetches after the configuration is saved', async () => {
    axios.get.mockResolvedValue({ data: { tasks: [task] } });
    const { result } = renderHook(() => useScheduleStatus('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new CustomEvent(CONFIG_UPDATED_EVENT));
    });

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  });

  test('reports an error when the status cannot be loaded', async () => {
    axios.get.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useScheduleStatus('tok'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Could not load schedule status.');
    expect(result.current.tasks).toEqual([]);
  });

  test('ignores a stale response that resolves after a newer request', async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    axios.get
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ data: { tasks: [{ ...task, running: true }] } });
    const { result } = renderHook(() => useScheduleStatus('tok'));

    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.tasks[0]?.running).toBe(true));

    await act(async () => {
      resolveFirst({ data: { tasks: [{ ...task, running: false }] } });
    });
    expect(result.current.tasks[0]?.running).toBe(true);
  });

  describe('polling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      setHidden(false);
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('polls every 60 seconds while nothing is running', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [task] } });
      const { result } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        jest.advanceTimersByTime(59_000);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(1_000);
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    test('polls every 30 seconds while a task is running', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [{ ...task, running: true }] } });
      const { result } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    test('does not poll while the tab is hidden and refreshes when it becomes visible', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [task] } });
      const { result } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      setHidden(true);
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);

      setHidden(false);
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    test('stops polling on unmount', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [task] } });
      const { result, unmount } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      unmount();
      act(() => {
        jest.advanceTimersByTime(120_000);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('WebSocket refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      setHidden(false);
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    const REFRESH_TYPES = [
      'scheduledTaskStatus', 'jobsUpdated', 'downloadComplete',
      'downloadPauseChanged', 'rescanStatus', 'connectionRestored',
    ];

    test.each(REFRESH_TYPES)('the filter matches %s messages', async (type) => {
      axios.get.mockResolvedValue({ data: { tasks: [task] } });
      const subscribers: Subscriber[] = [];
      const { result } = renderHook(() => useScheduleStatus('tok'), { wrapper: makeWrapper(subscribers) });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(subscribers).toHaveLength(1);
      expect(subscribers[0].filter({ type })).toBe(true);
    });

    test('ignores other message types', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [task] } });
      const subscribers: Subscriber[] = [];
      const { result } = renderHook(() => useScheduleStatus('tok'), { wrapper: makeWrapper(subscribers) });
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(subscribers[0].filter({ type: 'downloadProgress' })).toBe(false);
    });

    test('debounces a burst of matching messages into one refetch', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [task] } });
      const subscribers: Subscriber[] = [];
      const { result } = renderHook(() => useScheduleStatus('tok'), { wrapper: makeWrapper(subscribers) });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        subscribers[0].callback({ type: 'jobsUpdated' });
        subscribers[0].callback({ type: 'jobsUpdated' });
        subscribers[0].callback({ type: 'jobsUpdated' });
      });
      expect(axios.get).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(300);
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    test('does not refetch a matching message while the tab is hidden', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [task] } });
      const subscribers: Subscriber[] = [];
      const { result } = renderHook(() => useScheduleStatus('tok'), { wrapper: makeWrapper(subscribers) });
      await waitFor(() => expect(result.current.loading).toBe(false));

      setHidden(true);
      act(() => {
        subscribers[0].callback({ type: 'jobsUpdated' });
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('refetches once after the tab becomes visible again following a hidden message', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [task] } });
      const subscribers: Subscriber[] = [];
      const { result } = renderHook(() => useScheduleStatus('tok'), { wrapper: makeWrapper(subscribers) });
      await waitFor(() => expect(result.current.loading).toBe(false));

      setHidden(true);
      act(() => {
        subscribers[0].callback({ type: 'jobsUpdated' });
        jest.advanceTimersByTime(300);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);

      setHidden(false);
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    test('unsubscribes on unmount', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [task] } });
      const subscribers: Subscriber[] = [];
      const { result, unmount } = renderHook(() => useScheduleStatus('tok'), { wrapper: makeWrapper(subscribers) });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(subscribers).toHaveLength(1);

      unmount();
      expect(subscribers).toHaveLength(0);
    });
  });

  describe('availability timer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      setHidden(false);
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    test('refetches when the earliest availableAt passes', async () => {
      const now = Date.parse('2026-09-21T00:00:00.000Z');
      jest.setSystemTime(now);
      const availableAt = new Date(now + 60_000).toISOString();
      axios.get.mockResolvedValue({
        data: {
          tasks: [{ ...task, runNow: { available: false, reason: 'cooldown', message: 'x', availableAt } }],
          serverTime: new Date(now).toISOString(),
        },
      });
      const { result } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      setHidden(true);

      act(() => {
        jest.advanceTimersByTime(60_999);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    test('does not arm a timer when every availableAt is null or in the past', async () => {
      const now = Date.parse('2026-09-21T00:00:00.000Z');
      jest.setSystemTime(now);
      const pastAvailableAt = new Date(now - 60_000).toISOString();
      axios.get.mockResolvedValue({
        data: {
          tasks: [
            { ...task, key: 'autoRemovalFrequency', runNow: { available: true, reason: null, message: null, availableAt: null } },
            { ...task, key: 'videoRescanFrequency', runNow: { available: false, reason: 'cooldown', message: 'x', availableAt: pastAvailableAt } },
          ],
          serverTime: new Date(now).toISOString(),
        },
      });
      const { result } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      setHidden(true);

      act(() => {
        jest.advanceTimersByTime(120_000);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    test('times the re-enable against the server clock when the browser clock is ahead', async () => {
      const serverNow = Date.parse('2026-09-21T00:00:00.000Z');
      jest.setSystemTime(serverNow + 30_000);
      const availableAt = new Date(serverNow + 60_000).toISOString();
      axios.get.mockResolvedValue({
        data: {
          tasks: [{ ...task, runNow: { available: false, reason: 'cooldown', message: 'x', availableAt } }],
          serverTime: new Date(serverNow).toISOString(),
        },
      });
      const { result } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      setHidden(true);

      act(() => {
        jest.advanceTimersByTime(31_000);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    test('times the re-enable against the server clock when the browser clock is behind', async () => {
      const serverNow = Date.parse('2026-09-21T00:00:00.000Z');
      jest.setSystemTime(serverNow - 30_000);
      const availableAt = new Date(serverNow + 60_000).toISOString();
      axios.get.mockResolvedValue({
        data: {
          tasks: [{ ...task, runNow: { available: false, reason: 'cooldown', message: 'x', availableAt } }],
          serverTime: new Date(serverNow).toISOString(),
        },
      });
      const { result } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      setHidden(true);

      act(() => {
        jest.advanceTimersByTime(60_999);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });

    test('falls back to the browser clock when the response has no serverTime', async () => {
      // No exact-boundary assertions here (unlike the offset tests above):
      // without a serverTime to anchor to, there is no browser/server drift
      // to distinguish from, so a wide margin is enough to confirm the
      // fallback still arms the timer around the 61 s mark.
      const now = Date.parse('2026-09-21T00:00:00.000Z');
      jest.setSystemTime(now);
      const availableAt = new Date(now + 60_000).toISOString();
      axios.get.mockResolvedValue({
        data: {
          tasks: [{ ...task, runNow: { available: false, reason: 'cooldown', message: 'x', availableAt } }],
        },
      });
      const { result } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));
      setHidden(true);

      act(() => {
        jest.advanceTimersByTime(55_000);
      });
      expect(axios.get).toHaveBeenCalledTimes(1);

      act(() => {
        jest.advanceTimersByTime(10_000);
      });
      await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    });
  });
});
