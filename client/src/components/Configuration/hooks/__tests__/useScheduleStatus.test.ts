jest.mock('axios', () => ({ get: jest.fn(), isAxiosError: jest.fn(() => false) }));

import { act, renderHook, waitFor } from '@testing-library/react';
import { useScheduleStatus } from '../useScheduleStatus';
import { CONFIG_UPDATED_EVENT } from '../../../../hooks/useConfig';

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
};

describe('useScheduleStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    };

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

    test('polls every 5 seconds while a task is running', async () => {
      axios.get.mockResolvedValue({ data: { tasks: [{ ...task, running: true }] } });
      const { result } = renderHook(() => useScheduleStatus('tok'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        jest.advanceTimersByTime(5_000);
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
});
