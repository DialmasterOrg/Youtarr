import { act, renderHook, waitFor } from '@testing-library/react';
import { useArrBridgeGrabRetry } from '../useArrBridgeGrabRetry';

jest.mock('axios', () => ({
  post: jest.fn(),
  isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean } | null)?.isAxiosError),
}));

const axios = require('axios');

const GRAB_ID = '9b89e5bc-8c90-4e72-b245-270fed2eacc2';
const httpError = (status: number) => ({ isAxiosError: true, response: { status } });

const setup = (token: string | null = 'session') => {
  const onDone = jest.fn();
  const view = renderHook(() => useArrBridgeGrabRetry(token, onDone));
  return { ...view, onDone };
};

describe('useArrBridgeGrabRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { result: 'started' } });
  });

  test('asks the server to try the grab, with the session token', async () => {
    const { result } = setup();

    await act(() => result.current.retry(GRAB_ID));

    expect(axios.post).toHaveBeenCalledWith(
      `/api/arr-bridge/grabs/${GRAB_ID}/retry`, null, { headers: { 'x-access-token': 'session' } }
    );
  });

  test.each(['started', 'queued', 'paused', 'ready', 'deferred'] as const)(
    'keeps the answer "%s" for the grab and has the list loaded again',
    async (answer) => {
      axios.post.mockResolvedValue({ data: { result: answer } });
      const { result, onDone } = setup();

      await act(() => result.current.retry(GRAB_ID));

      expect(result.current.outcomes).toEqual({ [GRAB_ID]: answer });
      expect(onDone).toHaveBeenCalledTimes(1);
    }
  );

  test('names the grab it is busy with until the answer is in', async () => {
    let answer: (value: unknown) => void = () => undefined;
    axios.post.mockReturnValue(new Promise((resolve) => {
      answer = resolve;
    }));
    const { result } = setup();

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.retry(GRAB_ID);
    });
    await waitFor(() => expect(result.current.busyId).toBe(GRAB_ID));

    await act(async () => {
      answer({ data: { result: 'queued' } });
      await pending;
    });
    expect(result.current.busyId).toBeNull();
  });

  test('says the grab is no longer waiting when the server refuses with 409', async () => {
    axios.post.mockRejectedValue(httpError(409));
    const { result, onDone } = setup();

    await act(() => result.current.retry(GRAB_ID));

    expect(result.current.outcomes).toEqual({ [GRAB_ID]: 'not-waiting' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['a server error', httpError(500)],
    ['no connection', new Error('offline')],
  ])('reports a failed try on %s', async (_name, error) => {
    axios.post.mockRejectedValue(error);
    const { result } = setup();

    await act(() => result.current.retry(GRAB_ID));

    expect(result.current.outcomes).toEqual({ [GRAB_ID]: 'failed' });
    expect(result.current.busyId).toBeNull();
  });

  test('reports a failed try for an answer it does not know', async () => {
    axios.post.mockResolvedValue({ data: { result: 'exploded' } });
    const { result } = setup();

    await act(() => result.current.retry(GRAB_ID));

    expect(result.current.outcomes).toEqual({ [GRAB_ID]: 'failed' });
  });

  test('keeps the outcome of each grab apart', async () => {
    const { result } = setup();
    await act(() => result.current.retry(GRAB_ID));
    axios.post.mockResolvedValue({ data: { result: 'paused' } });

    await act(() => result.current.retry('other-grab'));

    expect(result.current.outcomes).toEqual({ [GRAB_ID]: 'started', 'other-grab': 'paused' });
  });

  test('does nothing without a session', async () => {
    const { result, onDone } = setup(null);

    await act(() => result.current.retry(GRAB_ID));

    expect(axios.post).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
