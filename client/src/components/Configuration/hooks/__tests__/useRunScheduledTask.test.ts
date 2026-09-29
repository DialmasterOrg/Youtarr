jest.mock('axios', () => ({ post: jest.fn(), isAxiosError: jest.fn(() => false) }));

import { act, renderHook } from '@testing-library/react';
import { useRunScheduledTask } from '../useRunScheduledTask';

const axios = require('axios');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useRunScheduledTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.isAxiosError.mockReturnValue(false);
  });

  test('posts the run request with the auth token, tracks pending, and calls onChange', async () => {
    axios.post.mockResolvedValueOnce({ status: 202, data: { started: true } });
    const onChange = jest.fn();
    const { result } = renderHook(() => useRunScheduledTask('tok', onChange));

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.runTask('sessionCleanupFrequency');
    });
    expect(result.current.pending.sessionCleanupFrequency).toBe(true);

    await act(async () => {
      await runPromise;
    });

    expect(axios.post).toHaveBeenCalledWith('/api/schedules/sessionCleanupFrequency/run', null, {
      headers: { 'x-access-token': 'tok' },
    });
    expect(result.current.pending.sessionCleanupFrequency).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('pending stays true until onChange resolves, so the button does not flash enabled', async () => {
    axios.post.mockResolvedValueOnce({ status: 202, data: { started: true } });
    const onChangeDeferred = deferred<void>();
    const onChange = jest.fn(() => onChangeDeferred.promise);
    const { result } = renderHook(() => useRunScheduledTask('tok', onChange));

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.runTask('sessionCleanupFrequency');
    });
    expect(result.current.pending.sessionCleanupFrequency).toBe(true);

    // The POST resolved, but onChange's refetch has not; pending must stay true.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.pending.sessionCleanupFrequency).toBe(true);

    await act(async () => {
      onChangeDeferred.resolve();
      await runPromise;
    });
    expect(result.current.pending.sessionCleanupFrequency).toBeUndefined();
  });

  test('tracks pending state per task: each response clears only its own key', async () => {
    const first = deferred<{ status: number; data: { started: boolean } }>();
    const second = deferred<{ status: number; data: { started: boolean } }>();
    axios.post.mockImplementation((url: string) => (
      url === '/api/schedules/sessionCleanupFrequency/run' ? first.promise : second.promise
    ));
    const onChange = jest.fn();
    const { result } = renderHook(() => useRunScheduledTask('tok', onChange));

    let runFirst!: Promise<void>;
    let runSecond!: Promise<void>;
    act(() => {
      runFirst = result.current.runTask('sessionCleanupFrequency');
      runSecond = result.current.runTask('videoRescanFrequency');
    });
    expect(result.current.pending.sessionCleanupFrequency).toBe(true);
    expect(result.current.pending.videoRescanFrequency).toBe(true);

    // Resolve the second request first; only its key clears.
    await act(async () => {
      second.resolve({ status: 202, data: { started: true } });
      await runSecond;
    });
    expect(result.current.pending.sessionCleanupFrequency).toBe(true);
    expect(result.current.pending.videoRescanFrequency).toBeUndefined();

    await act(async () => {
      first.resolve({ status: 202, data: { started: true } });
      await runFirst;
    });
    expect(result.current.pending.sessionCleanupFrequency).toBeUndefined();
    expect(result.current.pending.videoRescanFrequency).toBeUndefined();
  });

  test('tracks pending state per task in the opposite order, including a failure', async () => {
    const first = deferred<{ status: number; data: { started: boolean } }>();
    const second = deferred<never>();
    axios.post.mockImplementation((url: string) => (
      url === '/api/schedules/sessionCleanupFrequency/run' ? first.promise : second.promise
    ));
    axios.isAxiosError.mockReturnValue(true);
    const onChange = jest.fn();
    const { result } = renderHook(() => useRunScheduledTask('tok', onChange));

    let runFirst!: Promise<void>;
    let runSecond!: Promise<void>;
    act(() => {
      runFirst = result.current.runTask('sessionCleanupFrequency');
      runSecond = result.current.runTask('videoRescanFrequency');
    });
    expect(result.current.pending.sessionCleanupFrequency).toBe(true);
    expect(result.current.pending.videoRescanFrequency).toBe(true);

    // Resolve the first request first this time; only its key clears.
    await act(async () => {
      first.resolve({ status: 202, data: { started: true } });
      await runFirst;
    });
    expect(result.current.pending.sessionCleanupFrequency).toBeUndefined();
    expect(result.current.pending.videoRescanFrequency).toBe(true);

    await act(async () => {
      second.reject({ response: { status: 500, data: { error: 'boom' } } });
      await runSecond;
    });
    expect(result.current.pending.sessionCleanupFrequency).toBeUndefined();
    expect(result.current.pending.videoRescanFrequency).toBeUndefined();
    expect(result.current.errors.videoRescanFrequency).toBe('boom');
  });

  test('a 409 sets no error but still calls onChange (the refreshed status explains why)', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Too soon', reason: 'cooldown' } } });
    axios.isAxiosError.mockReturnValue(true);
    const onChange = jest.fn();
    const { result } = renderHook(() => useRunScheduledTask('tok', onChange));

    await act(async () => {
      await result.current.runTask('sessionCleanupFrequency');
    });

    expect(result.current.errors.sessionCleanupFrequency).toBeUndefined();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('a 500 with an error message sets the task error to that text', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 500, data: { error: 'Failed to start the task' } } });
    axios.isAxiosError.mockReturnValue(true);
    const { result } = renderHook(() => useRunScheduledTask('tok', jest.fn()));

    await act(async () => {
      await result.current.runTask('sessionCleanupFrequency');
    });

    expect(result.current.errors.sessionCleanupFrequency).toBe('Failed to start the task');
  });

  test('a network error sets a generic message', async () => {
    axios.post.mockRejectedValueOnce(new Error('network down'));
    axios.isAxiosError.mockReturnValue(false);
    const { result } = renderHook(() => useRunScheduledTask('tok', jest.fn()));

    await act(async () => {
      await result.current.runTask('sessionCleanupFrequency');
    });

    expect(result.current.errors.sessionCleanupFrequency).toBe('Could not start the task.');
  });

  test('clicking again clears the previous error for that key', async () => {
    axios.post.mockRejectedValueOnce({ response: { status: 500, data: { error: 'Failed to start the task' } } });
    axios.isAxiosError.mockReturnValue(true);
    const { result } = renderHook(() => useRunScheduledTask('tok', jest.fn()));

    await act(async () => {
      await result.current.runTask('sessionCleanupFrequency');
    });
    expect(result.current.errors.sessionCleanupFrequency).toBe('Failed to start the task');

    axios.post.mockResolvedValueOnce({ status: 202, data: { started: true } });
    await act(async () => {
      await result.current.runTask('sessionCleanupFrequency');
    });
    expect(result.current.errors.sessionCleanupFrequency).toBeUndefined();
  });

  test('does nothing without a token', async () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useRunScheduledTask(null, onChange));

    await act(async () => {
      await result.current.runTask('sessionCleanupFrequency');
    });

    expect(axios.post).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.pending.sessionCleanupFrequency).toBeUndefined();
  });
});
