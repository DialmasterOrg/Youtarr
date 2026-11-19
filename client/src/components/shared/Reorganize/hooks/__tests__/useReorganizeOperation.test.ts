import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import WebSocketContext from '../../../../../contexts/WebSocketContext';
import { useReorganizeOperation } from '../useReorganizeOperation';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  isAxiosError: (err: unknown): boolean => typeof err === 'object' && err !== null && 'response' in err,
}));

const axios = require('axios');

type Subscriber = { filter: (msg: unknown) => boolean; callback: (payload: unknown) => void };

function makeWrapper(subscribers: Subscriber[]) {
  const value = {
    socket: null,
    subscribe: (filter: (msg: unknown) => boolean, callback: (payload: unknown) => void) => {
      subscribers.push({ filter, callback });
    },
    unsubscribe: (callback: (payload: unknown) => void) => {
      const index = subscribers.findIndex((s) => s.callback === callback);
      if (index >= 0) subscribers.splice(index, 1);
    },
  };
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(WebSocketContext.Provider, { value }, children);
  };
}

function broadcast(subscribers: Subscriber[], message: { type: string; payload?: unknown }) {
  subscribers.filter((s) => s.filter(message)).forEach((s) => s.callback(message.payload));
}

const RUNNING = { id: 3, label: 'Chan', status: 'running', total: 4, done: 0, failed: 0 };

describe('useReorganizeOperation', () => {
  let subscribers: Subscriber[];

  beforeEach(() => {
    jest.clearAllMocks();
    subscribers = [];
  });

  const render = (operationId: number | null = 3) => renderHook(
    () => useReorganizeOperation('token', operationId), { wrapper: makeWrapper(subscribers) }
  );

  test('loads the operation', async () => {
    axios.get.mockResolvedValueOnce({ data: RUNNING });

    const { result } = render();

    await waitFor(() => expect(result.current.operation).toEqual(RUNNING));
    expect(axios.get).toHaveBeenCalledWith('/api/tv/operations/3', { headers: { 'x-access-token': 'token' } });
  });

  test('updates the counts from progress broadcasts', async () => {
    axios.get.mockResolvedValueOnce({ data: RUNNING });
    const { result } = render();
    await waitFor(() => expect(result.current.operation).toEqual(RUNNING));

    act(() => broadcast(subscribers, {
      type: 'tvReorganizeProgress', payload: { operationId: 3, status: 'running', total: 4, done: 2, failed: 1, label: 'Chan' },
    }));

    expect(result.current.operation).toMatchObject({ done: 2, failed: 1 });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test('ignores another operation\'s progress', async () => {
    axios.get.mockResolvedValueOnce({ data: RUNNING });
    const { result } = render();
    await waitFor(() => expect(result.current.operation).toEqual(RUNNING));

    act(() => broadcast(subscribers, {
      type: 'tvReorganizeProgress', payload: { operationId: 9, status: 'running', total: 1, done: 1, failed: 0, label: 'X' },
    }));

    expect(result.current.operation).toEqual(RUNNING);
  });

  test('reloads the result when the operation ends', async () => {
    axios.get.mockResolvedValueOnce({ data: RUNNING }).mockResolvedValueOnce({ data: { ...RUNNING, status: 'completed', done: 4 } });
    const { result } = render();
    await waitFor(() => expect(result.current.operation).toEqual(RUNNING));

    act(() => broadcast(subscribers, {
      type: 'tvReorganizeProgress', payload: { operationId: 3, status: 'completed', total: 4, done: 4, failed: 0, label: 'Chan' },
    }));

    await waitFor(() => expect(result.current.operation?.status).toBe('completed'));
  });

  test('retries failed videos and reloads', async () => {
    axios.get.mockResolvedValue({ data: { ...RUNNING, status: 'partial' } });
    axios.post.mockResolvedValueOnce({ data: { operationId: 3 } });
    const { result } = render();
    await waitFor(() => expect(result.current.operation).not.toBeNull());

    let started: boolean | undefined;
    await act(async () => { started = await result.current.retry(); });

    expect(started).toBe(true);
    expect(axios.post).toHaveBeenCalledWith('/api/tv/operations/3/retry', undefined, { headers: { 'x-access-token': 'token' } });
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test('shows a refused retry', async () => {
    axios.get.mockResolvedValue({ data: { ...RUNNING, status: 'partial' } });
    axios.post.mockRejectedValueOnce({ response: { status: 409, data: { error: 'A download is running.' } } });
    const { result } = render();
    await waitFor(() => expect(result.current.operation).not.toBeNull());

    let started: boolean | undefined;
    await act(async () => { started = await result.current.retry(); });

    expect(started).toBe(false);
    expect(result.current.error).toBe('A download is running.');
  });

  test('does nothing without an operation', () => {
    render(null);
    expect(axios.get).not.toHaveBeenCalled();
  });
});
