import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import WebSocketContext from '../../../../../contexts/WebSocketContext';
import { useReorganizeOutcome } from '../useReorganizeOutcome';

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

const RUNNING = { id: 3, label: 'Chan', status: 'running', total: 2, done: 0, failed: 0, finishedAt: null };
const FAILED = { ...RUNNING, status: 'failed', failed: 2, error: 'undone', finishedAt: '2026-10-03T12:00:00.000Z' };

describe('useReorganizeOutcome', () => {
  let subscribers: Subscriber[];

  beforeEach(() => {
    jest.clearAllMocks();
    subscribers = [];
  });

  test('calls back once when the operation ends', async () => {
    axios.get.mockResolvedValueOnce({ data: RUNNING }).mockResolvedValueOnce({ data: FAILED });
    const onFinished = jest.fn();
    const { rerender } = renderHook(() => useReorganizeOutcome('token', 3, onFinished), { wrapper: makeWrapper(subscribers) });
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    expect(onFinished).not.toHaveBeenCalled();

    act(() => broadcast(subscribers, { type: 'tvReorganizeProgress', payload: { operationId: 3, status: 'failed', total: 2, done: 0, failed: 2 } }));

    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(expect.objectContaining({ id: 3, status: 'failed' })));
    rerender();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  test('calls back again when a retry of the same operation ends', async () => {
    axios.get
      .mockResolvedValueOnce({ data: FAILED })
      .mockResolvedValueOnce({ data: { ...RUNNING, status: 'completed', done: 2, finishedAt: '2026-10-03T12:05:00.000Z' } });
    const onFinished = jest.fn();
    const { rerender } = renderHook(
      ({ attempt }: { attempt: number }) => useReorganizeOutcome('token', 3, onFinished, { attempt }),
      { wrapper: makeWrapper(subscribers), initialProps: { attempt: 0 } }
    );
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));

    rerender({ attempt: 1 });

    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(2));
    expect(onFinished).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  test('does not call back again while a retry has not ended', async () => {
    axios.get.mockResolvedValue({ data: FAILED });
    const onFinished = jest.fn();
    const { rerender } = renderHook(
      ({ attempt }: { attempt: number }) => useReorganizeOutcome('token', 3, onFinished, { attempt }),
      { wrapper: makeWrapper(subscribers), initialProps: { attempt: 0 } }
    );
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1));

    rerender({ attempt: 1 });

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  test('calls back for an operation that had already ended when it was loaded', async () => {
    axios.get.mockResolvedValueOnce({ data: { ...RUNNING, status: 'partial', finishedAt: '2026-10-03T12:00:00.000Z' } });
    const onFinished = jest.fn();
    renderHook(() => useReorganizeOutcome('token', 3, onFinished), { wrapper: makeWrapper(subscribers) });

    await waitFor(() => expect(onFinished).toHaveBeenCalledWith(expect.objectContaining({ status: 'partial' })));
  });

  test('does nothing without an operation', () => {
    const onFinished = jest.fn();
    renderHook(() => useReorganizeOutcome('token', null, onFinished), { wrapper: makeWrapper(subscribers) });

    expect(axios.get).not.toHaveBeenCalled();
    expect(onFinished).not.toHaveBeenCalled();
  });
});
