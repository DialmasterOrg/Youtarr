import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import WebSocketContext from '../../../../../contexts/WebSocketContext';
import { useActiveReorganize } from '../useActiveReorganize';

jest.mock('axios', () => ({ get: jest.fn() }));

const axios = require('axios');

type Subscriber = { filter: (msg: unknown) => boolean; callback: (payload: unknown) => void };

function makeWrapper(subscribers: Subscriber[]) {
  const value = {
    socket: null,
    subscribe: (filter: (msg: unknown) => boolean, callback: (payload: unknown) => void) => {
      subscribers.push({ filter, callback });
    },
    unsubscribe: jest.fn(),
  };
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(WebSocketContext.Provider, { value }, children);
  };
}

describe('useActiveReorganize', () => {
  let subscribers: Subscriber[];
  const progress = (status: string) => ({
    type: 'tvReorganizeProgress', payload: { operationId: 3, status, total: 4, done: 1, failed: 0, label: 'Chan' },
  });
  const send = (message: { type: string; payload: unknown }) => subscribers
    .filter((s) => s.filter(message)).forEach((s) => s.callback(message.payload));

  beforeEach(() => {
    jest.clearAllMocks();
    subscribers = [];
    axios.get.mockResolvedValue({ data: { operation: null } });
  });

  test('loads the running reorganize', async () => {
    axios.get.mockResolvedValueOnce({ data: { operation: { id: 3, label: 'Chan', status: 'running' } } });

    const { result } = renderHook(() => useActiveReorganize('token'), { wrapper: makeWrapper(subscribers) });

    await waitFor(() => expect(result.current.operation).toMatchObject({ id: 3 }));
  });

  test('follows progress broadcasts and clears when the reorganize ends', async () => {
    const { result } = renderHook(() => useActiveReorganize('token'), { wrapper: makeWrapper(subscribers) });
    await waitFor(() => expect(axios.get).toHaveBeenCalled());

    act(() => send(progress('running')));
    expect(result.current.operation).toMatchObject({ id: 3, label: 'Chan', done: 1, total: 4 });

    act(() => send(progress('completed')));
    expect(result.current.operation).toBeNull();
  });
});
